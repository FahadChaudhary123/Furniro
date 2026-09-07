import { Routes, Route } from "react-router-dom";
import Navbar from "../src/components/Navbar";
import Shop from "../src/pages/shop";
import About from "../src/pages/about";
import Contact from "../src/pages/contact";
import HomePage from "../src/pages/HomePage";

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </>
  );
}

export default App;
