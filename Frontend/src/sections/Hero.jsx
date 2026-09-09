import { Link } from "react-router-dom";

import { buildAssetPairs } from "../shared/lib/assetPairs";
import Picture from "../shared/ui/Picture";

const hero = buildAssetPairs(
  import.meta.glob("../assets/hero-bg.{jpg,webp}", {
    eager: true,
    query: "?url",
    import: "default",
  }),
)["hero-bg"];
const Hero = () => {
  return (
    <section className="relative w-full h-[80vh] min-h-[500px]">
      {/* Background Image */}
      {/* Above the fold and full-bleed: eager, and fetchpriority high so it is not
          queued behind the product images below. */}
      <Picture
        src={hero.src}
        webp={hero.webp}
        alt="Hero Background"
        fetchPriority="high"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay (optional for contrast) */}
      <div className="absolute inset-0 bg-white/20"></div>

      {/* Content */}
      <div className="relative z-10 h-full max-w-7xl mx-auto px-6 flex items-center justify-end">
        <div className="bg-[#FDF1DF] p-8 md:p-12 rounded-lg max-w-lg shadow-sm">
          <span className="text-sm uppercase tracking-wide text-gray-600">
            New Era Collection
          </span>

          <h1 className="mt-3 text-3xl md:text-4xl font-bold text-[#B88E2F] leading-tight">
            Where Tomorrow <br /> Feels Like Home
          </h1>

          <p className="mt-4 text-gray-600">
          Thoughtfully crafted pieces inspired by the future—
made to elevate your everyday life.</p>

          {/* A <Link>, not a <button>: it navigates, so it has to be a link for
              middle-click, ctrl-click, "open in new tab" and a screen reader to treat it
              correctly. It did nothing at all before — the most prominent call to action on
              the site was inert. */}
          <Link
            to="/shop"
            className="mt-6 inline-block bg-[#B88E2F] text-white px-6 py-3 font-semibold hover:bg-[#a57f28] transition"
          >
            BUY NOW
          </Link>
        </div>
      </div>
    </section>
    
  );
};

export default Hero;
