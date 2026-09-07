import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import Shop from "./pages/shop";
import ProductDetail from "./pages/ProductDetail";
import About from "./pages/about";
import BlogPost from "./pages/BlogPost";
import Cart from "./pages/Cart";
import Contact from "./pages/contact";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<Shop />} />
        {/* Slug, not id, so the URL survives a reseed and reads as something shareable. */}
        <Route path="/shop/:slug" element={<ProductDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/contact" element={<Contact />} />
        {/* Catch-all, last. Without it an unknown path rendered the navbar and nothing else. */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;
