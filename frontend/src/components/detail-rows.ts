/**
 * An error's details, one "Label: value" per line, as rows to show side by
 * side. A line with no label keeps its text as a value on its own.
 */
export function detailRows(details: string): { label: string; value: string }[] {
  return details
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const at = line.indexOf(': ');
      return at < 0 ? { label: '', value: line } : { label: line.slice(0, at), value: line.slice(at + 2) };
    });
}
