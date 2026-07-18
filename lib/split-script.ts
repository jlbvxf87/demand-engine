/**
 * Split a script into `count` VERBATIM scenes — no AI rewriting, every word
 * kept in order:
 *   1. If blank-line paragraphs match the requested count, each paragraph = one scene.
 *   2. Otherwise sentences are grouped into `count` contiguous, roughly-equal chunks.
 * If the script has fewer sentences than `count`, fewer scenes are returned
 * (one sentence each) — never padded, never invented.
 */
export function splitScriptVerbatim(script: string, count: number): string[] {
  const text = script.trim();
  if (count <= 1) return [text];

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (paragraphs.length === count) return paragraphs;

  // Sentence-level split (keeps punctuation), then pack into `count` chunks
  // balanced by character length so no scene gets one word while another gets a wall.
  const flat = text.replace(/\s+/g, " ").trim();
  const sentences = flat.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((s) => s.trim()) ?? [flat];
  if (sentences.length <= count) return sentences;

  const target = flat.length / count;
  const chunks: string[] = [];
  let current = "";
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const sentencesLeft = sentences.length - i; // including this one
    const chunksLeft = count - chunks.length; // including the one being built
    const mustFlush = current && chunksLeft > 1 && sentencesLeft <= chunksLeft;
    const fullEnough = current && chunksLeft > 1 && current.length + s.length / 2 >= target;
    if (mustFlush || fullEnough) {
      chunks.push(current.trim());
      current = "";
    }
    current = current ? `${current} ${s}` : s;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
