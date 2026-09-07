import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";

const AnimationDemo = () => {
  const gsapBox = useRef(null);

  useEffect(() => {
    // GSAP animation
    gsap.to(gsapBox.current, { x: 300, rotation: 360, duration: 2, repeat: -1, yoyo: true });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 gap-10">

      {/* Framer Motion Box */}
      <motion.div
        className="w-24 h-24 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold"
        animate={{ y: [0, -50, 0] }}  // up and down animation
        transition={{ duration: 2, repeat: Infinity }}
      >
        FM
      </motion.div>

      {/* GSAP Box */}
      <div
        ref={gsapBox}
        className="w-24 h-24 bg-red-500 rounded-lg flex items-center justify-center text-white font-bold"
      >
        GSAP
      </div>

    </div>
  );
};

export default AnimationDemo;
