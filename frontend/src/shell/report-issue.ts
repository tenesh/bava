/**
 * Help ▸ Report Issue…: a link to a new issue with a template, opened in the
 * user's browser.
 *
 * Nothing is attached or sent. The template asks for what happened and names
 * the build; the user pastes diagnostics or attaches a log file themselves.
 *
 * **Hidden until Milestone 16** (decision 2026-09-17): the destination must be
 * a confirmed public tracker. Enabling it means flipping the flag and adding
 * the menu item in the same change.
 */
import { t } from '../i18n/t';

export const REPORT_ISSUE_ENABLED = false;

/** One place to change when the public tracker is confirmed. */
export const ISSUE_TRACKER_URL = 'https://github.com/tenesh/bava/issues/new';


export function issueUrl(build: { version: string; os: string }): string {
  const body = [
    `### ${t('issue.whatHappened')}`,
    '',
    `### ${t('issue.expected')}`,
    '',
    `### ${t('issue.steps')}`,
    '',
    `### ${t('issue.build')}`,
    `${t('issue.version')}: ${build.version}`,
    `${t('issue.os')}: ${build.os}`,
    '',
    `<!-- ${t('issue.hint')} -->`,
  ].join('\n');
  const url = new URL(ISSUE_TRACKER_URL);
  url.searchParams.set('body', body);
  return url.href;
}
