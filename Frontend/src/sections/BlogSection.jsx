import React from "react";
import { Search, User, Calendar, Tag } from "lucide-react";

import blogImg from "../assets/blog1.jpg";
import mainImg from "../assets/blog2.jpg";
import secondImg from "../assets/blog3.jpg";

import post1 from "../assets/post1.jpg";
import post2 from "../assets/post2.jpg";
import post3 from "../assets/post3.jpg";
import post4 from "../assets/post4.jpg";
import post5 from "../assets/post5.jpg";

const BlogSection = () => {
  const blogPosts = [
    {
      title: "Featured Design Trends for 2022",
      text: "Discover the latest design trends shaping interiors and products in 2022. From colors to textures, get inspired by modern styles.",
      img: blogImg,
      author: "Admin",
      date: "14 Oct 2022",
      tag: "Wood",
    },
    {
      title: "Going all-in with millennial design",
      text: "Dive into millennial-inspired spaces that balance style and productivity. Learn how colors, textures, and layouts come together for the modern home.",
      img: mainImg,
      author: "Admin",
      date: "14 Oct 2022",
      tag: "Handmade",
    },
    {
      title: "Creating spaces that inspire productivity",
      text: "Creating an environment that inspires focus is easier than you think. Discover layouts, lighting, and décor ideas to make your home office thrive.",
      img: secondImg,
      author: "Admin",
      date: "22 Nov 2022",
      tag: "Interior",
    },
  ];

  return (
    <section className="bg-gray-100 py-16">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-10">

        {/* ===== LEFT SIDE - Blog Posts ===== */}
        <div className="lg:col-span-2 space-y-10">
          {blogPosts.map((post, index) => (
            <div key={index} className="bg-white rounded-xl overflow-hidden shadow-sm space-y-6 p-6">
              <h2 className="text-3xl font-semibold">{post.title}</h2>
              <p className="text-gray-500 leading-relaxed">{post.text}</p>
              <button className="mt-4 border-b border-black pb-1 text-sm font-medium">
                Read more
              </button>
              <img
                src={post.img}
                alt={post.title}
                className="w-full rounded-xl object-cover"
              />
              <div className="flex items-center gap-8 text-gray-500 text-sm">
                <div className="flex items-center gap-2"><User size={16} /> {post.author}</div>
                <div className="flex items-center gap-2"><Calendar size={16} /> {post.date}</div>
                <div className="flex items-center gap-2"><Tag size={16} /> {post.tag}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ===== RIGHT SIDE - Sidebar ===== */}
        <div className="space-y-10">

          {/* Search Box */}
          <div className="bg-white p-5 rounded-xl shadow-sm">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="w-full border border-gray-300 rounded-lg py-2 px-4 pr-10 focus:outline-none focus:ring-1 focus:ring-black"
              />
              <Search
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold mb-6">Categories</h3>
            <div className="space-y-4 text-gray-600">
              {[ 
                { name: "Crafts", count: 2 },
                { name: "Design", count: 8 },
                { name: "Handmade", count: 7 },
                { name: "Interior", count: 1 },
                { name: "Wood", count: 6 },
              ].map((cat, index) => (
                <div
                  key={index}
                  className="flex justify-between hover:text-black cursor-pointer transition"
                >
                  <span>{cat.name}</span>
                  <span>{cat.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Posts */}
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold mb-6">Recent Posts</h3>
            <div className="space-y-6">
              {[post1, post2, post3, post4, post5].map((img, index) => (
                <div key={index} className="flex gap-4 items-center">
                  <img
                    src={img}
                    alt="post"
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div>
                    <p className="text-sm font-medium leading-snug">Sample blog title here</p>
                    <p className="text-xs text-gray-400 mt-1">03 Aug 2022</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default BlogSection;
