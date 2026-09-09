import React from 'react'
import ProductGrid from '../components/ProductGrid'
import FeaturesSection from '../sections/FeaturesSection'
import ShopBanner from '../sections/ShopBanner'
import { usePageMeta } from '../shared/lib/usePageMeta.js';

function Shop() {
  usePageMeta('/shop');
  return (
    <div>
      <ShopBanner/>
      <ProductGrid />
      <FeaturesSection />
    </div>
  )
}

export default Shop
