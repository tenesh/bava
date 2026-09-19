import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// A gate, not a grep. The roadmap's exit criterion for this milestone is a
// shell one-liner; a rule enforced only by a command nobody runs decays, so it
// runs here on every commit and in CI instead.

const SRC = fileURLToPath(new URL('..', import.meta.url));
const TOKENS = join(SRC, 'styles', 'tokens');

const EXTENSIONS = ['.svelte', '.scss', '.css', '.ts'];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
      continue;
    }
    // Tests describe literals in order to assert about them, and so does the
    // test data beside them: a fixture's whole point is fixed values.
    if (path.endsWith('.test.ts') || path.includes('__fixtures__')) continue;
    if (EXTENSIONS.some((e) => path.endsWith(e))) out.push(path);
  }
  return out;
}

/** Files allowed to contain literal values: the token layer, and nothing else. */
function isTokenLayer(path: string): boolean {
  return path.startsWith(TOKENS);
}

type Offence = { file: string; line: number; text: string };

function scan(pattern: RegExp): Offence[] {
  const offences: Offence[] = [];
  for (const file of sourceFiles(SRC)) {
    if (isTokenLayer(file)) continue;
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((text, i) => {
        if (pattern.test(text)) {
          offences.push({ file: file.slice(SRC.length), line: i + 1, text: text.trim() });
        }
      });
  }
  return offences;
}

const format = (o: Offence[]) => o.map((x) => `${x.file}:${x.line}  ${x.text}`);

describe('no literal values outside the token layer', () => {
  it('has no hex colours', () => {
    // Skips 3-8 digit hex in any file that is not a token partial.
    expect(format(scan(/#[0-9a-fA-F]{3,8}\b/))).toEqual([]);
  });

  it('has no px lengths', () => {
    expect(format(scan(/\b\d+(\.\d+)?px\b/))).toEqual([]);
  });

  it('has no rgb or hsl colours', () => {
    expect(format(scan(/\b(rgb|rgba|hsl|hsla)\(/))).toEqual([]);
  });

  // The guard is only worth anything if it is actually looking at files.
  it('scans a meaningful number of files', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(5);
  });
});
