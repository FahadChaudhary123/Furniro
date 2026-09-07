import { useState, useEffect, useMemo } from 'react';
import ProductCard from './ProductCard';
import { getAllProducts, sortProducts, SORT_OPTIONS } from '../modules/catalogue';

const PAGE_SIZE_OPTIONS = [16, 32, 48];

const ProductGrid = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState('default');
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const allProducts = getAllProducts();

  // Sorting returns a new array; `products` is module state and must not be sorted in place.
  const sorted = useMemo(() => sortProducts(allProducts, sortKey), [allProducts, sortKey]);

  const totalProducts = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));

  // Changing sort or page size can leave you past the last page.
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * pageSize;
  const visibleProducts = sorted.slice(startIndex, startIndex + pageSize);

  // Reset to page 1 in the handlers rather than in an effect: the reset is a consequence of
  // the interaction, not of the render. `page` above is clamped, so this is belt-and-braces.
  const changeSort = (key) => {
    setSortKey(key);
    setCurrentPage(1);
  };
  const changePageSize = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Scroll to top on page change (UX polish)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
        <p className="text-sm text-gray-500">
          Showing {totalProducts === 0 ? 0 : startIndex + 1}–
          {Math.min(startIndex + pageSize, totalProducts)} of {totalProducts} results
        </p>

        <div className="flex gap-3">
          <label className="sr-only" htmlFor="sort">Sort products</label>
          <select
            id="sort"
            value={sortKey}
            onChange={(e) => changeSort(e.target.value)}
            className="border px-3 py-2 text-sm rounded"
          >
            {Object.entries(SORT_OPTIONS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <label className="sr-only" htmlFor="page-size">Products per page</label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => changePageSize(Number(e.target.value))}
            className="border px-3 py-2 text-sm rounded"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>Show {n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-12 gap-2">
          {Array.from({ length: totalPages }).map((_, i) => {
            const n = i + 1;
            return (
              <button
                key={n}
                onClick={() => setCurrentPage(n)}
                aria-current={page === n ? 'page' : undefined}
                className={`px-4 py-2 rounded transition
                  ${page === n ? 'bg-amber-600 text-white' : 'border hover:bg-gray-100'}`}
              >
                {n}
              </button>
            );
          })}

          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
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
