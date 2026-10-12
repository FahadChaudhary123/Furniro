import React from 'react'
import ProductGrid from '../components/ProductGrid'
import FeaturesSection from '../sections/FeaturesSection'
import PageBanner from '../components/PageBanner';
import { usePageMeta } from '../shared/lib/usePageMeta.js';
import TradingNotice from '../components/TradingNotice';

function Shop() {
  usePageMeta('/shop');
  return (
    <div>
      <PageBanner title="Shop" trail={[{ label: "Home", to: "/" }, { label: "Shop" }]} />
      <div className="mx-auto max-w-7xl px-4 pt-8">
        <TradingNotice />
      </div>
      <ProductGrid />
      <FeaturesSection />
    </div>
  )
}

export default Shop
