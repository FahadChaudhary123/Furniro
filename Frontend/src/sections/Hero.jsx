import hero from "../assets/hero-bg.jpg";
const Hero = () => {
  return (
    <section className="relative w-full h-[80vh] min-h-[500px]">
      {/* Background Image */}
      <img
        src={hero} // replace with your image path
        alt="Hero Background"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay (optional for contrast) */}
      <div className="absolute inset-0 bg-white/20"></div>

      {/* Content */}
      <div className="relative z-10 h-full max-w-7xl mx-auto px-6 flex items-center justify-end">
        <div className="bg-[#FDF1DF] p-8 md:p-12 rounded-lg max-w-lg shadow-sm">
          <span className="text-sm uppercase tracking-wide text-gray-600">
            New Era Collection
          </span>

          <h1 className="mt-3 text-3xl md:text-4xl font-bold text-[#B88A2B] leading-tight">
            Where Tomorrow <br /> Feels Like Home
          </h1>

          <p className="mt-4 text-gray-600">
          Thoughtfully crafted pieces inspired by the future—
made to elevate your everyday life.</p>

          <button className="mt-6 inline-block bg-[#B88A2B] text-white px-6 py-3 font-semibold hover:bg-[#a57924] transition">
            BUY NOW
          </button>
        </div>
      </div>
    </section>
    
  );
};

export default Hero;
