import { buildAssetPairs } from "../shared/lib/assetPairs";
import Picture from "../shared/ui/Picture";

const pairs = buildAssetPairs(
  import.meta.glob("../assets/setup/*.{jpg,webp,avif}", {
    eager: true,
    query: "?url",
    import: "default",
  }),
);

const images = ["1", "2", "3", "4", "5", "6", "7", "8"].map((n) => pairs[n]);


const ShareSetup = () => {
  return (
    <section className="py-20 overflow-hidden">
      {/* Heading */}
      <div className="text-center mb-12">
        <p className="text-gray-500 mb-2">Share your setup with</p>
        <h2 className="text-3xl md:text-4xl font-bold">
          #FurniroFurniture
        </h2>
      </div>

      {/* Moving Gallery */}
      <div className="relative w-full overflow-hidden">
       <div className="flex w-max animate-marquee-right gap-6">
  {/* First set */}
  {images.map((img, index) => (
    <Picture
      key={index}
      src={img.src}
      webp={img.webp}
      avif={img.avif}
      alt="setup"
      loading="lazy"
      className="w-[280px] h-[280px] object-cover rounded-md"
    />
  ))}

  {/* Duplicate set for seamless loop */}
  {images.map((img, index) => (
    <Picture
      key={`dup-${index}`}
      src={img.src}
      webp={img.webp}
      avif={img.avif}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className="w-[280px] h-[280px] object-cover rounded-md"
    />
  ))}
</div>

      </div>
    </section>
  );
};

export default ShareSetup;
