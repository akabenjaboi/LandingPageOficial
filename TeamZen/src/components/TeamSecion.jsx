import React from "react";
import useInView from "../hooks/useInView";
import LazyImage from "./LazyImage";

const team = [
  {
    name: "Sebastian Sepulveda",
    role: "Desarrollador movil",
    img: "/img/perfil2.jpg",
    desc: "Desarrolla y optimiza la experiencia móvil de la plataforma.",
  },
  {
    name: "Benjamín Alarcón",
    role: "Product Owner",
    img: "/img/perfil1.jpg",
    desc: "Lidera la visión y prioriza el desarrollo del producto.",
  },
  {
    name: "Vicente Aranguiz",
    role: "Backend Developer",
    img: "/img/perfil3.jpg",
    desc: "Construye y mantiene la infraestructura backend del sistema.",
  },
];

function TeamCard({ member, show, animationDelay }) {
  return (
    <div
      className={`group flex flex-col items-center bg-[#FAF9F6] rounded-2xl border-4 border-[#DAD5E4] shadow-teamzen p-8 min-h-[340px] max-w-[320px] w-full transition-all duration-700
        ${show ? "animate-fadein-up opacity-100" : "opacity-0 translate-y-8"}
        hover:scale-105 hover:shadow-teamzen-strong hover:border-[#55C2A2]
        cursor-pointer
      `}
      style={{ animationDelay }}
    >
      <div className="w-28 h-28 rounded-full overflow-hidden mb-4 border-4 border-[#DAD5E4] flex items-center justify-center transition-all duration-300 bg-opacity-80">
        <LazyImage
          src={member.img}
          alt={member.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          placeholder={
            <div className="w-full h-full bg-gradient-to-br from-[#55C2A2]/30 to-[#9D83C6]/30 animate-pulse rounded-full" />
          }
        />
      </div>
      <h4 className="text-lg md:text-xl font-semibold mb-1 text-[#2E2E3A] text-center">
        {member.name}
      </h4>
      <p className="text-base md:text-lg text-[#8160B6] font-semibold text-center">
        {member.role}
      </p>
      <p className="text-base md:text-lg text-[#5B5B6B] text-center mt-2">{member.desc}</p>
    </div>
  );
}

export default function TeamSecion() {
  const [teamRef, teamInView] = useInView({ threshold: 0.15 });

  return (
    <section
      id="equipo"
      ref={teamRef}
      className="scroll-mt-32 w-full max-w-6xl mx-auto my-16 px-2 sm:px-4 flex flex-col items-center"
    >
      <h2
        className={`text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2E2E3A] text-center mb-4 tracking-tight transition-all duration-700
          ${teamInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
        `}
      >
        Nuestro equipo
      </h2>
      <p
        className={`text-base sm:text-lg text-[#5B5B6B] text-center max-w-2xl mb-16 leading-relaxed transition-all duration-700 delay-100
          ${teamInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
        `}
      >
        Las personas reales detrás de TeamZen, no un logo de cliente inventado.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 w-full justify-items-center">
        {team.map((member, idx) => (
          <TeamCard
            key={member.name}
            member={member}
            show={teamInView}
            animationDelay={`${0.1 + idx * 0.15}s`}
          />
        ))}
      </div>
    </section>
  );
}