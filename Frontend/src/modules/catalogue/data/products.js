/**
 * The canonical Furniro catalogue.
 *
 * ONE definition, consumed by both the shop grid and the home-page featured strip. Before
 * this file there were two incompatible product shapes in two components — `title` vs
 * `name`, numeric prices vs formatted strings, and image paths that resolved to nothing.
 * See docs/DATA_MODEL.md#-the-product-shape-conflict.
 *
 * Shape (docs/DATA_MODEL.md#resolution):
 *   id          integer, stable
 *   slug        URL-safe, unique — the future /shop/:slug
 *   name        display name
 *   description one line, shown under the name
 *   category    one of CATEGORIES below
 *   price       INTEGER MINOR UNITS (Rp 2.500.000 -> 250000000)
 *   old_price   integer minor units, or null. Must exceed price.
 *   image       imported module, so Vite hashes and emits it
 *   created_at  ISO date; drives the derived "New" badge
 *
 * No `badge` field: badges are derived by badgeFor(). No formatted price strings.
 *
 * This is the seed for the `products` table in docs/DATA_MODEL.md#proposed-schema, and the
 * response shape for GET /api/products in docs/API.md. Keep them in step.
 */

import { toMinorUnits } from '../../../shared/lib/money.js';

import product1 from '../../../assets/Products/product1.jpg';
import product2 from '../../../assets/Products/product2.jpg';
import product3 from '../../../assets/Products/product3.jpg';
import product4 from '../../../assets/Products/product4.jpg';
import product5 from '../../../assets/Products/product5.jpg';
import product6 from '../../../assets/Products/product6.jpg';
import product7 from '../../../assets/Products/product7.jpg';
import product8 from '../../../assets/Products/product8.jpg';

const IMAGES = [product1, product2, product3, product4, product5, product6, product7, product8];

/** Cycle the eight available photographs across the catalogue. */
const img = (n) => IMAGES[(n - 1) % IMAGES.length];

export const CATEGORIES = [
  'Living Room',
  'Bedroom',
  'Dining',
  'Office',
  'Outdoor',
  'Decor',
  'Storage',
];

// Authored in major units for legibility; converted on the way in so no entry carries a
// magic trailing "00".
const rp = toMinorUnits;

export const products = [
  // ── Signature range — the eight shown on the home page ──────────────────────────────
  { id: 1,  slug: 'syltherine', name: 'Syltherine', description: 'Stylish cafe chair',
    category: 'Living Room', price: rp(2_500_000), old_price: rp(3_500_000), image: product1, created_at: '2025-11-04' },
  { id: 2,  slug: 'leviosa', name: 'Leviosa', description: 'Stylish cafe chair',
    category: 'Living Room', price: rp(2_500_000), old_price: null, image: product2, created_at: '2025-11-04' },
  { id: 3,  slug: 'lolito', name: 'Lolito', description: 'Luxury big sofa',
    category: 'Living Room', price: rp(7_000_000), old_price: rp(14_000_000), image: product3, created_at: '2025-09-18' },
  { id: 4,  slug: 'respira', name: 'Respira', description: 'Outdoor bar table and stool',
    category: 'Outdoor', price: rp(500_000), old_price: null, image: product4, created_at: '2026-08-20' },
  { id: 5,  slug: 'grifo', name: 'Grifo', description: 'Night lamp',
    category: 'Decor', price: rp(1_500_000), old_price: null, image: product5, created_at: '2026-01-12' },
  { id: 6,  slug: 'muggo', name: 'Muggo', description: 'Small mug',
    category: 'Decor', price: rp(150_000), old_price: null, image: product6, created_at: '2026-08-25' },
  { id: 7,  slug: 'pingky', name: 'Pingky', description: 'Cute bed set',
    category: 'Bedroom', price: rp(7_000_000), old_price: rp(14_000_000), image: product7, created_at: '2025-10-02' },
  { id: 8,  slug: 'potty', name: 'Potty', description: 'Minimalist flower pot',
    category: 'Decor', price: rp(500_000), old_price: null, image: product8, created_at: '2026-08-28' },

  // ── Living Room ─────────────────────────────────────────────────────────────────────
  { id: 9,  slug: 'nordic-wooden-chair', name: 'Nordic Wooden Chair', description: 'Solid oak dining and accent chair',
    category: 'Living Room', price: rp(2_500_000), old_price: rp(3_500_000), image: img(1), created_at: '2025-08-14' },
  { id: 10, slug: 'minimalist-sofa', name: 'Minimalist Sofa', description: 'Three-seat sofa in brushed linen',
    category: 'Living Room', price: rp(7_200_000), old_price: rp(9_000_000), image: img(2), created_at: '2025-07-22' },
  { id: 11, slug: 'scandinavian-armchair', name: 'Scandinavian Armchair', description: 'Low-back armchair with tapered legs',
    category: 'Living Room', price: rp(3_100_000), old_price: null, image: img(1), created_at: '2025-06-30' },
  { id: 12, slug: 'glass-coffee-table', name: 'Glass Coffee Table', description: 'Tempered glass top on a steel frame',
    category: 'Living Room', price: rp(2_700_000), old_price: null, image: img(2), created_at: '2025-06-11' },
  { id: 13, slug: 'velvet-lounge-chair', name: 'Velvet Lounge Chair', description: 'Deep-seated chair in cotton velvet',
    category: 'Living Room', price: rp(4_600_000), old_price: null, image: img(3), created_at: '2025-05-19' },
  { id: 14, slug: 'fabric-recliner', name: 'Fabric Recliner', description: 'Reclining armchair with footrest',
    category: 'Living Room', price: rp(5_400_000), old_price: rp(6_200_000), image: img(3), created_at: '2025-05-02' },
  { id: 15, slug: 'wooden-tv-console', name: 'Wooden TV Console', description: 'Low console with cable management',
    category: 'Living Room', price: rp(4_300_000), old_price: null, image: img(4), created_at: '2025-04-16' },
  { id: 16, slug: 'corner-l-shaped-sofa', name: 'Corner L-Shaped Sofa', description: 'Modular corner sofa, seats five',
    category: 'Living Room', price: rp(13_500_000), old_price: null, image: img(1), created_at: '2025-03-28' },
  { id: 17, slug: 'minimal-console-table', name: 'Minimal Console Table', description: 'Slim hallway console in ash',
    category: 'Living Room', price: rp(3_200_000), old_price: null, image: img(4), created_at: '2025-03-09' },

  // ── Bedroom ─────────────────────────────────────────────────────────────────────────
  { id: 18, slug: 'luxury-king-bed', name: 'Luxury King Bed', description: 'Upholstered king frame with headboard',
    category: 'Bedroom', price: rp(12_000_000), old_price: null, image: img(3), created_at: '2025-08-01' },
  { id: 19, slug: 'classic-wardrobe', name: 'Classic Wardrobe', description: 'Three-door wardrobe in walnut',
    category: 'Bedroom', price: rp(9_800_000), old_price: rp(11_500_000), image: img(3), created_at: '2025-07-05' },
  { id: 20, slug: 'king-size-mattress', name: 'King Size Mattress', description: 'Pocket-sprung with memory foam',
    category: 'Bedroom', price: rp(6_800_000), old_price: null, image: img(2), created_at: '2025-06-20' },
  { id: 21, slug: 'minimal-nightstand', name: 'Minimal Nightstand', description: 'Single-drawer bedside table',
    category: 'Bedroom', price: rp(1_800_000), old_price: null, image: img(1), created_at: '2025-05-27' },
  { id: 22, slug: 'luxury-dressing-table', name: 'Luxury Dressing Table', description: 'Dressing table with lit mirror',
    category: 'Bedroom', price: rp(6_100_000), old_price: null, image: img(1), created_at: '2025-04-30' },
  { id: 23, slug: 'sliding-door-wardrobe', name: 'Sliding Door Wardrobe', description: 'Two-metre wardrobe with mirrored doors',
    category: 'Bedroom', price: rp(11_000_000), old_price: null, image: img(3), created_at: '2025-02-14' },

  // ── Dining ──────────────────────────────────────────────────────────────────────────
  { id: 24, slug: 'modern-dining-table', name: 'Modern Dining Table', description: 'Six-seat table in solid oak',
    category: 'Dining', price: rp(8_500_000), old_price: null, image: img(4), created_at: '2026-08-22' },
  { id: 25, slug: 'marble-dining-set', name: 'Marble Dining Set', description: 'Marble-top table with six chairs',
    category: 'Dining', price: rp(15_000_000), old_price: null, image: img(1), created_at: '2025-07-14' },
  { id: 26, slug: 'round-dining-table', name: 'Round Dining Table', description: 'Four-seat pedestal table',
    category: 'Dining', price: rp(7_800_000), old_price: null, image: img(4), created_at: '2025-06-02' },
  { id: 27, slug: 'wooden-bar-stool', name: 'Wooden Bar Stool', description: 'Counter-height stool with footrail',
    category: 'Dining', price: rp(1_700_000), old_price: null, image: img(4), created_at: '2025-04-08' },
  { id: 28, slug: 'fabric-dining-chairs-set-of-4', name: 'Fabric Dining Chairs (Set of 4)', description: 'Upholstered chairs in woven fabric',
    category: 'Dining', price: rp(4_900_000), old_price: null, image: img(1), created_at: '2025-03-15' },

  // ── Office ──────────────────────────────────────────────────────────────────────────
  { id: 29, slug: 'office-executive-chair', name: 'Office Executive Chair', description: 'High-back chair with lumbar support',
    category: 'Office', price: rp(4_200_000), old_price: null, image: img(1), created_at: '2025-08-09' },
  { id: 30, slug: 'compact-study-desk', name: 'Compact Study Desk', description: 'Space-saving desk with cable port',
    category: 'Office', price: rp(3_500_000), old_price: null, image: img(2), created_at: '2025-07-01' },
  { id: 31, slug: 'modern-bookshelf', name: 'Modern Bookshelf', description: 'Five-tier open shelving unit',
    category: 'Office', price: rp(3_900_000), old_price: null, image: img(2), created_at: '2025-05-11' },
  { id: 32, slug: 'office-filing-cabinet', name: 'Office Filing Cabinet', description: 'Three-drawer lockable cabinet',
    category: 'Office', price: rp(2_500_000), old_price: null, image: img(2), created_at: '2025-03-22' },
  { id: 33, slug: 'luxury-office-desk', name: 'Luxury Office Desk', description: 'Executive desk with integrated storage',
    category: 'Office', price: rp(9_800_000), old_price: null, image: img(3), created_at: '2025-02-27' },

  // ── Outdoor ─────────────────────────────────────────────────────────────────────────
  { id: 34, slug: 'outdoor-patio-set', name: 'Outdoor Patio Set', description: 'Weatherproof table with four chairs',
    category: 'Outdoor', price: rp(6_400_000), old_price: null, image: img(4), created_at: '2026-08-18' },
  { id: 35, slug: 'outdoor-swing-chair', name: 'Outdoor Swing Chair', description: 'Hanging rattan chair with cushion',
    category: 'Outdoor', price: rp(5_200_000), old_price: null, image: img(3), created_at: '2026-08-30' },
  { id: 36, slug: 'outdoor-garden-bench', name: 'Outdoor Garden Bench', description: 'Two-seat bench in treated teak',
    category: 'Outdoor', price: rp(3_600_000), old_price: null, image: img(4), created_at: '2025-04-21' },

  // ── Decor ───────────────────────────────────────────────────────────────────────────
  { id: 37, slug: 'wall-mounted-shelf', name: 'Wall Mounted Shelf', description: 'Floating shelf with hidden brackets',
    category: 'Decor', price: rp(1_500_000), old_price: null, image: img(4), created_at: '2026-08-15' },
  { id: 38, slug: 'accent-wall-mirror', name: 'Accent Wall Mirror', description: 'Round mirror in a brass frame',
    category: 'Decor', price: rp(2_100_000), old_price: null, image: img(3), created_at: '2025-06-25' },
  { id: 39, slug: 'modern-floor-lamp', name: 'Modern Floor Lamp', description: 'Arc floor lamp with fabric shade',
    category: 'Decor', price: rp(1_900_000), old_price: null, image: img(2), created_at: '2025-05-06' },

  // ── Storage ─────────────────────────────────────────────────────────────────────────
  { id: 40, slug: 'modern-shoe-rack', name: 'Modern Shoe Rack', description: 'Four-tier rack with a bench top',
    category: 'Storage', price: rp(2_200_000), old_price: null, image: img(2), created_at: '2025-04-02' },
];

/**
 * The home-page strip. A CURATED list, not a filter — `.slice(0, 8)` would silently change
 * the home page whenever the catalogue is reordered. See docs/API.md, GET /api/products/featured.
 */
export const FEATURED_SLUGS = [
  'syltherine', 'leviosa', 'lolito', 'respira', 'grifo', 'muggo', 'pingky', 'potty',
];
