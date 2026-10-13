/**
 * Writes the logos' credits beside the app's other public files, from the
 * logo set's own data. Run after a set update: `npm run icons:credits`.
 */
import { writeFileSync } from 'node:fs';
import { LOGO_CREDITS_FILE, logoCredits } from './icon-sets.ts';

writeFileSync(new URL(`../public/${LOGO_CREDITS_FILE}`, import.meta.url), logoCredits());
