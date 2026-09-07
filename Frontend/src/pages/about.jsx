import React from 'react'
import BlogBanner from '../sections/BlogBanner'
import BlogSection from '../sections/BlogSection'
import FeaturesSection from '../sections/FeaturesSection'
import Footer from '../components/Footer'


function about() {
  return (
    <div>
      <BlogBanner />
      <BlogSection />
      <FeaturesSection />
      <Footer />
      
    </div>
  )
}

export default about
