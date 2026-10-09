import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDiagramWithBrandMarks, writeDiagram } from '../shared/cli.mjs';
import { throwDiagnosticError, throwDiagnosticProblems } from '../shared/diagnostics.mjs';
import { compileWorkflow } from './workflow-compiler.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { diagram: workflow, template, outPath, sourceEvidence } = await loadDiagramWithBrandMarks({
  rendererDir: __dirname,
  diagramType: 'workflow',
  defaultExample: 'agent-tool-call.workflow.json'
});

// A fresh draft often lists lanes, nodes and edges without columns. When no
// node, phase or group names a column, each node's column is its longest
// forward path from a start node (edges that close a cycle are ignored, so a
// retry or rollback loops back), and a node whose lane already holds that
// column moves right. Six columns are available; a longer chain is reported
// so the author merges steps or places columns explicitly.
function automaticWorkflowColumns() {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes.filter((node) => node && typeof node.id === 'string') : [];
  if (!nodes.length || nodes.length !== workflow.nodes.length) return;
  if (nodes.some((node) => node.col !== undefined)) return;
  if ([...(workflow.phases || []), ...(workflow.groups || [])].some((item) => item && (item.fromCol !== undefined || item.toCol !== undefined))) return;
  const ids = nodes.map((node) => node.id);
  if (new Set(ids).size !== ids.length) return;
  const edges = (Array.isArray(workflow.edges) ? workflow.edges : []).filter((edge) => (
    edge && ids.includes(edge.from) && ids.includes(edge.to) && edge.from !== edge.to));
  const outgoing = new Map(ids.map((id) => [id, []]));
  for (const edge of edges) outgoing.get(edge.from).push(edge);
  const order = Array.isArray(workflow.mainPath) ? workflow.mainPath.filter((id) => ids.includes(id)) : [];
  const forward = new Set();
  const state = new Map();
  const visit = (id) => {
    state.set(id, 'open');
    for (const edge of outgoing.get(id)) {
      const next = state.get(edge.to);
      if (next === 'open') continue;
      forward.add(edge);
      if (!next) visit(edge.to);
    }
    state.set(id, 'done');
  };
  const incoming = new Set(edges.map((edge) => edge.to));
  for (const id of [...order, ...ids.filter((id) => !incoming.has(id)), ...ids]) if (!state.has(id)) visit(id);
  const laneOf = new Map(nodes.map((node) => [node.id, node.lane]));
  // A hand-off to another lane may stay in the same column (a vertical hop)
  // when the strict one-column-per-step chain does not fit in six columns.
  const assign = (crossLaneStep) => {
    const col = new Map(ids.map((id) => [id, 0]));
    for (let pass = 0; pass <= ids.length * 2; pass += 1) {
      let changed = false;
      for (const edge of forward) {
        const step = laneOf.get(edge.from) === laneOf.get(edge.to) ? 1 : crossLaneStep;
        if (col.get(edge.to) < col.get(edge.from) + step) { col.set(edge.to, col.get(edge.from) + step); changed = true; }
      }
      // Two nodes may not share a lane cell: the later one moves right.
      const seen = new Map();
      for (const id of [...ids].sort((a, b) => col.get(a) - col.get(b) || ids.indexOf(a) - ids.indexOf(b))) {
        const key = `${laneOf.get(id)}\u0000${col.get(id)}`;
        if (seen.has(key)) { col.set(id, col.get(id) + 1); changed = true; }
        else seen.set(key, id);
      }
      if (!changed) break;
    }
    return col;
  };
  let col = assign(1);
  if (Math.max(...col.values()) > 5) col = assign(0);
  const deepest = Math.max(...col.values());
  if (deepest > 5) {
    throwDiagnosticProblems('Workflow placement failed', [
      `Nodes omit "col" and the longest step chain needs ${deepest + 1} columns (0..${deepest}); a workflow has 6 (0..5). Merge consecutive steps or place nodes with explicit "col" values that share columns across lanes.`,
    ], { code: 'layout/constraint', subject: { diagramType: 'workflow' } });
  }
  for (const node of nodes) node.col = col.get(node.id);
}
automaticWorkflowColumns();

const compiled = compileWorkflow({
  workflow,
  qualityProfile: process.env.ARCHIFY_QUALITY_PROFILE || workflow.meta?.quality_profile,
  sourceEvidence,
});

const layoutJson = process.argv.includes('--layout-json');

if (layoutJson) {
  process.stdout.write(`${JSON.stringify(compiled.receipt, null, 2)}\n`);
  if (!compiled.ok) process.exitCode = 1;
} else if (!compiled.ok) {
  throwDiagnosticError(compiled.error || 'Workflow compilation failed.', compiled.diagnostics);
} else {
  writeDiagram({
    outPath,
    template,
    diagramType: 'workflow',
    meta: workflow.meta,
    svg: compiled.svg,
    cards: workflow.cards,
    sourceEvidence,
  });
}
