import { useState } from "react";
import bedroom from "../assets/rooms/bedroom.jpg";
import livingroom from "../assets/rooms/livingroom.jpg";
import living from "../assets/rooms/living.jpg";
const rooms = [
  {
    id: 1,
    title: "Inner Peace",
    category: "Bed Room",
    image: bedroom ,
  },
  {
    id: 2,
    title: "Minimal Living",
    category: "Living Room",
    image: livingroom,
  },
  {
    id: 3,
    title: "Cozy Space",
    category: "Dining Room",
    image: living,
  },
];

const RoomsInspiration = () => {
  const [current, setCurrent] = useState(0);

  const nextSlide = () => {
    setCurrent((prev) => (prev + 1) % rooms.length);
  };

  const goToSlide = (index) => {
    setCurrent(index);
  };

  return (
    <section className="bg-[#FCF8F3] py-20">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* LEFT CONTENT */}
        <div>
          <h2 className="text-4xl font-bold leading-snug mb-6">
            50+ Beautiful rooms inspiration
          </h2>

          <p className="text-gray-600 mb-8 max-w-md">
            Our designer already made a lot of beautiful prototype of rooms that
            inspire you.
          </p>

          <button className="bg-[#B88E2F] text-white px-8 py-3 font-medium hover:bg-[#a57f28] transition">
            Explore More
          </button>
        </div>

        {/* RIGHT CAROUSEL */}
        <div className="relative">
          {/* Slider */}
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500"
              style={{ transform: `translateX(-${current * 100}%)` }}
            >
              {rooms.map((room) => (
                <div key={room.id} className="min-w-full relative">
                  <img
                    src={room.image}
                    alt={room.title}
                    className="w-full h-[480px] object-cover"
                  />

                  {/* Overlay Card */}
                  <div className="absolute bottom-6 left-6 bg-white px-6 py-4 shadow-lg">
                    <p className="text-sm text-gray-500">
                      {`0${room.id} — ${room.category}`}
                    </p>
                    <h3 className="text-xl font-semibold">
                      {room.title}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* NEXT ARROW */}
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white shadow flex items-center justify-center text-xl hover:bg-gray-100"
          >
            →
          </button>

          {/* DOTS */}
          <div className="flex gap-3 mt-6">
            {rooms.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full ${
                  current === index
                    ? "bg-[#B88E2F]"
                    : "bg-gray-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default RoomsInspiration;
