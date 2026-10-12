/**
 * A table's or class's rows, read from the text as typed (`docs/file-format.md`,
 * "Tables and classes"). The file keeps the text; this reads it each time it
 * is drawn, so nothing typed is ever rewritten.
 */

export type TableRow = { name: string; type: string; keys: string[] };

/** A class member: its visibility marker (`+`, `-`, `#`, `~`, or none), name and type. */
export type ClassMember = { marker: string; name: string; type: string };

/** The words a column's keys may be written as, and how each is drawn. */
const KEYS: Record<string, string> = {
  pk: 'PK',
  primary_key: 'PK',
  fk: 'FK',
  foreign_key: 'FK',
  unique: 'UNQ',
  unq: 'UNQ',
};

const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * Each row: the first word its name (or a quoted name, spaces and all), the
 * trailing key words its keys, the words between its type.
 */
export function tableRows(text: string): TableRow[] {
  return lines(text).map((line) => {
    // A name with a space is quoted: "first name" text.
    const quoted = /^"([^"]*)"\s*(.*)$/.exec(line);
    const name = quoted ? quoted[1] : line.split(/\s+/)[0];
    const rest = quoted ? quoted[2] : line.slice(name.length).trim();
    const words = rest ? rest.split(/\s+/) : [];
    let end = words.length;
    while (end > 0 && KEYS[words[end - 1].toLowerCase()]) end -= 1;
    return {
      name,
      type: words.slice(0, end).join(' '),
      keys: words.slice(end).map((word) => KEYS[word.toLowerCase()]),
    };
  });
}

/** Members split into fields and methods (a member with `(`), each in typed order. */
export function classRows(text: string): { fields: ClassMember[]; methods: ClassMember[] } {
  const fields: ClassMember[] = [];
  const methods: ClassMember[] = [];
  for (const line of lines(text)) {
    const marker = /^[+\-#~]/.test(line) ? line[0] : '';
    const rest = line.slice(marker.length).trim();
    const open = rest.indexOf('(');
    if (open >= 0) {
      // A return type follows the first `:` after the closing bracket.
      const close = rest.indexOf(')', open);
      const after = close >= 0 ? close + 1 : rest.length;
      const colon = rest.indexOf(':', after);
      const name = (colon >= 0 ? rest.slice(0, colon) : rest).trim();
      methods.push({ marker, name, type: colon >= 0 ? rest.slice(colon + 1).trim() : '' });
    } else {
      const colon = rest.indexOf(':');
      fields.push({ marker, name: (colon >= 0 ? rest.slice(0, colon) : rest).trim(), type: colon >= 0 ? rest.slice(colon + 1).trim() : '' });
    }
  }
  return { fields, methods };
}
