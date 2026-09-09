import { useState } from "react";
import { User, Search, Heart, ShoppingCart, Menu, X } from "lucide-react";
import logo from "../assets/logo.svg";
import { Link } from "react-router-dom";
import { useCart } from "../modules/cart";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { count } = useCart();

  return (
    <header className="w-full bg-white shadow">
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Furniro Logo" className="w-10 h-10 object-contain" />
          <span className="text-xl font-bold text-black">Furniro</span>
        </Link>

        {/* Nav Links - Desktop */}
        <ul className="hidden md:flex items-center gap-10 text-sm font-medium text-black">
          <li>
            <Link to="/" className="hover:text-[#B88E2F] transition">
              Home
            </Link>
          </li>
          <li>
            <Link to="/shop" className="hover:text-[#B88E2F] transition">
              Shop
            </Link>
          </li>
          <li>
            <Link to="/about" className="hover:text-[#B88E2F] transition">
              About
            </Link>
          </li>
          <li>
            <Link to="/contact" className="hover:text-[#B88E2F] transition">
              Contact
            </Link>
          </li>
        </ul>

        {/* Icons + Hamburger */}
        <div className="flex items-center gap-4 md:gap-6">
          {/*
            Decorative, and marked as such. There are no accounts (`identity` is unbuilt), so
            this icon has nothing to open.

            It previously carried `cursor-pointer` and a hover colour, which is the visual
            vocabulary of a control — a visitor moved the mouse over it, saw it respond, and
            clicked on nothing. It is not a <button> or a <Link>, so keyboard users could
            never reach it and a screen reader announced it as an unlabelled graphic.

            `aria-hidden` because it conveys nothing a screen reader needs; no pointer
            styling because it does nothing a mouse user can use. When accounts exist this
            becomes a real <Link> and the styling comes back with it.
          */}
          <User aria-hidden="true" className="text-gray-400" size={20} />
          <Link to="/shop" aria-label="Search products" className="hover:text-[#B88E2F] transition">
            <Search size={20} />
          </Link>
          {/* Same: there is no wishlist. See the note on the account icon above. */}
          <Heart aria-hidden="true" className="text-gray-400" size={20} />
          <Link
            to="/cart"
            className="relative hover:text-[#B88E2F] transition"
            aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart, empty'}
          >
            <ShoppingCart size={20} />
            {count > 0 && (
              <span
                data-testid="cart-badge"
                className="absolute -top-2 -right-2 bg-[#B88E2F] text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>

          {/* Hamburger - Mobile */}
          {/* The icon is the only content, so without a label a screen reader announces
              this as "button" — on mobile, where it is the ONLY way to reach any other
              page. `focus:outline-none` removes the focus ring, so a visible replacement
              is required, not optional. */}
          <button
            className="md:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B88E2F] focus-visible:ring-offset-2 rounded"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isOpen && (
        <ul
          id="mobile-menu"
          className="md:hidden flex flex-col gap-4 px-6 pb-4 text-sm font-medium text-black bg-white shadow"
        >
          <li>
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
              className="hover:text-[#B88E2F] transition"
            >
              Home
            </Link>
          </li>
          <li>
            <Link
              to="/shop"
              onClick={() => setIsOpen(false)}
              className="hover:text-[#B88E2F] transition"
            >
              Shop
            </Link>
          </li>
          <li>
            <Link
              to="/about"
              onClick={() => setIsOpen(false)}
              className="hover:text-[#B88E2F] transition"
            >
              About
            </Link>
          </li>
          <li>
            <Link
              to="/contact"
              onClick={() => setIsOpen(false)}
              className="hover:text-[#B88E2F] transition"
            >
              Contact
            </Link>
          </li>
        </ul>
      )}
    </header>
  );
};

export default Navbar;
