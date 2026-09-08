const Footer = () => {
  return (
    <footer className="bg-white text-gray-700">
      <div className="max-w-6xl mx-auto py-12 px-6 md:flex md:justify-between md:items-start gap-8">
        
        {/* Left Section: Logo & Address */}
        <div className="mb-8 md:mb-0 md:w-1/3">
          {/* Not an <h1>: a footer brand mark is not the page's main heading, and having
              one on every page gave every page two h1s. "Jump to main heading" then lands
              in the footer half the time. Styled the same, announced correctly. */}
          <p className="text-xl font-bold mb-4">Funiro.</p>
          <p className="text-sm text-gray-600">
            400 University Drive Suite 200 Coral Gables,<br />
            FL 33134 USA
          </p>
        </div>

        {/* Middle Section: Links */}
        <div className="mb-8 md:mb-0 md:w-1/3 flex justify-between">
          <div>
            <h3 className="text-gray-600 text-sm mb-4">Links</h3>
            <ul className="space-y-2 text-sm">
              <li className="hover:text-black cursor-pointer">Home</li>
              <li className="hover:text-black cursor-pointer">Shop</li>
              <li className="hover:text-black cursor-pointer">About</li>
              <li className="hover:text-black cursor-pointer">Contact</li>
            </ul>
          </div>
          <div>
            <h3 className="text-gray-600 text-sm mb-4">Help</h3>
            <ul className="space-y-2 text-sm">
              <li className="hover:text-black cursor-pointer">Payment Options</li>
              <li className="hover:text-black cursor-pointer">Returns</li>
              <li className="hover:text-black cursor-pointer">Privacy Policies</li>
            </ul>
          </div>
        </div>

        {/* Right Section: Newsletter */}
        <div className="md:w-1/3 md:pl-8">
          <h3 className="text-gray-600 text-sm mb-4">Newsletter</h3>
          <div className="flex border-b border-gray-300">
            <input
              type="email"
              placeholder="Enter Your Email Address"
              className="flex-1 px-4 py-1 outline-none text-sm text-gray-700"
            />
            <button className="text-sm font-bold px-4">SUBSCRIBE</button>
          </div>
        </div>
      </div>

      {/* Bottom Line */}
      <div className="border-t border-gray-200 text-gray-600 text-xs text-center py-4">
        2023 Funiro. All rights reserved
      </div>
    </footer>
  );
};

export default Footer;
