import React from 'react'
import ProductGrid from '../components/ProductGrid'
import FeaturesSection from '../sections/FeaturesSection'
import Footer from '../components/Footer'
import ShopBanner from '../sections/ShopBanner'

function shop() {
  return (
    <div>
      <ShopBanner/>
      <ProductGrid />
      <FeaturesSection />
      <Footer />
    </div>
  )
}

export default shop
