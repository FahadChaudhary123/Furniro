import ProductCard from "./ProductCard";
import { useState, useEffect } from "react";
// Dummy data (replace with API later)
const PRODUCTS_PER_PAGE = 16;
const products = [
  {
    id: 1,
    title: "Nordic Wooden Chair",
    category: "Living Room",
    price: 2500000,
    oldPrice: 3500000,
    badge: "-30%",
    image: "/images/product1.png",
  },
  {
    id: 2,
    title: "Minimalist Sofa",
    category: "Living Room",
    price: 7200000,
    oldPrice: 9000000,
    badge: "-20%",
    image: "/images/product2.png",
  },
  {
    id: 3,
    title: "Luxury King Bed",
    category: "Bedroom",
    price: 12000000,
    image: "/images/product3.png",
  },
  {
    id: 4,
    title: "Modern Dining Table",
    category: "Dining",
    price: 8500000,
    badge: "New",
    image: "/images/product4.png",
  },
  {
    id: 5,
    title: "Scandinavian Armchair",
    category: "Living Room",
    price: 3100000,
    image: "/images/product1.png",
  },
  {
    id: 6,
    title: "Glass Coffee Table",
    category: "Living Room",
    price: 2700000,
    image: "/images/product2.png",
  },
  {
    id: 7,
    title: "Classic Wardrobe",
    category: "Bedroom",
    price: 9800000,
    oldPrice: 11500000,
    badge: "-15%",
    image: "/images/product3.png",
  },
  {
    id: 8,
    title: "Outdoor Patio Set",
    category: "Outdoor",
    price: 6400000,
    badge: "New",
    image: "/images/product4.png",
  },
  {
    id: 9,
    title: "Office Executive Chair",
    category: "Office",
    price: 4200000,
    image: "/images/product1.png",
  },
  {
    id: 10,
    title: "Compact Study Desk",
    category: "Office",
    price: 3500000,
    image: "/images/product2.png",
  },
  {
    id: 11,
    title: "Velvet Lounge Chair",
    category: "Living Room",
    price: 4600000,
    image: "/images/product3.png",
  },
  {
    id: 12,
    title: "Wall Mounted Shelf",
    category: "Decor",
    price: 1500000,
    badge: "New",
    image: "/images/product4.png",
  },
  {
    id: 13,
    title: "Marble Dining Set",
    category: "Dining",
    price: 15000000,
    image: "/images/product1.png",
  },
  {
    id: 14,
    title: "King Size Mattress",
    category: "Bedroom",
    price: 6800000,
    image: "/images/product2.png",
  },
  {
    id: 15,
    title: "Fabric Recliner",
    category: "Living Room",
    price: 5400000,
    oldPrice: 6200000,
    badge: "-10%",
    image: "/images/product3.png",
  },
  {
    id: 16,
    title: "Wooden TV Console",
    category: "Living Room",
    price: 4300000,
    image: "/images/product4.png",
  },
  {
    id: 17,
    title: "Minimal Nightstand",
    category: "Bedroom",
    price: 1800000,
    image: "/images/product1.png",
  },
  {
    id: 18,
    title: "Modern Bookshelf",
    category: "Office",
    price: 3900000,
    image: "/images/product2.png",
  },
  {
    id: 19,
    title: "Outdoor Swing Chair",
    category: "Outdoor",
    price: 5200000,
    badge: "New",
    image: "/images/product3.png",
  },
  {
    id: 20,
    title: "Round Dining Table",
    category: "Dining",
    price: 7800000,
    image: "/images/product4.png",
  },
  {
    id: 21,
    title: "Luxury Dressing Table",
    category: "Bedroom",
    price: 6100000,
    image: "/images/product1.png",
  },
  {
    id: 22,
    title: "Office Filing Cabinet",
    category: "Office",
    price: 2500000,
    image: "/images/product2.png",
  },
  {
    id: 23,
    title: "Accent Wall Mirror",
    category: "Decor",
    price: 2100000,
    image: "/images/product3.png",
  },
  {
    id: 24,
    title: "Wooden Bar Stool",
    category: "Dining",
    price: 1700000,
    image: "/images/product4.png",
  },
  {
    id: 25,
    title: "Corner L-Shaped Sofa",
    category: "Living Room",
    price: 13500000,
    image: "/images/product1.png",
  },
  {
    id: 26,
    title: "Modern Shoe Rack",
    category: "Storage",
    price: 2200000,
    image: "/images/product2.png",
  },
  {
    id: 27,
    title: "Luxury Office Desk",
    category: "Office",
    price: 9800000,
    image: "/images/product3.png",
  },
  {
    id: 28,
    title: "Outdoor Garden Bench",
    category: "Outdoor",
    price: 3600000,
    image: "/images/product4.png",
  },
  {
    id: 29,
    title: "Fabric Dining Chairs (Set of 4)",
    category: "Dining",
    price: 4900000,
    image: "/images/product1.png",
  },
  {
    id: 30,
    title: "Modern Floor Lamp",
    category: "Decor",
    price: 1900000,
    image: "/images/product2.png",
  },
  {
    id: 31,
    title: "Sliding Door Wardrobe",
    category: "Bedroom",
    price: 11000000,
    image: "/images/product3.png",
  },
  {
    id: 32,
    title: "Minimal Console Table",
    category: "Living Room",
    price: 3200000,
    image: "/images/product4.png",
  },
];


const ProductGrid = () => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalProducts = products.length;
  const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE);

  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const endIndex = startIndex + PRODUCTS_PER_PAGE;
  const visibleProducts = products.slice(startIndex, endIndex);

  // Scroll to top on page change (UX polish)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);

  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
        <p className="text-sm text-gray-500">
          Showing {startIndex + 1}–
          {Math.min(endIndex, totalProducts)} of {totalProducts} results
        </p>

        <div className="flex gap-3">
          <select className="border px-3 py-2 text-sm rounded">
            <option>Default</option>
            <option>Price: Low to High</option>
            <option>Price: High to Low</option>
          </select>

          <select className="border px-3 py-2 text-sm rounded">
            <option>Show 16</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-center mt-12 gap-2">
        {/* Page numbers */}
        {Array.from({ length: totalPages }).map((_, i) => {
          const page = i + 1;
          return (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`px-4 py-2 rounded transition
                ${
                  currentPage === page
                    ? "bg-amber-600 text-white"
                    : "border hover:bg-gray-100"
                }`}
            >
              {page}
            </button>
          );
        })}

        {/* Next button */}
        <button
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          disabled={currentPage === totalPages}
          className="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </section>
  );
};

export default ProductGrid;