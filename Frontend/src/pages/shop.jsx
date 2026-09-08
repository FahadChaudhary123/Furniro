import React from 'react'
import ProductGrid from '../components/ProductGrid'
import FeaturesSection from '../sections/FeaturesSection'
import Footer from '../components/Footer'
import ShopBanner from '../sections/ShopBanner'
import { usePageMeta } from '../shared/lib/usePageMeta.js';

function Shop() {
  usePageMeta('/shop');
  return (
    <div>
      <ShopBanner/>
      <ProductGrid />
      <FeaturesSection />
      <Footer />
    </div>
  )
}

export default Shop
