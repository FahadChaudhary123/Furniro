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
          <User className="cursor-pointer hover:text-[#B88E2F] transition" size={20} />
          <Link to="/shop" aria-label="Search products" className="hover:text-[#B88E2F] transition">
            <Search size={20} />
          </Link>
          <Heart className="cursor-pointer hover:text-[#B88E2F] transition" size={20} />
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
          <button
            className="md:hidden focus:outline-none"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isOpen && (
        <ul className="md:hidden flex flex-col gap-4 px-6 pb-4 text-sm font-medium text-black bg-white shadow">
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
