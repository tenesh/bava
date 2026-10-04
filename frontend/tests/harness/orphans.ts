/**
 * A reporter for the visual regression tests that lists every approved screenshot no
 * test compared, so a reference left behind by a rename or a removed walk is
 * deleted rather than kept. It lists only after a full run that passed: a
 * filtered run, or a walk that stopped early, compares fewer than it should.
 *
 * Each reference a test compares is recorded on it as an annotation (`shot`
 * in tests/helpers.ts does it). The list is written to
 * `.results/orphans.txt`, which tests/scripts/browser.sh prints.
 */
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

/** The annotation a test carries for each reference it compares. */
export const REFERENCE = 'reference';

const here = dirname(fileURLToPath(import.meta.url));
const REFERENCES = resolve(here, '../../../testdata/visual');
const REPORT = resolve(here, '../.results/orphans.txt');

/** The references no test compared, sorted. */
export function orphans(onDisk: string[], compared: Iterable<string>): string[] {
  const seen = new Set(compared);
  return onDisk.filter((path) => !seen.has(path)).sort();
}

/**
 * Whether the command line ran every walk: no filter by name, by file, by
 * line, by what failed or changed last time, or by a project other than the
 * visual one. Flags that only change how a walk runs (an update, workers)
 * leave it whole.
 */
export function isFullRun(argv: string[]): boolean {
  const at = argv.indexOf('test');
  if (at < 0) return false;
  const filters = new Set(['-g', '--grep', '--grep-invert', '--last-failed', '--only-changed', '--shard']);
  const valued = new Set(['-c', '--config', '-j', '--workers', '--reporter', '--repeat-each', '--retries', '--timeout']);
  const args = argv.slice(at + 1);
  const projects: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const flag = arg.split('=')[0];
    if (filters.has(flag)) return false;
    if (flag === '--project') {
      // One or more names: after `=`, or as the words that follow.
      if (arg.includes('=')) projects.push(arg.slice(arg.indexOf('=') + 1));
      else while (i + 1 < args.length && !args[i + 1].startsWith('-')) projects.push(args[(i += 1)]);
      continue;
    }
    if (valued.has(arg)) {
      i += 1;
      continue;
    }
    if (!arg.startsWith('-')) return false;
  }
  // Only the visual project compares references.
  return projects.length === 0 || projects.includes('visual');
}

/** Every PNG under `root`, as `area/name.png` with `/` between. */
function pngsUnder(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.png')) out.push(relative(root, path).split(sep).join('/'));
    }
  };
  walk(root);
  return out;
}

export default class OrphanReporter implements Reporter {
  private compared = new Set<string>();
  private full = false;

  onBegin(_config: FullConfig, _suite: Suite) {
    this.full = isFullRun(process.argv);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    for (const note of [...test.annotations, ...(result.annotations ?? [])]) {
      if (note.type === REFERENCE && note.description) this.compared.add(note.description);
    }
  }

  onEnd(result: FullResult) {
    mkdirSync(dirname(REPORT), { recursive: true });
    writeFileSync(REPORT, this.report(result));
  }

  private report(result: FullResult): string {
    if (!this.full) return 'Unused references: not listed, as this run did not run every walk.\n';
    if (result.status !== 'passed') return 'Unused references: not listed, as a walk failed and may have stopped before its pictures.\n';
    const unused = orphans(pngsUnder(REFERENCES), this.compared);
    if (unused.length === 0) return 'Unused references: none.\n';
    return `Unused references, to delete:\n${unused.map((path) => `  testdata/visual/${path}`).join('\n')}\n`;
  }

  printsToStdio() {
    return false;
  }
}
