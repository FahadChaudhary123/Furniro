import React from 'react'

import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

import BrowseRange from "../sections/BrowseRange";
import Hero from "../sections/Hero";
import ProductsSection from "../sections/ProductsSection";
import RoomsInspiration from "../sections/RoomsInspiration";
import ShareSetup from "../sections/ShareSetup";
import { motion, AnimatePresence } from "framer-motion";
import { useDocumentTitle } from '../shared/lib/useDocumentTitle';

function HomePage() {
  useDocumentTitle();
  return (
    <div>
       <motion.section
  initial={{ opacity: 0, y: 50 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.5 }}
>
  {/* Hero, Features, Footer etc */}
  
      <Hero />
      <BrowseRange />
      <ProductsSection />
      <RoomsInspiration />
      <ShareSetup />
      <Footer />
</motion.section>

    </div>
  )
}

export default HomePage
