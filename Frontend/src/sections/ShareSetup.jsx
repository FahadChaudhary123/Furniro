import img1 from "../assets/setup/1.jpg";
import img2 from "../assets/setup/2.jpg";
import img3 from "../assets/setup/3.jpg";
import img4 from "../assets/setup/4.jpg";
import img5 from "../assets/setup/5.jpg";
import img6 from "../assets/setup/6.jpg";
import img7 from "../assets/setup/7.jpg";
import img8 from "../assets/setup/8.jpg";

const images = [img1, img2, img3, img4, img5, img6, img7, img8];


const ShareSetup = () => {
  return (
    <section className="py-20 overflow-hidden">
      {/* Heading */}
      <div className="text-center mb-12">
        <p className="text-gray-500 mb-2">Share your setup with</p>
        <h2 className="text-3xl md:text-4xl font-bold">
          #FuniroFurniture
        </h2>
      </div>

      {/* Moving Gallery */}
      <div className="relative w-full overflow-hidden">
       <div className="flex w-max animate-marquee-right gap-6">
  {/* First set */}
  {images.map((img, index) => (
    <img
      key={index}
      src={img}
      alt="setup"
      className="w-[280px] h-[280px] object-cover rounded-md"
    />
  ))}

  {/* Duplicate set for seamless loop */}
  {images.map((img, index) => (
    <img
      key={`dup-${index}`}
      src={img}
      alt="setup"
      className="w-[280px] h-[280px] object-cover rounded-md"
    />
  ))}
</div>

      </div>
    </section>
  );
};

export default ShareSetup;
