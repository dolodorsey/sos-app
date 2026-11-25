import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Every password box must let people see what they type (Show / Hide).
// Raw <input type="password"> is only allowed inside the shared PasswordInput component.
const ROOT = new URL('../src/', import.meta.url).pathname;
const files = [];
const walk = d => { for (const e of fs.readdirSync(d, {withFileTypes: true})) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(jsx?|tsx?)$/.test(e.name)) files.push(p); } };
walk(ROOT);

test('no password box without a Show / Hide toggle', () => {
  const hits = files.filter(f => !f.endsWith('PasswordInput.jsx') && /type=["']password["']/.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(ROOT, f));
  assert.deepEqual(hits, [], `use PasswordInput instead of a raw password input in: ${hits.join(', ')}`);
});

test('PasswordInput toggles between hidden and visible text', () => {
  const s = fs.readFileSync(path.join(ROOT, 'components/PasswordInput.jsx'), 'utf8');
  assert.match(s, /type=\{show \? 'text' : 'password'\}/);
  assert.match(s, /Show password/);
  assert.match(s, /Hide password/);
});
