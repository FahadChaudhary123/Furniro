import { badgeFor } from '../modules/catalogue';
import { formatPrice } from '../shared/lib/money';

const ProductCard = ({ product }) => {
  const badge = badgeFor(product);

  return (
    <div className="group relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition">
      {/* Badge — derived from price and age, never stored. See modules/catalogue/lib/badge.js */}
      {badge && (
        <span
          className={`absolute top-3 left-3 z-10 text-xs px-2 py-1 rounded-full text-white
          ${badge.kind === 'new' ? 'bg-emerald-500' : 'bg-red-500'}`}
        >
          {badge.label}
        </span>
      )}

      {/* Image */}
      <div className="relative h-64 bg-gray-100 flex items-center justify-center">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />

        {/* Hover actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2">
          <button className="bg-white text-sm px-4 py-2 rounded hover:bg-gray-100">
            Add to cart
          </button>
          <div className="flex gap-3 text-white text-sm">
            <span>Share</span>
            <span>Compare</span>
            <span>Like</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-gray-800">{product.name}</h3>
        <p className="text-sm text-gray-500">{product.category}</p>

        <div className="mt-2 flex items-center gap-2">
          <span className="font-semibold text-gray-900">
            {formatPrice(product.price)}
          </span>
          {product.old_price && (
            <span className="text-sm text-gray-400 line-through">
              {formatPrice(product.old_price)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
