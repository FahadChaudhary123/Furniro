import React from 'react'
import BlogBanner from '../sections/BlogBanner'
import BlogSection from '../sections/BlogSection'
import FeaturesSection from '../sections/FeaturesSection'
import Footer from '../components/Footer'
import { useDocumentTitle } from '../shared/lib/useDocumentTitle';


function About() {
  useDocumentTitle('Blog');
  return (
    <div>
      <BlogBanner />
      <BlogSection />
      <FeaturesSection />
      <Footer />
      
    </div>
  )
}

export default About
