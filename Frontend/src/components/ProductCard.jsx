import { Link } from 'react-router-dom';
import { badgeFor, discountFor } from '../modules/catalogue';
import { useCart } from '../modules/cart';
import { formatPrice } from '../shared/lib/money';
import Picture from '../shared/ui/Picture';

const ProductCard = ({ product }) => {
  const badge = badgeFor(product);
  const discount = discountFor(product);
  const { add } = useCart();

  return (
    <div className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition">
      {/* Badge — derived from price and age, never stored. See modules/catalogue/lib/badge.js */}
      {badge && (
        <span
          className={`absolute top-3 left-3 z-10 text-xs px-2 py-1 rounded-full text-white
          ${badge.kind === 'new' ? 'bg-emerald-700' : 'bg-red-600'}`}
        >
          {badge.label}
        </span>
      )}

      {/* Image */}
      <div className="relative h-64 bg-gray-100 flex items-center justify-center">
        {/* The image and the title both link to the product. Screen-reader and keyboard
            users should not meet the same destination twice in a row, so the image link is
            hidden from the accessibility tree and skipped in the tab order; the title link
            is the accessible one. */}
        <Link
          to={`/shop/${product.slug}`}
          className="block h-full w-full"
          aria-hidden="true"
          tabIndex={-1}
        >
          <Picture
            src={product.image.src}
            webp={product.image.webp}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </Link>

        {/* Hover actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2">
          <button
            onClick={() => add(product.slug)}
            aria-label={`Add ${product.name} to cart`}
            className="bg-white text-sm px-4 py-2 rounded hover:bg-gray-100"
          >
            Add to cart
          </button>
          {/* Share, Compare and Like were here as plain <span>s: three action labels for
              three features that do not exist. Not clickable, not focusable, and read out
              by a screen reader as words with no control attached. Removed rather than
              disabled — "Share" as decoration means nothing. They come back when there is a
              wishlist and a comparison view to attach them to. */}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-gray-800">
          <Link to={`/shop/${product.slug}`} className="hover:text-[#B88E2F] transition">
            {product.name}
          </Link>
        </h3>
        {/* The API embeds category as an object ({id, slug, name}), not a string — see
            docs/API.md. Rendering the object itself throws React error #31 and takes the
            whole page down, which is exactly what happened. */}
        <p className="text-sm text-gray-600">{product.category?.name}</p>

        <div className="mt-2 flex items-center gap-2">
          <span className="font-semibold text-gray-900">
            {formatPrice(product.price)}
          </span>
          {/* PROMO-05: the struck-through price is the promotional claim, so it is
              driven by the same `discountFor` the badge uses. Checking `old_price`
              directly would keep promoting an offer whose expiry has passed. */}
          {discount && (
            <span className="text-sm text-gray-600 line-through">
              {formatPrice(discount.oldPrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
