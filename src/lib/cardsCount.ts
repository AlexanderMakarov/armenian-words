export const MIN_CARDS_COUNT = 1;
export const MAX_CARDS_COUNT = 100;

/** Parse a cards-count draft. Returns null when empty, non-integer, or out of 1–100. */
export function parseCardsCount(raw: string): number | null {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const n = Number(trimmed);
    if (n < MIN_CARDS_COUNT || n > MAX_CARDS_COUNT) return null;
    return n;
}
