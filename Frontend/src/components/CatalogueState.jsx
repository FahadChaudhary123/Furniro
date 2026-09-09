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

/**
 * The empty result — `SRCH-06`.
 *
 * Doc B §7 R7 asks for a fall back to category browse rather than an empty result. This was
 * one line of grey text and nothing else: a customer who searched for something the shop
 * does not stock reached a dead end and their only move was the back button.
 *
 * `actions` are the routes onward. They are offered rather than taken automatically —
 * silently widening someone's search and showing them different products is worse than
 * saying nothing, because the results then look like an answer to the question they asked.
 *
 * `categories` come last and always: even with no idea what to suggest, "here is everything
 * we do sell, by room" beats a full stop.
 */
export const CatalogueEmpty = ({
  message = 'No products match that selection.',
  actions = [],
  categories = [],
  onCategory,
}) => (
  <div className="py-16 text-center">
    <p className="text-gray-600">{message}</p>

    {actions.length > 0 && (
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="border border-[#B88E2F] text-[#B88E2F] px-5 py-2 text-sm font-medium hover:bg-[#B88E2F] hover:text-white transition"
          >
            {action.label}
          </button>
        ))}
      </div>
    )}

    {categories.length > 0 && (
      <div className="mt-10">
        <p className="text-sm text-gray-600">Or browse by room:</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <button
              key={category.slug}
              onClick={() => onCategory?.(category.slug)}
              className="border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:border-[#B88E2F] hover:text-[#B88E2F] transition"
            >
              {category.name}
              {typeof category.product_count === 'number' && (
                <span className="ml-1.5 text-gray-500">({category.product_count})</span>
              )}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);
