import React from 'react'
import ProductGrid from '../components/ProductGrid'
import FeaturesSection from '../sections/FeaturesSection'
import PageBanner from '../components/PageBanner';
import { usePageMeta } from '../shared/lib/usePageMeta.js';

function Shop() {
  usePageMeta('/shop');
  return (
    <div>
      <PageBanner title="Shop" trail={[{ label: "Home", to: "/" }, { label: "Shop" }]} />
      <ProductGrid />
      <FeaturesSection />
    </div>
  )
}

export default Shop
