import "./ServiceCard.css";
import React from "react";

export default function ServiceCard({
  icon,
  iconColor,
  title,
  description,
  badgeIcon,
  badgeText,
  badgeBg,
  badgeColor,
  show,
  animationDelay,
  animationClass = "animate-fadein-up", // por defecto
}) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-lg 
        p-6 sm:p-5 md:p-5 lg:p-3
        min-h-[260px] sm:min-h-[220px] md:min-h-[240px]
        max-w-[95vw] sm:max-w-[300px] md:max-w-[340px]
        w-full flex flex-col justify-between items-center text-center border border-[#DAD5E4] 
        transition-transform duration-300 hover:-translate-y-2 hover:scale-105 hover:shadow-2xl relative
        ${show ? animationClass : "opacity-0 translate-y-8"}
      `}
      style={{ animationDelay }}
    >
      <div>
        <span className={`text-4xl sm:text-3xl md:text-5xl mb-3 sm:mb-2 md:mb-3 ${iconColor} block`}>
          {icon}
        </span>
        <h4 className="text-lg sm:text-base md:text-xl font-semibold mb-2 sm:mb-1 md:mb-2 text-[#2E2E3A]">
          {title}
        </h4>
        <p className="text-base sm:text-sm md:text-lg text-[#5B5B6B] mb-3 sm:mb-2 md:mb-3">
          {description}
        </p>
      </div>
      <div className="w-full flex justify-center mt-3 sm:mt-2 md:mt-3">
        <span
          className={`inline-flex items-center gap-2 ${badgeBg} ${badgeColor} px-4 sm:px-3 md:px-4 py-2 sm:py-1 md:py-2 rounded-full text-sm sm:text-xs md:text-base font-semibold shadow-sm`}
        >
          <span className="text-xl sm:text-lg md:text-xl">{badgeIcon}</span>
          {badgeText}
        </span>
      </div>
    </div>
  );
}