import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../archify/bin/archify.mjs', import.meta.url));

function layout(t, doc) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-workflow-auto-col-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'input.json');
  const source = JSON.stringify(doc);
  fs.writeFileSync(input, source);
  const validate = spawnSync(process.execPath, [cli, 'validate', 'workflow', input, '--quality', 'showcase', '--json'], { encoding: 'utf8' });
  assert.equal(fs.readFileSync(input, 'utf8'), source, 'automatic columns must not rewrite authored input');
  return JSON.parse(validate.stdout);
}

const node = (id, lane, type = 'backend') => ({ id, lane, type, label: id });
const edge = (from, to, label) => ({ from, to, ...(label ? { label } : {}) });

// Before: every node without `col` failed schema/required before layout ran.
test('workflow nodes that omit col are ranked along their steps and pass showcase', t => {
  const receipt = layout(t, {
    schema_version: 2, diagram_type: 'workflow',
    meta: { title: 'Pull request', output: 'pr.html', quality_profile: 'showcase' },
    lanes: [{ id: 'dev', label: 'Developer' }, { id: 'ci', label: 'CI' }, { id: 'ops', label: 'Ops' }],
    nodes: [
      node('commit', 'dev', 'frontend'), node('build', 'ci'), node('test', 'ci'),
      node('deploy', 'ops', 'cloud'), node('fix', 'dev', 'frontend'),
    ],
    edges: [
      edge('commit', 'build', 'push'), edge('build', 'test'), edge('test', 'deploy', 'green'),
      edge('test', 'fix', 'red'), edge('fix', 'build', 'retry'),
    ],
  });
  assert.equal(receipt.ok, true, JSON.stringify(receipt.diagnostics));
});

test('workflow without columns reports a chain longer than six columns', t => {
  const steps = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const receipt = layout(t, {
    schema_version: 2, diagram_type: 'workflow',
    meta: { title: 'Long chain', output: 'long.html', quality_profile: 'showcase' },
    lanes: [{ id: 'only', label: 'Only lane' }],
    nodes: steps.map((id) => node(id, 'only')),
    edges: steps.slice(1).map((id, index) => edge(steps[index], id)),
  });
  assert.equal(receipt.ok, false);
  assert.ok(receipt.diagnostics.some((entry) => /needs 7 columns/.test(entry.message)), JSON.stringify(receipt.diagnostics));
});
