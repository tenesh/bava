import { describe, expect, it } from 'vitest';
import { isFullRun, orphans } from './orphans';

describe('orphans', () => {
  it('lists the references no test compared, sorted', () => {
    const onDisk = ['space/switcher--open--light.png', 'dialogs/about--default--dark.png', 'dialogs/about--default--light.png'];
    expect(orphans(onDisk, ['dialogs/about--default--light.png'])).toEqual(['dialogs/about--default--dark.png', 'space/switcher--open--light.png']);
  });

  it('lists nothing when every reference was compared', () => {
    expect(orphans(['a/b--c--light.png'], new Set(['a/b--c--light.png']))).toEqual([]);
  });
});

describe('isFullRun', () => {
  const run = (...args: string[]) => ['node', '/repo/frontend/node_modules/.bin/playwright', 'test', ...args];

  it('counts a run with only a config and an update as full', () => {
    expect(isFullRun(run('-c', 'tests/playwright.config.ts', '--update-snapshots'))).toBe(true);
    expect(isFullRun(run('--config=tests/playwright.config.ts', '--workers', '4'))).toBe(true);
  });

  it('does not count a run filtered by name, file or what failed last', () => {
    expect(isFullRun(run('-c', 'x.ts', '--grep', 'Trash'))).toBe(false);
    expect(isFullRun(run('-c', 'x.ts', '-g', 'Trash'))).toBe(false);
    expect(isFullRun(run('-c', 'x.ts', '--grep=Trash'))).toBe(false);
    expect(isFullRun(run('-c', 'x.ts', 'visual/dialogs.spec.ts'))).toBe(false);
    expect(isFullRun(run('-c', 'x.ts', '--last-failed'))).toBe(false);
  });

  // Only the visual project compares references; a run without it compares none.
  it('counts a run of the visual project as full, and not one of the integration project alone', () => {
    expect(isFullRun(run('-c', 'x.ts', '--project', 'visual'))).toBe(true);
    expect(isFullRun(run('-c', 'x.ts', '--project=visual'))).toBe(true);
    expect(isFullRun(run('-c', 'x.ts', '--project', 'integration'))).toBe(false);
    expect(isFullRun(run('-c', 'x.ts', '--project=integration'))).toBe(false);
  });

  it('counts a run naming both projects as full, however they are named', () => {
    expect(isFullRun(run('-c', 'x.ts', '--project=visual', '--project=integration'))).toBe(true);
    expect(isFullRun(run('-c', 'x.ts', '--project', 'integration', '--project', 'visual'))).toBe(true);
    expect(isFullRun(run('-c', 'x.ts', '--project', 'visual', 'integration'))).toBe(true);
  });

  it('does not count a command that is not a test run', () => {
    expect(isFullRun(['node', 'playwright', 'show-report'])).toBe(false);
  });
});
