import React from 'react'
import BlogBanner from '../sections/BlogBanner'
import BlogSection from '../sections/BlogSection'
import FeaturesSection from '../sections/FeaturesSection'
import { usePageMeta } from '../shared/lib/usePageMeta.js';


function About() {
  usePageMeta('/about');
  return (
    <div>
      <BlogBanner />
      <BlogSection />
      <FeaturesSection />
    </div>
  )
}

export default About
