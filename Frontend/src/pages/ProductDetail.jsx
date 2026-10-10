import { useState } from 'react';
import { useParams, useLocation, Link, Navigate } from 'react-router-dom';
import { useProduct, badgeFor, discountFor } from '../modules/catalogue';
import { useCart, MAX_LINE_QUANTITY } from '../modules/cart';
import { formatPrice } from '../shared/lib/money';
import { usePageMeta } from '../shared/lib/usePageMeta.js';
import PageBanner from '../components/PageBanner';
import { CatalogueError } from '../components/CatalogueState';
import FeaturesSection from '../sections/FeaturesSection';
import Picture from '../shared/ui/Picture';

/**
 * Product detail — `CAT-07`, a stable indexable URL per product.
 *
 * Uses the slug, not the id, so URLs survive a reseed and read as something a person would
 * share. `GET /api/products/:slug` has existed since the catalogue module landed; this is
 * the first thing to consume it.
 */
const ProductDetail = () => {
  const { slug } = useParams();
  const [invalidQuantitySlug, setInvalidQuantitySlug] = useState(null);
  const location = useLocation();
  const returnTo = typeof location.state?.shopReturnTo === 'string' &&
    (location.state.shopReturnTo === '/shop' || location.state.shopReturnTo.startsWith('/shop?'))
    ? location.state.shopReturnTo
    : '/shop';
  const { product, notFound, gone, redirectTo, loading, error, retry } = useProduct(slug);
  const { add, lines } = useCart();
  const inCart = lines.find((line) => line.slug === slug)?.quantity ?? 0;
  const remaining = MAX_LINE_QUANTITY - inCart;
  const seoTitle = typeof product?.seo_title === 'string' ? product.seo_title.trim() : null;
  const seoDescription = typeof product?.seo_description === 'string'
    ? product.seo_description.trim() : null;

  // A product page that 404s must not stay indexed, and a page still loading has nothing
  // worth indexing either — both emit noindex until there is a real product to describe.
  usePageMeta({
    title: seoTitle || product?.name || (notFound ? 'Product not found' : 'Shop'),
    description: product
      ? seoDescription ||
        `${product.description} — ${product.name} from Furniro. ${product.category?.name ?? ''}`.trim()
      : undefined,
    path: `/shop/${slug}`,
    index: Boolean(product),
  });

  const badge = product ? badgeFor(product) : null;
  const discount = product ? discountFor(product) : null;

  /**
   * CAT-08. A discontinued product redirects to the alternative the API named, rather than
   * rendering a dead end.
   *
   * `replace` matters: without it the discontinued URL stays in history, so the browser's
   * back button returns here, redirects again, and the visitor is trapped.
   *
   * This is the FALLBACK path. The real fix is the 301 in `dist/_redirects`, which the host
   * serves before the app ever loads. A client-side redirect costs a round trip and search
   * engines treat it less reliably — but it works on a host with no redirect support, and
   * it works immediately after a product is discontinued without waiting for a deploy.
   */
  if (gone && redirectTo) return <Navigate to={redirectTo} state={location.state} replace />;

  return (
    <div>
      <PageBanner
        title={product?.name ?? (notFound ? 'Not found' : 'Shop')}
        trail={[
          { label: 'Home', to: '/' },
          { label: 'Shop', to: returnTo },
          { label: product?.name ?? slug },
        ]}
      />

      <section className="max-w-7xl mx-auto px-4 py-16">
        {error ? (
          <CatalogueError error={error} onRetry={retry} />
        ) : notFound ? (
          <div className="text-center py-16" role="alert">
            <h2 className="text-2xl font-semibold text-gray-900">Product not found</h2>
            <p className="mt-3 text-gray-600">
              No product matches “{slug}”. It may have been discontinued.
            </p>
            <Link
              to={returnTo}
              className="mt-8 inline-block bg-[#B88E2F] text-white px-8 py-3 font-semibold hover:bg-[#a57f28] transition"
            >
              Back to shop
            </Link>
          </div>
        ) : loading ? (
          <div className="grid md:grid-cols-2 gap-12 animate-pulse" aria-busy="true">
            <div className="h-96 bg-gray-200 rounded-lg" />
            <div className="space-y-4 pt-6">
              <div className="h-8 w-2/3 bg-gray-200 rounded" />
              <div className="h-6 w-1/3 bg-gray-200 rounded" />
              <div className="h-4 w-full bg-gray-200 rounded" />
              <div className="h-4 w-5/6 bg-gray-200 rounded" />
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-12">
            {/* Image */}
            <div className="relative bg-[#F4F5F7] rounded-lg overflow-hidden">
              {badge && (
                <span
                  className={`absolute top-4 right-4 z-10 text-white text-sm px-3 py-1 rounded-full
                  ${badge.kind === 'new' ? 'bg-teal-700' : 'bg-red-600'}`}
                >
                  {badge.label}
                </span>
              )}
              <Picture
                src={product.image.src}
                webp={product.image.webp}
                avif={product.image.avif}
                alt={product.name}
                className="w-full h-96 object-cover"
              />
            </div>

            {/* Detail */}
            <div>
              <h2 className="text-3xl font-semibold text-gray-900">{product.name}</h2>

              <div className="mt-4 flex items-center gap-3">
                <span className="text-2xl font-semibold text-gray-900">
                  {formatPrice(product.price, product.currency)}
                </span>
                {/* PROMO-05 — see ProductCard.jsx. */}
                {discount && (
                  <span className="text-lg text-gray-600 line-through">
                    {formatPrice(discount.oldPrice, product.currency)}
                  </span>
                )}
              </div>

              <p className="mt-6 text-gray-600 leading-relaxed">{product.description}</p>

              <dl className="mt-8 space-y-2 text-sm">
                <div className="flex gap-3">
                  <dt className="text-gray-600 w-24">Category</dt>
                  <dd>
                    <Link
                      to={`/shop?category=${product.category?.slug}`}
                      className="text-gray-700 hover:text-[#B88E2F] transition"
                    >
                      {product.category?.name}
                    </Link>
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="text-gray-600 w-24">SKU</dt>
                  <dd className="text-gray-700">{product.slug}</dd>
                </div>
              </dl>

              <form className="mt-10 flex flex-wrap items-end gap-3" noValidate onSubmit={(event) => {
                event.preventDefault();
                const quantity = Number(new FormData(event.currentTarget).get('quantity'));
                if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > remaining) {
                  setInvalidQuantitySlug(slug);
                  return;
                }
                add(product.slug, quantity);
                setInvalidQuantitySlug(null);
                event.currentTarget.reset();
              }}>
                <div>
                  <label htmlFor="product-quantity" className="block text-sm text-gray-700">Quantity</label>
                  <input id="product-quantity" name="quantity" type="number" min="1" max={remaining}
                    step="1" defaultValue="1" disabled={remaining === 0}
                    className="mt-1 w-20 rounded border border-gray-300 px-3 py-2 disabled:opacity-50" />
                </div>
                <button type="submit" disabled={remaining === 0}
                  className="border border-[#B88E2F] text-[#B88E2F] px-10 py-3 font-semibold hover:bg-[#B88E2F] hover:text-white transition disabled:cursor-not-allowed disabled:opacity-50">
                  Add to cart
                </button>
                <p className="w-full text-sm text-gray-600">
                  {remaining === 0 ? 'Maximum quantity in cart.' : `${inCart} in cart. You can add ${remaining} more.`}
                </p>
                {invalidQuantitySlug === slug && (
                  <p role="alert" className="w-full text-sm text-red-700">
                    Choose a whole quantity from 1 to {remaining}.
                  </p>
                )}
              </form>

              <p className="mt-8">
                <Link to={returnTo} className="text-sm text-gray-500 hover:text-[#B88E2F] transition">
                  ← Back to shop
                </Link>
              </p>
            </div>
          </div>
        )}
      </section>

      <FeaturesSection />
    </div>
  );
};

export default ProductDetail;
