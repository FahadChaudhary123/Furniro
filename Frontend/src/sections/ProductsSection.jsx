import { Link } from "react-router-dom";
import { useFeaturedProducts, badgeFor, discountFor } from "../modules/catalogue";
import { useCart } from "../modules/cart";
import { formatPrice } from "../shared/lib/money";
import { ProductGridSkeleton, CatalogueError } from "../components/CatalogueState";
import Picture from "../shared/ui/Picture";

const ProductsSection = () => {
  const { products, loading, error, retry } = useFeaturedProducts();
  const { add } = useCart();

  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      <h2 className="text-3xl font-semibold text-center mb-12">
        Our Products
      </h2>

      {error ? (
        <CatalogueError error={error} onRetry={retry} />
      ) : loading ? (
        <ProductGridSkeleton count={8} />
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {products.map((item) => {
          const badge = badgeFor(item);
          const discount = discountFor(item);

          return (
            <div
              key={item.id}
              className="group relative bg-[#F4F5F7] overflow-hidden"
            >
              {/* Badge — derived, never stored. See modules/catalogue/lib/badge.js */}
              {badge && (
                <span
                  className={`absolute top-4 right-4 z-10 text-white text-sm px-3 py-1 rounded-full
                  ${badge.kind === "new" ? "bg-teal-700" : "bg-red-600"}`}
                >
                  {badge.label}
                </span>
              )}

              {/* Image */}
              <Picture
                src={item.image.src}
                webp={item.image.webp}
                alt={item.name}
                loading="lazy"
                className="w-full h-72 object-cover"
              />

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/50 flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => add(item.slug)}
                  aria-label={`Add ${item.name} to cart`}
                  className="bg-white text-[#B88E2F] px-6 py-2 mb-4 font-semibold"
                >
                  Add to cart
                </button>

                {/* Removed: Share, Compare and Like were <span>s with `cursor-pointer` —
                    they showed a hand cursor and did nothing. See ProductCard.jsx. */}
              </div>

              {/* Content */}
              <div className="p-4 bg-[#F4F5F7]">
                <h3 className="text-lg font-semibold">{item.name}</h3>
                <p className="text-sm text-gray-600 mb-2">{item.description}</p>

                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatPrice(item.price)}</span>
                  {/* PROMO-05 — see ProductCard.jsx. */}
                  {discount && (
                    <span className="text-sm text-gray-600 line-through">
                      {formatPrice(discount.oldPrice)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Show More */}
      <div className="text-center mt-12">
        <Link
          to="/shop"
          className="inline-block border border-[#B88E2F] text-[#B88E2F] px-10 py-3 font-semibold hover:bg-[#B88E2F] hover:text-white transition"
        >
          Show More
        </Link>
      </div>
    </section>
  );
};

export default ProductsSection;
