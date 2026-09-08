import Footer from "../components/Footer";

import Hero from "../sections/Hero";
import BrowseRange from "../sections/BrowseRange";
import ProductsSection from "../sections/ProductsSection";
import RoomsInspiration from "../sections/RoomsInspiration";
import ShareSetup from "../sections/ShareSetup";

import { useDocumentTitle } from "../shared/lib/useDocumentTitle";

function HomePage() {
  useDocumentTitle();

  return (
    <div className="animate-reveal-up">
      <Hero />
      <BrowseRange />
      <ProductsSection />
      <RoomsInspiration />
      <ShareSetup />
      <Footer />
    </div>
  );
}

export default HomePage;
