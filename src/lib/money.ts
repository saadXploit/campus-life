/** Money is stored in kobo (whole numbers). 100 kobo = 1 naira. */
export function formatNaira(kobo: number): string {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}

/**
 * Reads a whole-naira amount a person typed ("5000", "5,000", "₦5,000") and returns kobo.
 * Returns null for anything else (decimals, negatives, letters, empty).
 */
export function parseNairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "");
  if (!/^\d{1,9}$/.test(cleaned)) return null;
  const naira = Number(cleaned);
  if (naira <= 0) return null;
  return naira * 100;
}
