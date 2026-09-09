/**
 * Loading and error presentation shared by every catalogue surface.
 *
 * Once data comes over a network, "it renders" is no longer the only case. A failed fetch
 * must say so and offer a way forward — a blank grid reads as an empty catalogue, which is
 * a worse lie than an error message.
 */

/** Skeleton cards. Matches the real grid's shape so the layout does not jump on load. */
export const ProductGridSkeleton = ({ count = 8 }) => (
  <div
    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
    aria-busy="true"
    aria-label="Loading products"
  >
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="h-64 bg-gray-200 rounded-lg" />
        <div className="mt-4 h-4 w-2/3 bg-gray-200 rounded" />
        <div className="mt-2 h-3 w-1/3 bg-gray-200 rounded" />
        <div className="mt-3 h-4 w-1/2 bg-gray-200 rounded" />
      </div>
    ))}
  </div>
);

export const CatalogueError = ({ error, onRetry }) => (
  <div
    role="alert"
    className="border border-red-200 bg-red-50 rounded-lg p-8 text-center max-w-xl mx-auto"
  >
    <h3 className="font-semibold text-gray-900">Products could not be loaded</h3>
    <p className="mt-2 text-sm text-gray-600">
      {error?.message ?? 'Something went wrong.'}
    </p>

    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-5 bg-[#B88E2F] text-white px-6 py-2 font-semibold hover:bg-[#a57f28] transition"
      >
        Try again
      </button>
    )}

    {/* Ties the failure to a server log line — the first thing to quote in a bug report. */}
    {error?.correlationId && (
      <p className="mt-4 text-xs text-gray-600">Reference: {error.correlationId}</p>
    )}
  </div>
);

export const CatalogueEmpty = ({ message = 'No products match that selection.' }) => (
  <p className="text-center text-gray-500 py-16">{message}</p>
);
