import { useState, useEffect } from "react";

import { buildAssetPairs } from "../shared/lib/assetPairs";
import Picture from "../shared/ui/Picture";

const img = buildAssetPairs(
  import.meta.glob("../assets/BrowseRange/*.{jpg,webp}", {
    eager: true,
    query: "?url",
    import: "default",
  }),
);

const categories = [
  {
    title: "Dining",
    description:
      "Where moments are shared and future-ready design meets everyday functionality.",
    images: [img["dining-1"], img["dining-2"], img["dining-3"]],
  },
  {
    title: "Living",
    description:
      "Comfort reimagined with intelligent design crafted for modern lifestyles.",
    images: [img["living-1"], img["living-2"], img["living-3"]],
  },
  {
    title: "Bedroom",
    description:
      "A calming sanctuary designed to help you rest, recharge, and dream ahead.",
    images: [img["bedroom-1"], img["bedroom-2"], img["bedroom-3"]],
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
                <Picture
                src={
                    hoveredIndex === index
                      ? cat.images[imageIndex]
                      : cat.images[0]
                  .src}
                webp={
                    hoveredIndex === index
                      ? cat.images[imageIndex]
                      : cat.images[0]
                  .webp}
                loading="lazy"
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
