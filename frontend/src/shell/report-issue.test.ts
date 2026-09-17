import { describe, expect, it } from 'vitest';
import { ISSUE_TRACKER_URL, REPORT_ISSUE_ENABLED, issueUrl } from './report-issue';

describe('report issue', () => {
  // Hidden until Milestone 16 confirms the public tracker (decision 2026-09-17).
  it('is not enabled yet', () => {
    expect(REPORT_ISSUE_ENABLED).toBe(false);
  });

  it('builds a new-issue link with the diagnostics headings and no log content', () => {
    const url = new URL(issueUrl({ version: 'unstamped development build', os: 'darwin 15.6 (arm64)' }));
    expect(url.href.startsWith(ISSUE_TRACKER_URL)).toBe(true);
    const body = url.searchParams.get('body') ?? '';
    expect(body).toContain('Version: unstamped development build');
    expect(body).toContain('OS: darwin 15.6 (arm64)');
    expect(body).toContain('What happened');
    // The user pastes or attaches logs themselves; nothing is included for them.
    expect(body).not.toMatch(/level=|session start|Recent log lines/);
  });
});
