import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useCart, MAX_LINE_QUANTITY } from '../modules/cart';
import { formatPrice } from '../shared/lib/money';
import { usePageMeta } from '../shared/lib/usePageMeta.js';
import PageBanner from '../components/PageBanner';
import { CatalogueError } from '../components/CatalogueState';
import FeaturesSection from '../sections/FeaturesSection';
import Footer from '../components/Footer';
import Picture from '../shared/ui/Picture';

/**
 * The cart.
 *
 * The subtotal here is a DISPLAY figure computed from server prices. It is not sent
 * anywhere. When checkout exists, the order total is recomputed server-side from
 * `product_id` and `quantity` — a total submitted by the client is a number the buyer
 * chose. See docs/API.md#cart-and-checkout.
 */
const Cart = () => {
  const { items, count, subtotal, hydrating, error, setQuantity, remove, clear } = useCart();
  usePageMeta('/cart');

  return (
    <div>
      <PageBanner title="Cart" trail={[{ label: 'Home', to: '/' }, { label: 'Cart' }]} />

      <section className="max-w-7xl mx-auto px-4 py-16">
        {error ? (
          <CatalogueError error={error} />
        ) : count === 0 ? (
          <div className="text-center py-16">
            <h2 className="text-2xl font-semibold text-gray-900">Your cart is empty</h2>
            <p className="mt-3 text-gray-600">Nothing here yet.</p>
            <Link
              to="/shop"
              className="mt-8 inline-block bg-[#B88E2F] text-white px-8 py-3 font-semibold hover:bg-[#a57924] transition"
            >
              Browse the shop
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-10">
            {/* Lines */}
            <div className="lg:col-span-2">
              {/*
                The table REFLOWS on mobile rather than scrolling sideways: rows become
                stacked blocks and the header is dropped. At a 393px viewport the columns
                crushed together until the quantity input overlapped the remove button and
                swallowed its clicks — a phone user could not remove a line from their cart.
                One DOM tree, restructured by CSS, so nothing is duplicated.
              */}
              <table className="w-full text-left block md:table">
                <caption className="sr-only">Items in your cart</caption>
                <thead className="bg-[#F9F1E7] text-sm hidden md:table-header-group">
                  <tr>
                    <th scope="col" className="py-4 px-4 font-medium">Product</th>
                    <th scope="col" className="py-4 px-4 font-medium">Price</th>
                    <th scope="col" className="py-4 px-4 font-medium">Quantity</th>
                    <th scope="col" className="py-4 px-4 font-medium">Subtotal</th>
                    <th scope="col" className="py-4 px-4"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody className={`block md:table-row-group ${hydrating ? 'opacity-60' : ''}`}>
                  {items.map(({ slug, quantity, product, lineTotal }) => (
                    <tr
                      key={slug}
                      data-testid="cart-line"
                      className="border-b border-gray-100 block md:table-row py-4 md:py-0"
                    >
                      <td className="block md:table-cell py-2 md:py-6 px-4">
                        <div className="flex items-center gap-4">
                          <Picture
                            src={product.image.src}
                            webp={product.image.webp}
                            alt=""
                            className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                          />
                          <Link
                            to={`/shop/${slug}`}
                            className="text-gray-700 hover:text-[#B88E2F] transition"
                          >
                            {product.name}
                          </Link>
                        </div>
                      </td>
                      <td className="block md:table-cell py-2 md:py-6 px-4 text-gray-500">
                        <span className="md:hidden text-xs text-gray-600 mr-2">Price</span>
                        {formatPrice(product.price)}
                      </td>
                      <td className="block md:table-cell py-2 md:py-6 px-4">
                        <label className="sr-only" htmlFor={`qty-${slug}`}>
                          Quantity for {product.name}
                        </label>
                        <input
                          id={`qty-${slug}`}
                          type="number"
                          min="1"
                          max={MAX_LINE_QUANTITY}
                          value={quantity}
                          onChange={(e) => setQuantity(slug, Number(e.target.value))}
                          className="w-16 border rounded px-2 py-1 text-center"
                        />
                      </td>
                      <td className="block md:table-cell py-2 md:py-6 px-4 font-medium">
                        <span className="md:hidden text-xs text-gray-600 font-normal mr-2">
                          Subtotal
                        </span>
                        {formatPrice(lineTotal)}
                      </td>
                      <td className="block md:table-cell py-2 md:py-6 px-4">
                        <button
                          onClick={() => remove(slug)}
                          aria-label={`Remove ${product.name} from cart`}
                          className="flex items-center gap-2 text-gray-600 hover:text-red-500 transition"
                        >
                          <Trash2 size={18} />
                          <span className="md:hidden text-sm">Remove</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                onClick={clear}
                className="mt-6 text-sm text-gray-500 hover:text-red-500 transition"
              >
                Clear cart
              </button>
            </div>

            {/* Totals */}
            <aside className="bg-[#F9F1E7] p-8 rounded-lg h-fit">
              <h2 className="text-2xl font-semibold text-center mb-8">Cart Totals</h2>

              <div className="flex justify-between text-sm mb-4">
                <span className="text-gray-600">Items</span>
                <span data-testid="cart-count">{count}</span>
              </div>

              <div className="flex justify-between mb-8">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold text-[#B88E2F]" data-testid="cart-subtotal">
                  {formatPrice(subtotal)}
                </span>
              </div>

              <p className="text-xs text-gray-500 mb-6">
                Shipping and tax are calculated at checkout.
              </p>

              {/* No checkout exists — see docs/MODULES.md#build-order. Disabled rather than
                  a button that silently does nothing. */}
              <button
                disabled
                title="Checkout is not available yet"
                className="w-full border border-gray-300 text-gray-600 px-8 py-3 font-semibold rounded cursor-not-allowed"
              >
                Checkout — coming soon
              </button>

              <p className="mt-6 text-center">
                <Link to="/shop" className="text-sm text-gray-500 hover:text-[#B88E2F] transition">
                  ← Continue shopping
                </Link>
              </p>
            </aside>
          </div>
        )}
      </section>

      <FeaturesSection />
      <Footer />
    </div>
  );
};

export default Cart;
