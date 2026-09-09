import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";

/**
 * Routes are code-split, except the landing page.
 *
 * Everything used to arrive in one chunk, so a visitor reading the blog also downloaded the
 * cart, the shop grid and the product page. Each route below is now its own chunk, fetched
 * on navigation.
 *
 * HomePage stays eagerly imported on purpose: it is the most common entry point, and
 * lazy-loading the route you have just landed on costs an extra round trip before anything
 * renders. Splitting the page you are already on optimises the wrong thing.
 */
const Shop = lazy(() => import("./pages/shop"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const About = lazy(() => import("./pages/about"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Cart = lazy(() => import("./pages/Cart"));
const Contact = lazy(() => import("./pages/contact"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** Shown only while a route chunk is in flight — usually a few milliseconds. */
const RouteFallback = () => (
  <div className="max-w-7xl mx-auto px-4 py-24" aria-busy="true" aria-live="polite">
    <span className="sr-only">Loading page…</span>
    <div className="animate-pulse space-y-6">
      <div className="h-10 w-1/3 bg-gray-200 rounded" />
      <div className="h-64 w-full bg-gray-200 rounded-lg" />
    </div>
  </div>
);

function App() {
  return (
    <>
      <Navbar />
      {/*
        The boundary sits INSIDE the shell and outside Suspense, so a route that fails to
        load keeps the navbar and shows a recoverable message. Without it, a rejected lazy
        import unmounts the whole tree to a blank page — which is what a visitor holding
        pre-deploy HTML gets when the chunk filename it asks for no longer exists.
      */}
      <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
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
        </Suspense>
      </RouteErrorBoundary>
      {/*
        One Footer for the whole app. It was previously imported and rendered by all eight
        page components — eight copies to keep in step, and the reason a footer change had to
        be made eight times. It sits outside the error boundary deliberately: when a route
        fails to load, the footer is still a way out of the page.
      */}
      <Footer />
    </>
  );
}

export default App;
