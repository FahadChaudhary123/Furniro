/**
 * How wide each image group actually renders, in CSS pixels, at a desktop viewport.
 *
 * This is the single source of truth for image sizing. `optimise-images.mjs` resizes to
 * twice these values (the retina allowance) and `audit-image-sizes.mjs` reports against
 * them, so the two cannot disagree.
 *
 * Measured in a real browser, not guessed — see the "images are not oversized for their
 * slot" test in e2e/performance.spec.js, which fails if a layout change invalidates one of
 * these numbers.
 *
 * A blanket cap was the previous approach and it was wrong: at 1600px, `bedroom-3.jpg` was
 * 4.2x the 384px carousel slot it appears in, and six files held 1.1 MB of pure waste.
 */

export const DISPLAY_WIDTH = {
  'BrowseRange/': 384, // three-up carousel on the home page
  'rooms/': 600, // inspiration cards
  'setup/': 280, // marquee thumbnails
  'Products/': 600, // ~300 in the grid, ~600 on the detail page — 7 of 8 sources fall short, see audit:images
  blog: 760, // article column
  post: 80, // sidebar thumbnails
  'hero-bg': 1440, // full-bleed background
  contactBanner: 1440, // full-bleed banner
};

/** @param {string} rel - path relative to src/assets, forward slashes */
export function displayWidthFor(rel) {
  const normalised = rel.split('\\').join('/');
  const key = Object.keys(DISPLAY_WIDTH).find((k) => normalised.startsWith(k));
  return key ? DISPLAY_WIDTH[key] : null;
}
