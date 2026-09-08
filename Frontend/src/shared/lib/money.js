/**
 * Money formatting — the single place a price becomes text.
 *
 * Prices are stored as INTEGER MINOR UNITS and never as floats or formatted strings.
 * `0.1 + 0.2 !== 0.3`, and money that does not add up is a defect a customer notices.
 * A formatted string cannot be sorted, filtered or summed — which is why the shop's
 * "Price: low to high" control could never have worked against the old data.
 *
 * See docs/DATA_MODEL.md#money for the full reasoning.
 *
 * Rp 2.500.000  ->  250000000 minor units
 */

const MINOR_UNITS_PER_MAJOR = 100;

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format a price for display.
 * @param {number} minorUnits - integer minor units
 * @returns {string} e.g. "Rp 2.500.000"
 */
export function formatPrice(minorUnits) {
  if (typeof minorUnits !== 'number' || !Number.isFinite(minorUnits)) return '';
  return IDR.format(minorUnits / MINOR_UNITS_PER_MAJOR);
}

/**
 * Convert major units to minor units. Use when authoring catalogue data, so the
 * conversion is visible rather than a magic trailing "00".
 *
 * The `toFixed` round-trip is not decoration. `1.005 * 100` is `100.49999999999999` in
 * binary floating point, so a bare `Math.round` returns 100 and silently loses a unit at
 * exact-half boundaries. Whole-rupiah input — everything this project actually authors —
 * is unaffected either way, but a helper that quietly drops a cent on fractional input is
 * a trap for whoever reaches for it next.
 *
 * @param {number} major - e.g. 2_500_000 rupiah
 */
export const toMinorUnits = (major) =>
  Math.round(Number((major * MINOR_UNITS_PER_MAJOR).toFixed(4)));
