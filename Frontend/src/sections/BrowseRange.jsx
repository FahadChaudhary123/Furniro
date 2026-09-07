import { useState, useEffect } from "react";

import dining1 from "../assets/BrowseRange/dining-1.jpg";
import dining2 from "../assets/BrowseRange/dining-2.jpg";
import dining3 from "../assets/BrowseRange/dining-3.jpg";

import living1 from "../assets/BrowseRange/living-1.jpg";
import living2 from "../assets/BrowseRange/living-2.jpg";
import living3 from "../assets/BrowseRange/living-3.jpg";

import bedroom1 from "../assets/BrowseRange/bedroom-1.jpg";
import bedroom2 from "../assets/BrowseRange/bedroom-2.jpg";
import bedroom3 from "../assets/BrowseRange/bedroom-3.jpg";

const categories = [
  {
    title: "Dining",
    description:
      "Where moments are shared and future-ready design meets everyday functionality.",
    images: [dining1, dining2, dining3],
  },
  {
    title: "Living",
    description:
      "Comfort reimagined with intelligent design crafted for modern lifestyles.",
    images: [living1, living2, living3],
  },
  {
    title: "Bedroom",
    description:
      "A calming sanctuary designed to help you rest, recharge, and dream ahead.",
    images: [bedroom1, bedroom2, bedroom3],
  },
];

const BrowseRange = () => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    if (hoveredIndex === null) return;

    const interval = setInterval(() => {
      setImageIndex((prev) =>
        (prev + 1) % categories[hoveredIndex].images.length
      );
    }, 900);

    return () => clearInterval(interval);
  }, [hoveredIndex]);

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6 text-center">
        {/* Heading */}
        <h2 className="text-3xl md:text-4xl font-bold text-gray-800">
          Designed for Modern Living
        </h2>
        <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
          Curated spaces where comfort, innovation, and timeless design come
          together to shape the future of your home.
        </p>

        {/* Cards */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-10">
          {categories.map((cat, index) => (
            <div
              key={index}
              className="group cursor-pointer"
              onMouseEnter={() => {
                setHoveredIndex(index);
                setImageIndex(0);
              }}
              onMouseLeave={() => {
                setHoveredIndex(null);
                setImageIndex(0);
              }}
            >
              <div className="overflow-hidden rounded-xl">
                <img
                  src={
                    hoveredIndex === index
                      ? cat.images[imageIndex]
                      : cat.images[0]
                  }
                  alt={cat.title}
                  className="w-full h-[420px] object-cover transition-all duration-500 group-hover:scale-105"
                />
              </div>

              <h3 className="mt-5 text-xl font-semibold text-gray-800">
                {cat.title}
              </h3>
              <p className="mt-2 text-gray-500">
                {cat.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrowseRange;
