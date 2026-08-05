import "./ServiceCard.css";
import React from "react";

export default function ServiceCard({
  icon,
  accent = "mint", // "mint" (action) | "purple" (reflection/analytical)
  title,
  description,
  show,
  animationDelay,
  animationClass = "animate-fadein-up",
}) {
  const isMint = accent === "mint";
  const iconWrapClass = isMint ? "bg-[#55C2A2]/10" : "bg-[#9D83C6]/10";
  const borderHoverClass = isMint ? "hover:border-[#55C2A2]" : "hover:border-[#9D83C6]";
  const iconColor = isMint ? "#55C2A2" : "#9D83C6";

  return (
    <div
      className={`bg-[#FAF9F6] rounded-2xl shadow-teamzen
        p-6 min-h-[220px]
        max-w-[95vw] sm:max-w-[300px] md:max-w-[340px]
        w-full flex flex-col items-center text-center
        border border-[#DAD5E4] ${borderHoverClass}
        transition-all duration-300 hover:-translate-y-2 hover:shadow-teamzen-strong
        ${show ? animationClass : "opacity-0 translate-y-8"}
      `}
      style={{ animationDelay }}
    >
      <div className={`w-14 h-14 rounded-full ${iconWrapClass} flex items-center justify-center mb-4`}>
        <span style={{ color: iconColor }} aria-hidden="true">
          {icon}
        </span>
      </div>

      <h4 className="text-lg font-bold mb-2 text-[#2E2E3A]">{title}</h4>

      <p className="text-sm sm:text-base text-[#5B5B6B] leading-relaxed">{description}</p>
    </div>
  );
}
