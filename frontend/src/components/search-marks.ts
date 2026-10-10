/**
 * A result's text in pieces, the typed words marked where they start a word
 * (capitals ignored), as search matched them: "launch" marks the start of
 * "launches" but nothing in "relaunch".
 */
export type Piece = { text: string; marked: boolean };

const wordChar = /[\p{L}\p{N}]/u;

export function markWords(text: string, query: string): Piece[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  const marked = new Array<boolean>(text.length).fill(false);
  for (const word of words) {
    for (let at = lower.indexOf(word); at >= 0; at = lower.indexOf(word, at + 1)) {
      if (at > 0 && wordChar.test(text[at - 1])) continue;
      for (let i = at; i < at + word.length; i += 1) marked[i] = true;
    }
  }
  const pieces: Piece[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const last = pieces[pieces.length - 1];
    if (last && last.marked === marked[i]) last.text += text[i];
    else pieces.push({ text: text[i], marked: marked[i] });
  }
  return pieces.length > 0 ? pieces : [{ text, marked: false }];
}
