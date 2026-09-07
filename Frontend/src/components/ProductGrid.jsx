import { useState, useEffect } from 'react';
import ProductCard from './ProductCard';
import { ProductGridSkeleton, CatalogueError, CatalogueEmpty } from './CatalogueState';
import { useProducts, SORT_OPTIONS, DEFAULT_SORT } from '../modules/catalogue';

const PAGE_SIZE_OPTIONS = [16, 32, 48];

const ProductGrid = () => {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [limit, setLimit] = useState(PAGE_SIZE_OPTIONS[0]);

  // Paging, sorting and filtering happen server-side. Fetching everything and sorting in
  // the browser stops working the moment the catalogue outgrows a single page.
  const { products, meta, loading, error, retry } = useProducts({ page, limit, sort });

  // Scroll to top on page change (UX polish)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  // Reset paging in the handlers, not an effect: it is a consequence of the interaction.
  const changeSort = (value) => {
    setSort(value);
    setPage(1);
  };
  const changePageSize = (value) => {
    setLimit(value);
    setPage(1);
  };

  const total = meta?.total ?? 0;
  const totalPages = meta?.total_pages ?? 1;
  const start = (page - 1) * limit;

  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
        <p className="text-sm text-gray-500">
          {loading && !meta
            ? 'Loading products…'
            : `Showing ${total === 0 ? 0 : start + 1}–${Math.min(start + limit, total)} of ${total} results`}
        </p>

        <div className="flex gap-3">
          <label className="sr-only" htmlFor="sort">Sort products</label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => changeSort(e.target.value)}
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
            onChange={(e) => changePageSize(Number(e.target.value))}
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
        <ProductGridSkeleton count={limit > 16 ? 16 : limit} />
      ) : products.length === 0 ? (
        <CatalogueEmpty />
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
                onClick={() => setPage(n)}
                aria-current={page === n ? 'page' : undefined}
                className={`px-4 py-2 rounded transition
                  ${page === n ? 'bg-amber-600 text-white' : 'border hover:bg-gray-100'}`}
              >
                {n}
              </button>
            );
          })}

          <button
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
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
