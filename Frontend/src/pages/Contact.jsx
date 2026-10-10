// Contact.jsx
import React from "react";
import PageBanner from "../components/PageBanner";
import FeaturesSection from "../sections/FeaturesSection";
import { usePageMeta } from '../shared/lib/usePageMeta.js';

const Contact = () => {
  usePageMeta('/contact');
  return (
    <>
    <div className="w-full">
      <PageBanner title="Contact" trail={[{ label: 'Home', to: '/' }, { label: 'Contact' }]} />

      {/* Contact Form Section */}
      <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col lg:flex-row gap-16">
        {/* Public contact details need the business owner's approval before publication. */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-4">Contact options</h2>
          <p className="text-gray-600 text-sm">
            Customer support is not available through this site yet. We will publish a verified
            contact method before ordering opens.
          </p>
        </div>

        {/* Contact Form */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-4">Contact form</h2>
          <p className="text-gray-500 mb-6 text-sm">This form is disabled until messages can be received and answered.</p>
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

            Do not point visitors to unverified contact details as a workaround.
          */}
          <div
            role="note"
            id="contact-form-unavailable"
            className="mb-6 rounded-md border border-yellow-700/40 bg-yellow-50 p-4 text-sm text-gray-800"
          >
            <strong className="font-semibold">This form is not available yet.</strong> Messages
            sent from here would not reach us, so it is switched off rather than quietly
            discarding what you write. A verified contact method will be published before
            ordering opens.
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
