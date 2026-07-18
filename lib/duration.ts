/**
 * Auto-fit a clip's duration to the words it has to speak.
 *
 * Why: paying for a 15s clip to deliver a 4s line wastes credits and leaves the
 * model padding dead air; too short and the sentence gets cut off mid-word. So
 * we estimate the spoken length and round UP to the nearest duration the model
 * actually offers — cheapest option that still finishes the line.
 */

/** Natural UGC/testimonial delivery ≈ 2.6 words/sec (slower than reading pace). */
const WORDS_PER_SECOND = 2.6;

/** Breathing room for the model's lead-in/lead-out beats. */
const PADDING_SECONDS = 1.2;

/** Spoken seconds a line needs, before rounding to a legal value. */
export function estimateSpeechSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 0;
  return words / WORDS_PER_SECOND + PADDING_SECONDS;
}

/**
 * Pick the cheapest duration from `allowed` that fits the line. Falls back to
 * the longest option when the line overruns every choice (better a cut-off tail
 * than a guaranteed one).
 */
export function fitDuration(text: string, allowed: number[]): number {
  const options = [...allowed].sort((a, b) => a - b);
  if (!options.length) return 10;
  const needed = estimateSpeechSeconds(text);
  return options.find((d) => d >= needed) ?? options[options.length - 1];
}
