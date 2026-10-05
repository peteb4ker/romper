/**
 * `text` without its trailing run of any of `chars`: `trimTrailing("a. .",
 * " .")` is `"a"`. A loop rather than a `[...]+$` regex, which backtracks
 * on long runs that don't reach the end (SonarCloud S8786).
 */
export function trimTrailing(text: string, chars: string): string {
  let end = text.length;
  while (end > 0 && chars.includes(text[end - 1])) end--;
  return text.slice(0, end);
}
