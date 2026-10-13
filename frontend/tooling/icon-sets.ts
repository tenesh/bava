/**
 * The bundled icon sets, made at build time from two pinned packages: the
 * general line icons (outline and filled) and the product logos. Each set
 * becomes its own module, `virtual:bava-icons/<set>`, loaded only when a
 * canvas or the picker needs it.
 *
 * Logos whose own licence is not one Bava can ship are left out here, so
 * they never reach the app.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/** One icon as the app receives it: its name, its drawing on a 24 grid, words to find it by, and a logo's own colour. */
export type BundledIcon = { name: string; body: string; keywords: string[]; title?: string; hex?: string };

export const ICON_SETS = ['line', 'solid', 'logo'] as const;
export type IconSetName = (typeof ICON_SETS)[number];

/** Licences a logo may carry and still ship; none listed means the set's own, CC0. */
export const SHIPPABLE_LICENCES = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'CC0-1.0', 'Unlicense']);

/** Of those, the ones whose notice must ship with the logo. */
export const CREDITED_LICENCES = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause']);

const PREFIX = 'virtual:bava-icons/';
const modules = fileURLToPath(new URL('../node_modules/', import.meta.url));

type Node = [string, Record<string, string>];
type LineData = Record<string, { tags?: (string | number)[] }>;
type LogoData = { title: string; slug: string; hex: string; source?: string; aliases?: { aka?: string[] }; license?: { type?: string } };

const read = (path: string) => readFileSync(modules + path, 'utf8');
const repository = fileURLToPath(new URL('../../', import.meta.url));
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** A line icon's parts as SVG, without the wrapper or the blank square some sets add. */
function nodesToSvg(nodes: Node[]): string {
  return nodes
    .map(([tag, attributes]) => {
      const pairs = Object.entries(attributes).map(([key, value]) => `${key}="${escape(String(value))}"`);
      return `<${tag} ${pairs.join(' ')}/>`;
    })
    .join('');
}

function lineSet(style: 'outline' | 'filled'): BundledIcon[] {
  const nodes = JSON.parse(read(`@tabler/icons/tabler-nodes-${style}.json`)) as Record<string, Node[]>;
  const data = JSON.parse(read('@tabler/icons/icons.json')) as LineData;
  return Object.keys(nodes)
    .sort()
    .map((name) => ({
      name,
      body: nodesToSvg(nodes[name]),
      keywords: (data[name]?.tags ?? []).map((tag) => String(tag).toLowerCase()),
    }));
}

function logoSet(): BundledIcon[] {
  const data = JSON.parse(read('simple-icons/data/simple-icons.json')) as LogoData[];
  return data
    .filter((logo) => logo.license?.type === undefined || SHIPPABLE_LICENCES.has(logo.license.type))
    .map((logo) => {
      const path = /<path d="([^"]*)"/.exec(read(`simple-icons/icons/${logo.slug}.svg`))?.[1];
      if (!path) throw new Error(`logo ${logo.slug} has no drawing`);
      const keywords = [logo.title, ...(logo.aliases?.aka ?? [])].map((word) => word.toLowerCase());
      return { name: logo.slug, title: logo.title, body: `<path d="${path}"/>`, keywords, hex: logo.hex };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The credits file, in `frontend/public/`, shipped with the app and named in `NOTICE`. */
export const LOGO_CREDITS_FILE = 'LOGO-LICENCES.txt';

const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const BSD = `Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission. (BSD-3-Clause only.)

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;

/**
 * The credits for the logos that carry a licence of their own: each logo,
 * its licence and where it was drawn from (its copyright is its owner's, as
 * stated there), then each licence's text once.
 */
export function logoCredits(): string {
  const data = JSON.parse(read('simple-icons/data/simple-icons.json')) as LogoData[];
  const credited = data
    .filter((logo) => logo.license?.type !== undefined && CREDITED_LICENCES.has(logo.license.type))
    .sort((a, b) => a.title.localeCompare(b.title));
  const used = new Set(credited.map((logo) => logo.license!.type!));
  const texts: string[] = [];
  if (used.has('MIT')) texts.push(`MIT License\n\nCopyright (c) the logo's owner, as stated at its source.\n\n${MIT}`);
  if (used.has('BSD-2-Clause') || used.has('BSD-3-Clause')) {
    texts.push(`BSD License\n\nCopyright (c) the logo's owner, as stated at its source.\n\n${BSD}`);
  }
  if (used.has('Apache-2.0')) texts.push(readFileSync(repository + 'LICENSE', 'utf8').trim());
  return [
    'Logos with licences of their own',
    '',
    "These product logos, among those Bava draws in an icon element, are each under the licence named beside it. Each logo's copyright belongs to its owner, as stated at its source. The licence texts follow the list.",
    '',
    ...credited.map((logo) => `${logo.title}: ${logo.license!.type}, ${logo.source ?? 'no source listed'}`),
    '',
    ...texts.flatMap((text) => ['----', '', text, '']),
  ].join('\n');
}

/** A set as the app receives it. */
export function buildSet(set: IconSetName): BundledIcon[] {
  if (set === 'line') return lineSet('outline');
  if (set === 'solid') return lineSet('filled');
  return logoSet();
}

/** The Vite plugin serving each set as its own module. */
export function iconSets(): Plugin {
  return {
    name: 'bava-icon-sets',
    resolveId(id) {
      return id.startsWith(PREFIX) ? '\0' + id : undefined;
    },
    load(id) {
      if (!id.startsWith('\0' + PREFIX)) return undefined;
      const set = id.slice(PREFIX.length + 1) as IconSetName;
      if (!ICON_SETS.includes(set)) throw new Error(`no icon set ${set}`);
      return `export default ${JSON.stringify(buildSet(set))};`;
    },
  };
}
