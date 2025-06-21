import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom"
export default function HeroSection() {
  const [showText, setShowText] = useState(false);
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    const textTimeout = setTimeout(() => setShowText(true), 150);
    const imageTimeout = setTimeout(() => setShowImage(true), 400);
    return () => {
      clearTimeout(textTimeout);
      clearTimeout(imageTimeout);
    };
  }, []);

  return (
    <section id="inicio" className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-0 items-center">
      {/* Text */}
      <div
        className={`flex flex-col items-center md:items-start text-center md:text-left transition-all duration-700 ease-out
          ${showText ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"}`}
      >
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-[#2E2E3A] mb-4 leading-tight tracking-tight drop-shadow-lg">
          Team
          <span className="text-[#55C2A2] drop-shadow-lg">Zen</span>
        </h1>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-[#2E2E3A] mb-8 md:mb-10 leading-snug max-w-xl">
          Equipos más{" "}
          <span className="text-[#55C2A2]">saludables</span>, trabajo más{" "}
          <span className="text-[#9D83C6]">productivo</span>
        </h2>
        <Link
          to="/LandingPageOficial/login"
          className="inline-block bg-[#55C2A2] hover:bg-[#9D83C6] text-[#2E2E3A] font-bold px-8 py-3 md:px-10 md:py-4 rounded-xl shadow-lg transition-all duration-300 text-lg md:text-xl"
        >
          Comienza ahora
        </Link>
      </div>
      {/* Image */}
      <div
        className={`flex justify-center items-center transition-all duration-700 ease-out
          ${showImage ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      >
        <div className="relative w-full max-w-xs sm:max-w-md md:max-w-lg">
          <div className="absolute -inset-4 sm:-inset-6 bg-[#DAD5E4] rounded-3xl blur-2xl opacity-50 z-0"></div>
          <img
            src={`${import.meta.env.BASE_URL}/img/formpanda.png`}
            alt="TeamZen dashboard"
            className="relative w-full rounded-2xl border-4 border-[#DAD5E4] bg-white/70 z-10 animate-float"
            style={{ objectFit: "cover" }}
          />
        </div>
      </div>
    </section>
  );
}