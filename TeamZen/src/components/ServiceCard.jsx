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
      className={`bg-[#FAF9F6] rounded-2xl shadow-teamzen 
        p-6 sm:p-5 md:p-5 lg:p-6
        min-h-[280px] sm:min-h-[240px] md:min-h-[260px]
        max-w-[95vw] sm:max-w-[300px] md:max-w-[340px]
        w-full flex flex-col justify-between items-center text-center 
        border border-[#DAD5E4] hover:border-[#55C2A2]
        transition-all duration-500 hover:-translate-y-3 hover:scale-105 
        hover:shadow-teamzen-strong hover:bg-gradient-to-br hover:from-[#FAF9F6] hover:to-[#DAD5E4]/20
        relative group overflow-hidden
        ${show ? animationClass : "opacity-0 translate-y-8"}
      `}
      style={{ animationDelay }}
    >
      {/* Efecto de brillo en hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent 
                      translate-x-[-100%] group-hover:translate-x-[100%] 
                      transition-transform duration-1000 ease-out"></div>
      
      <div className="relative z-10">
        <div className="mb-4 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#55C2A2]/20 to-[#9D83C6]/20 
                          rounded-full blur-xl opacity-0 group-hover:opacity-100 
                          transition-opacity duration-300 scale-150"></div>
          <span className={`text-5xl sm:text-4xl md:text-6xl ${iconColor} 
                           relative z-10 block group-hover:animate-gentle-rotate
                           transition-all duration-300 group-hover:scale-110`}>
            {icon}
          </span>
        </div>
        
        <h4 className="text-xl sm:text-lg md:text-2xl font-bold mb-3 sm:mb-2 md:mb-3 
                       text-[#2E2E3A] group-hover:text-gradient transition-all duration-300">
          {title}
        </h4>
        
        <p className="text-base sm:text-sm md:text-lg text-[#5B5B6B] mb-4 sm:mb-3 md:mb-4 
                      leading-relaxed group-hover:text-[#2E2E3A] transition-colors duration-300">
          {description}
        </p>
      </div>
      
      <div className="w-full flex justify-center mt-auto relative z-10">
        <span className={`inline-flex items-center gap-2 ${badgeBg} ${badgeColor} 
                         px-5 sm:px-4 md:px-5 py-2.5 sm:py-2 md:py-2.5 
                         rounded-full text-sm sm:text-xs md:text-sm font-semibold 
                         shadow-md border border-[#DAD5E4]/50
                         group-hover:shadow-lg group-hover:scale-105
                         transition-all duration-300`}>
          <span className="text-xl sm:text-lg md:text-xl animate-pulse-glow">{badgeIcon}</span>
          {badgeText}
        </span>
      </div>
    </div>
  );
}