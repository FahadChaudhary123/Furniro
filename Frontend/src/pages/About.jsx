import React from 'react'
import PageBanner from '../components/PageBanner';
import BlogSection from '../sections/BlogSection'
import FeaturesSection from '../sections/FeaturesSection'
import { usePageMeta } from '../shared/lib/usePageMeta.js';


function About() {
  usePageMeta('/about');
  return (
    <div>
      <PageBanner title="Blog" trail={[{ label: 'Home', to: '/' }, { label: 'Blog' }]} />
      <BlogSection />
      <FeaturesSection />
    </div>
  )
}

export default About
