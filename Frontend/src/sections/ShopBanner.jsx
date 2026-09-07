import React from "react";
import bannerImg from "../assets/contactBanner.jpg"; // replace with your image path
import logoIcon from "../assets/logo.svg";   // small icon above Blog (optional)

const ShopBanner = () => {
  return (
    <section
      className="relative w-full h-[280px] md:h-[150px] bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: `url(${bannerImg})` }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-white/40"></div>

      {/* Content */}
      <div className="relative z-10 text-center">
        {/* Small Icon */}
        <div className="flex justify-center mb-3">
          <img src={logoIcon} alt="icon" className="w-8 h-8" />
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-semibold text-black">
          Shop
        </h1>

        {/* Breadcrumb */}
        <p className="mt-2 text-sm md:text-base text-gray-700">
          Home <span className="mx-1">&gt;</span> Shop
        </p>
      </div>
    </section>
  );
};

export default ShopBanner;
