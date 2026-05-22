export interface TruncatedText {
  text: string;
  truncated: boolean;
}

export function truncateText(
  input: string | null | undefined,
  max: number,
): TruncatedText {
  if (input == null || input === "") {
    return { text: "", truncated: false };
  }
  if (input.length <= max) {
    return { text: input, truncated: false };
  }
  return { text: input.slice(0, max), truncated: true };
}
