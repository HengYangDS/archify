import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../archify/bin/archify.mjs', import.meta.url));

function validate(t, doc) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-class-auto-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'input.json');
  const output = path.join(dir, 'out.html');
  const source = JSON.stringify(doc);
  fs.writeFileSync(input, source);
  const result = spawnSync(process.execPath, [cli, 'render', 'class', input, output, '--quality', 'showcase'], { encoding: 'utf8' });
  assert.equal(fs.readFileSync(input, 'utf8'), source, 'automatic placement must not rewrite authored input');
  return { result, html: result.status === 0 ? fs.readFileSync(output, 'utf8') : '' };
}

const type = (id, kind = 'class') => ({ id, label: id, kind });
const yOf = (html, id) => {
  const match = html.match(new RegExp(`data-node-id="${id}"[^>]*>[\\s\\S]*?<rect[^>]* y="([\\d.]+)"`));
  assert.ok(match, `missing type ${id}`);
  return Number(match[1]);
};

// Before: every type failed with 'needs grid row/col or an absolute pos [x,y]'.
test('class first draft without placement puts supertypes above subtypes and passes showcase', t => {
  const { result, html } = validate(t, {
    schema_version: 1, diagram_type: 'class',
    meta: { title: 'Repositories', output: 'repo.html', quality_profile: 'showcase' },
    types: [type('Repo', 'interface'), type('Pg'), type('Mem'), type('Order', 'record')],
    relationships: [
      { from: 'Pg', to: 'Repo', kind: 'realization' },
      { from: 'Mem', to: 'Repo', kind: 'realization' },
      { from: 'Pg', to: 'Order', kind: 'dependency' },
      { from: 'Mem', to: 'Order', kind: 'dependency' },
    ],
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(yOf(html, 'Repo') < yOf(html, 'Pg'));
  assert.ok(yOf(html, 'Repo') < yOf(html, 'Mem'));
});
