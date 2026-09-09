/**
 * Fails if git's idea of a filename differs from the filesystem's, in case only.
 *
 * This exists because that bug reached CI and nothing local could have caught it.
 *
 * Windows and macOS use case-insensitive filesystems, and git's `core.ignorecase` defaults
 * to `true` there. Renaming `shop.jsx` to `Shop.jsx` therefore succeeds on disk, every local
 * check passes — lint, unit tests, build, 385 browser checks — and git carries on tracking
 * the old name. The Linux CI runner then checks out `shop.jsx`, `App.jsx` imports
 * `./pages/Shop`, and the build fails with `[UNRESOLVED_IMPORT] Could not resolve`.
 *
 * The build does catch it eventually. The point of this check is *when* and *how clearly*:
 * seconds into the run, naming both spellings, instead of a module-resolution error that
 * reads like a broken import path.
 *
 * Run from anywhere inside the repository:
 *   node scripts/check-filename-case.mjs
 */

import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';

let tracked;
try {
  tracked = execSync('git ls-files', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n')
    .filter(Boolean);
} catch {
  // Not a git repository, or git is unavailable. Nothing to compare against, and this must
  // not be the thing that fails a build in an environment that never had the problem.
  console.log('Filename case check: skipped (not a git working tree).');
  process.exit(0);
}

/**
 * Exact-case directory listings. `existsSync` is useless here — on a case-insensitive
 * filesystem it returns true for the wrong spelling, which is the entire bug.
 */
const cache = new Map();
const namesIn = (dir) => {
  if (!cache.has(dir)) {
    try {
      cache.set(dir, new Set(readdirSync(dir)));
    } catch {
      cache.set(dir, new Set());
    }
  }
  return cache.get(dir);
};

const mismatches = [];
const missing = [];

for (const file of tracked) {
  const dir = dirname(file) === '.' ? '.' : dirname(file);
  const base = dir === '.' ? file : file.slice(dir.length + 1);
  const names = namesIn(dir);
  if (names.has(base)) continue;

  const actual = [...names].find((n) => n.toLowerCase() === base.toLowerCase());
  if (actual) mismatches.push({ tracked: file, onDisk: `${dir === '.' ? '' : `${dir}/`}${actual}` });
  else missing.push(file);
}

if (mismatches.length === 0 && missing.length === 0) {
  console.log(`Filename case check: ${tracked.length} tracked files match the filesystem exactly.`);
  process.exit(0);
}

if (mismatches.length > 0) {
  console.error('\nFilename case mismatch — git and the filesystem disagree:\n');
  for (const m of mismatches) {
    console.error(`  git has:  ${m.tracked}`);
    console.error(`  disk has: ${m.onDisk}\n`);
  }
  console.error('A case-only rename on Windows or macOS does not reach git on its own.');
  console.error('Record it explicitly, in two steps, because the destination "exists":\n');
  const [first] = mismatches;
  console.error(`  git mv ${first.tracked} ${first.tracked}.tmp`);
  console.error(`  git mv ${first.tracked}.tmp ${first.onDisk}\n`);
}

if (missing.length > 0) {
  console.error('\nTracked but not on disk at all:\n');
  for (const f of missing) console.error(`  ${f}`);
  console.error('');
}

process.exit(1);
