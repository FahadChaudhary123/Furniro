import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import ProductCard from './ProductCard';
import { ProductGridSkeleton, CatalogueError, CatalogueEmpty } from './CatalogueState';
import { useProducts, useCategories, SORT_OPTIONS, DEFAULT_SORT } from '../modules/catalogue';

const PAGE_SIZE_OPTIONS = [16, 32, 48];
const DEFAULT_LIMIT = PAGE_SIZE_OPTIONS[0];

/**
 * The shop.
 *
 * State lives in the URL, not in the component. That is what makes a filtered view
 * shareable and bookmarkable, makes the browser's back button work through filter changes,
 * and lets anything else link into a filtered shop — the category link on every product
 * page pointed at `/shop?category=…` and did nothing at all while this was `useState`.
 *
 * Every parameter maps onto one the API already accepts, so the client never filters or
 * sorts a page it has fetched; it asks the server for the page it wants.
 */
const ProductGrid = () => {
  const [params, setParams] = useSearchParams();

  const category = params.get('category') ?? null;
  const q = params.get('q') ?? '';
  const sort = params.get('sort') ?? DEFAULT_SORT;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const limit = PAGE_SIZE_OPTIONS.includes(Number(params.get('limit')))
    ? Number(params.get('limit'))
    : DEFAULT_LIMIT;

  const { products, meta, loading, error, retry } = useProducts({ page, limit, sort, category, q });
  const { categories } = useCategories();

  /**
   * Write params, dropping any that equal their default so the URL stays readable.
   * Any change other than paging returns to page 1 — page 4 of a new filter is meaningless.
   */
  const update = (changes, { resetPage = true } = {}) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || value === undefined) next.delete(key);
      else next.set(key, String(value));
    }
    if (resetPage) next.delete('page');
    if (next.get('sort') === DEFAULT_SORT) next.delete('sort');
    if (Number(next.get('limit')) === DEFAULT_LIMIT) next.delete('limit');
    setParams(next);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  const total = meta?.total ?? 0;
  const totalPages = meta?.total_pages ?? 1;
  const start = (page - 1) * limit;
  const activeCategory = categories.find((c) => c.slug === category);
  const hasFilters = Boolean(category || q);

  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      {/* Search */}
      <form
        role="search"
        className="mb-8 flex gap-3 max-w-lg"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: new FormData(e.currentTarget).get('q')?.toString().trim() || null });
        }}
      >
        <label className="sr-only" htmlFor="product-search">Search products</label>
        <div className="relative flex-1">
          <input
            id="product-search"
            name="q"
            type="search"
            /* Remounts when the URL changes, so the box reflects the back button. */
            key={q}
            defaultValue={q}
            placeholder="Search products…"
            className="w-full border border-gray-300 rounded-lg py-2 pl-4 pr-10 focus:outline-none focus:ring-1 focus:ring-[#B88E2F]"
          />
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600" />
        </div>
        <button
          type="submit"
          className="bg-[#B88E2F] text-white px-6 py-2 rounded font-medium hover:bg-[#a57924] transition"
        >
          Search
        </button>
      </form>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => update({ category: null })}
            aria-pressed={!category}
            className={`px-4 py-1.5 text-sm rounded-full border transition ${
              !category ? 'bg-[#B88E2F] text-white border-[#B88E2F]' : 'hover:bg-gray-100'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => update({ category: c.slug })}
              aria-pressed={category === c.slug}
              className={`px-4 py-1.5 text-sm rounded-full border transition ${
                category === c.slug
                  ? 'bg-[#B88E2F] text-white border-[#B88E2F]'
                  : 'hover:bg-gray-100'
              }`}
            >
              {c.name} <span className="opacity-60">({c.product_count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-gray-500">
            {loading && !meta
              ? 'Loading products…'
              : `Showing ${total === 0 ? 0 : start + 1}–${Math.min(start + limit, total)} of ${total} results`}
          </p>

          {hasFilters && (
            <button
              onClick={() => update({ category: null, q: null })}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#B88E2F] transition"
            >
              <X size={14} /> Clear filters
            </button>
          )}
        </div>

        <div className="flex gap-3">
          <label className="sr-only" htmlFor="sort">Sort products</label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => update({ sort: e.target.value })}
            disabled={Boolean(error)}
            className="border px-3 py-2 text-sm rounded disabled:opacity-50"
          >
            {Object.entries(SORT_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <label className="sr-only" htmlFor="page-size">Products per page</label>
          <select
            id="page-size"
            value={limit}
            onChange={(e) => update({ limit: Number(e.target.value) })}
            disabled={Boolean(error)}
            className="border px-3 py-2 text-sm rounded disabled:opacity-50"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>Show {n}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <CatalogueError error={error} onRetry={retry} />
      ) : loading && products.length === 0 ? (
        <ProductGridSkeleton count={Math.min(limit, 16)} />
      ) : products.length === 0 ? (
        <CatalogueEmpty
          message={
            q && activeCategory
              ? `No products match “${q}” in ${activeCategory.name}.`
              : q
                ? `No products match “${q}”.`
                : activeCategory
                  ? `Nothing in ${activeCategory.name} right now.`
                  : 'No products match that selection.'
          }
        />
      ) : (
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 transition-opacity ${
            loading ? 'opacity-60' : ''
          }`}
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!error && totalPages > 1 && (
        <div className="flex justify-center mt-12 gap-2">
          {Array.from({ length: totalPages }).map((_, i) => {
            const n = i + 1;
            return (
              <button
                key={n}
                onClick={() => update({ page: n === 1 ? null : n }, { resetPage: false })}
                aria-current={page === n ? 'page' : undefined}
                className={`px-4 py-2 rounded transition
                  ${page === n ? 'bg-amber-600 text-white' : 'border hover:bg-gray-100'}`}
              >
                {n}
              </button>
            );
          })}

          <button
            onClick={() => update({ page: Math.min(page + 1, totalPages) }, { resetPage: false })}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
};

export default ProductGrid;
