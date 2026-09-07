import { useParams, Link } from 'react-router-dom';
import { useProduct, badgeFor } from '../modules/catalogue';
import { useCart } from '../modules/cart';
import { formatPrice } from '../shared/lib/money';
import { useDocumentTitle } from '../shared/lib/useDocumentTitle';
import PageBanner from '../components/PageBanner';
import { CatalogueError } from '../components/CatalogueState';
import FeaturesSection from '../sections/FeaturesSection';
import Footer from '../components/Footer';

/**
 * Product detail — `CAT-07`, a stable indexable URL per product.
 *
 * Uses the slug, not the id, so URLs survive a reseed and read as something a person would
 * share. `GET /api/products/:slug` has existed since the catalogue module landed; this is
 * the first thing to consume it.
 */
const ProductDetail = () => {
  const { slug } = useParams();
  const { product, notFound, loading, error, retry } = useProduct(slug);
  const { add } = useCart();

  useDocumentTitle(product?.name ?? (notFound ? 'Product not found' : 'Shop'));

  const badge = product ? badgeFor(product) : null;

  return (
    <div>
      <PageBanner
        title={product?.name ?? (notFound ? 'Not found' : 'Shop')}
        trail={[
          { label: 'Home', to: '/' },
          { label: 'Shop', to: '/shop' },
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
              to="/shop"
              className="mt-8 inline-block bg-[#B88E2F] text-white px-8 py-3 font-semibold hover:bg-[#a57924] transition"
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
                  ${badge.kind === 'new' ? 'bg-teal-400' : 'bg-red-400'}`}
                >
                  {badge.label}
                </span>
              )}
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-96 object-cover"
              />
            </div>

            {/* Detail */}
            <div>
              <h2 className="text-3xl font-semibold text-gray-900">{product.name}</h2>

              <div className="mt-4 flex items-center gap-3">
                <span className="text-2xl font-semibold text-gray-900">
                  {formatPrice(product.price)}
                </span>
                {product.old_price && (
                  <span className="text-lg text-gray-400 line-through">
                    {formatPrice(product.old_price)}
                  </span>
                )}
              </div>

              <p className="mt-6 text-gray-600 leading-relaxed">{product.description}</p>

              <dl className="mt-8 space-y-2 text-sm">
                <div className="flex gap-3">
                  <dt className="text-gray-400 w-24">Category</dt>
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
                  <dt className="text-gray-400 w-24">SKU</dt>
                  <dd className="text-gray-700">{product.slug}</dd>
                </div>
              </dl>

              <button
                onClick={() => add(product.slug)}
                className="mt-10 border border-[#B88E2F] text-[#B88E2F] px-10 py-3 font-semibold hover:bg-[#B88E2F] hover:text-white transition"
              >
                Add to cart
              </button>

              <p className="mt-8">
                <Link to="/shop" className="text-sm text-gray-500 hover:text-[#B88E2F] transition">
                  ← Back to shop
                </Link>
              </p>
            </div>
          </div>
        )}
      </section>

      <FeaturesSection />
      <Footer />
    </div>
  );
};

export default ProductDetail;
