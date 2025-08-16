import React from "react";
import useInView from "../hooks/useInView";

const team = [
  {
    name: "Sebastian Sepulveda",
    role: "Desarrollador movil",
    img: "/img/perfil2.jpg",
    desc: "Desarrolla y optimiza la experiencia móvil de la app.",
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
      className={`group flex flex-col items-center bg-white rounded-2xl border-4 border-[#DAD5E4] shadow-[0_4px_24px_0_rgba(46,46,58,0.10)] p-8 min-h-[340px] max-w-[320px] w-full transition-all duration-700
        ${show ? "animate-fadein-up opacity-100" : "opacity-0 translate-y-8"}
        hover:scale-105 hover:shadow-2xl hover:border-[#55C2A2]
        cursor-pointer
      `}
      style={{ animationDelay }}
    >
      <div className="w-28 h-28 rounded-full overflow-hidden mb-4 border-4 border-[#DAD5E4] flex items-center justify-center transition-all duration-300 bg-opacity-80">
        <img
          src={member.img}
          alt={member.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
        />
      </div>
      <h4 className="text-lg md:text-xl font-semibold mb-1 text-[#2E2E3A] text-center">
        {member.name}
      </h4>
      <p className="text-base md:text-lg text-[#9D83C6] font-semibold text-center">
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
      <h3
        className={`text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2E2E3A] text-center mb-20 drop-shadow-lg tracking-tight transition-all duration-700
          ${teamInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
        `}
      >
        Nuestro Equipo
      </h3>
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