// Stored MRP is entered in a raw unit; everywhere it is shown to a user
// it must be displayed multiplied by this factor to get the real INR MRP.
export const MRP_DISPLAY_MULTIPLIER = 1.6

export function displayMrp(mrp: any): number | null {

  const num = Number(mrp)

  if (!mrp || Number.isNaN(num)) return null

  return Math.round((num * MRP_DISPLAY_MULTIPLIER) / 5) * 5

}
