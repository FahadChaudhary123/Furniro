// Contact.jsx
import React from "react";
import { MapPin, Phone, Clock } from "lucide-react"; // install lucide-react if not installed
import contactBanner from "../assets/contactBanner.jpg";
import FeaturesSection from "../sections/FeaturesSection";
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
          {/*
            The form is DISABLED, deliberately, and this is not a placeholder to fill in
            later without thought.

            It previously had no `onSubmit`, so pressing Submit triggered a native GET,
            reloaded the page and discarded every field. A customer typing out a complaint
            watched the fields empty and had every reason to believe it had been sent. It had
            not, and nobody was ever going to read it.

            Making it work needs `POST /api/contact` plus somewhere to put a message and
            something to deliver it — none of which exist (see API.md). Until then, soliciting
            a name, an email address and a message we cannot receive is worse than not asking:
            it collects personal data under a false premise and loses the customer's problem.

            The phone number and address beside this form are the routes that do work.
          */}
          <div
            role="note"
            id="contact-form-unavailable"
            className="mb-6 rounded-md border border-yellow-700/40 bg-yellow-50 p-4 text-sm text-gray-800"
          >
            <strong className="font-semibold">This form is not available yet.</strong> Messages
            sent from here would not reach us, so it is switched off rather than quietly
            discarding what you write. Please use the phone number or address listed here
            instead — those reach a person.
          </div>

          {/*
            `preventDefault` is not belt-and-braces on top of `disabled` — it is the part
            that matters, and it is here because a test caught its absence.

            These inputs carry `name` attributes. Without a submit handler, a native GET
            serialises them into the URL:
              /contact?name=&email=visitor%40example.com&message=SECRET-MESSAGE
            which lands in browser history, in whatever access log the host keeps, and in the
            Referer header sent to any third party. Removing `disabled` — the single most
            likely future edit to this file — would be enough to start leaking.

            A form that cannot submit cannot leak, whatever state its fields are in.
          */}
          <form
            className="flex flex-col gap-4"
            aria-describedby="contact-form-unavailable"
            onSubmit={(event) => event.preventDefault()}
          >
            <fieldset disabled className="flex flex-col gap-4 border-0 p-0 m-0 opacity-60">
              <legend className="sr-only">
                Contact form, currently unavailable
              </legend>
              <input
                type="text"
                name="name"
                aria-label="Your name"
                placeholder="Your Name"
                className="border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <input
                type="email"
                name="email"
                aria-label="Email address"
                placeholder="Email Address"
                className="border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <input
                type="text"
                name="subject"
                aria-label="Subject (optional)"
                placeholder="Subject (optional)"
                className="border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <textarea
                name="message"
                aria-label="Message"
                placeholder="Message"
                className="border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none h-32"
              ></textarea>
              <button
                type="submit"
                className="bg-yellow-700 text-white py-3 rounded-md hover:bg-yellow-800 transition"
              >
                Submit
              </button>
            </fieldset>
          </form>
        </div>
      </div>
    </div>
    <FeaturesSection />
    </>
  );
};

export default Contact;
