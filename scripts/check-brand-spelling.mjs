#!/usr/bin/env node
// S.O.S. brand spelling guard.
//
// The S.O.S. plural brand term is SUPERHEROS. This scans every tracked text
// file (source, copy, metadata, docs, workflows, native projects, Supabase
// functions and migrations) for the conventional plural and fails unless the
// exact line is listed in config/brand-spelling-allowlist.json with a reason.
//
// Usage: node scripts/check-brand-spelling.mjs [--json]
// Exit code 1 when violations are found.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN = /superheroes/i;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = [/^package-lock\.json$/, /\.(png|jpe?g|gif|webp|ico|icns|mp4|mov|webm|woff2?|ttf|otf|pdf|zip|jar|keystore|car|a)$/i, /^ios\/App\/Pods\//, /^android\/\.gradle\//];

export function loadAllowlist(root = ROOT) {
  const file = resolve(root, 'config/brand-spelling-allowlist.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).entries : [];
}

export function listFiles(root = ROOT) {
  try {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export function scanText(file, text, allowlist) {
  const allowed = allowlist.filter((e) => e.file === file);
  const out = [];
  text.split('\n').forEach((line, i) => {
    if (!FORBIDDEN.test(line)) return;
    if (allowed.some((e) => e.contains === '*' || line.includes(e.contains))) return;
    out.push({ file, line: i + 1, text: line.trim().slice(0, 200) });
  });
  return out;
}

export function scanRepo(root = ROOT) {
  const allowlist = loadAllowlist(root);
  const violations = [];
  for (const file of listFiles(root)) {
    if (SKIP.some((re) => re.test(file))) continue;
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    let text;
    try { text = readFileSync(path, 'utf8'); } catch { continue; }
    if (text.includes('\u0000')) continue;
    violations.push(...scanText(file, text, allowlist));
  }
  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = scanRepo();
  if (process.argv.includes('--json')) console.log(JSON.stringify(violations, null, 2));
  else if (!violations.length) console.log('Brand spelling OK: SUPERHEROS is consistent.');
  else {
    console.error(`Brand spelling check failed: ${violations.length} occurrence(s) of the conventional plural. Use SUPERHEROS, or add an allowlist entry with a reason.`);
    for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.text}`);
  }
  process.exit(violations.length ? 1 : 0);
}
