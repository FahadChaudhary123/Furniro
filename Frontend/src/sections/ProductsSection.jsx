import { FaHeart, FaShareAlt, FaBalanceScale } from "react-icons/fa";
import product1 from "../assets/Products/product1.jpg";
import product2 from "../assets/Products/product2.jpg";
import product3 from "../assets/Products/product3.jpg";
import product4 from "../assets/Products/product4.jpg";
import product5 from "../assets/Products/product5.jpg";
import product6 from "../assets/Products/product6.jpg";
import product7 from "../assets/Products/product7.jpg";
import product8 from "../assets/Products/product8.jpg";

const products = [
  {
    id: 1,
    name: "Syltherine",
    desc: "Stylish cafe chair",
    price: "Rp 2.500.000",
    oldPrice: "Rp 3.500.000",
    badge: "-30%",
    image: product1,
  },
  {
    id: 2,
    name: "Leviosa",
    desc: "Stylish cafe chair",
    price: "Rp 2.500.000",
    image: product2,
  },
  {
    id: 3,
    name: "Lolito",
    desc: "Luxury big sofa",
    price: "Rp 7.000.000",
    oldPrice: "Rp 14.000.000",
    badge: "-50%",
    image: product3,
  },
  {
    id: 4,
    name: "Respira",
    desc: "Outdoor bar table and stool",
    price: "Rp 500.000",
    badge: "New",
    image: product4,
  },
  {
    id: 5,
    name: "Grifo",
    desc: "Night lamp",
    price: "Rp 1.500.000",
    image: product5,
  },
  {
    id: 6,
    name: "Muggo",
    desc: "Small mug",
    price: "Rp 150.000",
    badge: "New",
    image: product6,
  },
  {
    id: 7,
    name: "Pingky",
    desc: "Cute bed set",
    price: "Rp 7.000.000",
    oldPrice: "Rp 14.000.000",
    badge: "-50%",
    image: product7,
  },
  {
    id: 8,
    name: "Potty",
    desc: "Minimalist flower pot",
    price: "Rp 500.000",
    badge: "New",
    image: product8,
  },
];

const ProductsSection = () => {
  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      <h2 className="text-3xl font-semibold text-center mb-12">
        Our Products
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {products.map((item) => (
          <div
            key={item.id}
            className="group relative bg-[#F4F5F7] overflow-hidden"
          >
            {/* Badge */}
            {item.badge && (
              <span
                className={`absolute top-4 right-4 z-10 text-white text-sm px-3 py-1 rounded-full
                ${item.badge === "New" ? "bg-teal-400" : "bg-red-400"}`}
              >
                {item.badge}
              </span>
            )}

            {/* Image */}
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-72 object-cover"
            />

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/50 flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition">
              <button className="bg-white text-[#B88E2F] px-6 py-2 mb-4 font-semibold">
                Add to cart
              </button>

              <div className="flex gap-6 text-white text-sm">
                <span className="flex items-center gap-1 cursor-pointer">
                  <FaShareAlt /> Share
                </span>
                <span className="flex items-center gap-1 cursor-pointer">
                  <FaBalanceScale /> Compare
                </span>
                <span className="flex items-center gap-1 cursor-pointer">
                  <FaHeart /> Like
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 bg-[#F4F5F7]">
              <h3 className="text-lg font-semibold">{item.name}</h3>
              <p className="text-sm text-gray-500 mb-2">{item.desc}</p>

              <div className="flex items-center gap-2">
                <span className="font-semibold">{item.price}</span>
                {item.oldPrice && (
                  <span className="text-sm text-gray-400 line-through">
                    {item.oldPrice}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show More */}
      <div className="text-center mt-12">
        <button className="border border-[#B88E2F] text-[#B88E2F] px-10 py-3 font-semibold hover:bg-[#B88E2F] hover:text-white transition">
          Show More
        </button>
      </div>
    </section>
  );
};

export default ProductsSection;
