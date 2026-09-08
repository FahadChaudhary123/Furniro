// Contact.jsx
import React from "react";
import { MapPin, Phone, Clock } from "lucide-react"; // install lucide-react if not installed
import contactBanner from "../assets/contactBanner.jpg";
import FeaturesSection from "../sections/FeaturesSection";
import Footer from "../components/Footer";
import { usePageMeta } from '../shared/lib/usePageMeta.js';

const Contact = () => {
  usePageMeta('/contact');
  return (
    <>
    <div className="w-full">
      {/* Banner Section */}
      <div
        className="w-full h-64 bg-cover bg-center flex flex-col justify-center items-center"
        style={{ backgroundImage: `url(${contactBanner})` }}
      >
        <h1 className="text-3xl font-bold text-black">Contact</h1>
        <p className="text-gray-700 mt-2 text-sm">
          Home <span className="mx-2">{">"}</span> Contact
        </p>
      </div>

      {/* Contact Form Section */}
      <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col lg:flex-row gap-16">
        {/* Contact Info */}
        <div className="flex-1 space-y-10">
          <div className="flex items-start gap-5">
            <MapPin size={28} className="text-yellow-600 mt-1" />
            <div>
              <h3 className="font-semibold text-lg">Address</h3>
              <p className="text-gray-600 text-sm">
                236 5th SE Avenue, New York NY10000, United States
              </p>
            </div>
          </div>

          <div className="flex items-start gap-5">
            <Phone size={28} className="text-yellow-600 mt-1" />
            <div>
              <h3 className="font-semibold text-lg">Phone</h3>
              <p className="text-gray-600 text-sm">
                Mobile: +84 546-6789 <br />
                Hotline: +84 456-6789
              </p>
            </div>
          </div>

          <div className="flex items-start gap-5">
            <Clock size={28} className="text-yellow-600 mt-1" />
            <div>
              <h3 className="font-semibold text-lg">Working Time</h3>
              <p className="text-gray-600 text-sm">
                Monday-Friday: 9:00 – 22:00 <br />
                Saturday-Sunday: 9:00 – 21:00
              </p>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-4">Get In Touch With Us</h2>
          <p className="text-gray-500 mb-6 text-sm">
            For More Information About Our Product & Services. Please Feel Free
            To Drop Us An Email. Our Staff Always Be There To Help You Out. Do
            Not Hesitate!
          </p>
          <form className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Your Name"
              className="border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <input
              type="email"
              placeholder="Email Address"
              className="border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <input
              type="text"
              placeholder="Subject (optional)"
              className="border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
            <textarea
              placeholder="Message"
              className="border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none h-32"
            ></textarea>
            <button
              type="submit"
              className="bg-yellow-700 text-white py-3 rounded-md hover:bg-yellow-800 transition"
            >
              Submit
            </button>
          </form>
        </div>
      </div>
    </div>
    <FeaturesSection />
    <Footer />
    </>
  );
};

export default Contact;
