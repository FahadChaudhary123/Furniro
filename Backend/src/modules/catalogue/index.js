/**
 * Catalogue module — public interface.
 *
 * The only file other modules and the composition root may import from `catalogue`.
 * Deep imports into ./service.js or ./repository.js break the boundary that keeps the
 * data layer swappable. See docs/MODULES.md#boundary-rules.
 *
 * Owns requirements CAT-01..CAT-10 (docs/REQUIREMENTS.md).
 */

export { productsRouter, categoriesRouter } from './routes.js';

// Read access for other modules — cart and checkout will need product lookups. They call
// these, never the repository.
export { getBySlug, listProducts, getFeatured, listCategories } from './service.js';
