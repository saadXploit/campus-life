/** Money is stored in kobo (whole numbers). 100 kobo = 1 naira. */
export function formatNaira(kobo: number): string {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}