import React from 'react'
import ProductGrid from '../components/ProductGrid'
import FeaturesSection from '../sections/FeaturesSection'
import Footer from '../components/Footer'
import ShopBanner from '../sections/ShopBanner'
import { useDocumentTitle } from '../shared/lib/useDocumentTitle';

function Shop() {
  useDocumentTitle('Shop');
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
