import React from "react";
import SplitText from "./ReactBits/SplitText/SplitText";

const handleAnimationComplete = () => {
  console.log("All letters have animated!");
};

export default function AboutSection({ sobreRef, sobreInView }) {
  return (
    <section
      id="nosotros"
      ref={sobreRef}
      className="scroll-mt-32 w-full max-w-6xl mx-auto my-16 px-2 sm:px-4 flex flex-col items-center mt-30"
    >
      <h3
        className={`text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#2E2E3A] text-center mb-4 drop-shadow-lg tracking-tight transition-all duration-700
          ${sobreInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
        `}
      >
        Sobre TeamZen
      </h3>
      <p
        className={`text-lg sm:text-xl md:text-2xl font-bold text-[#2E2E3A] text-center max-w-3xl mb-4 leading-snug drop-shadow transition-all duration-700 delay-100
          ${sobreInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
        `}
      >
        TeamZen nació para{" "}
        <span className="text-[#55C2A2]">humanizar el trabajo</span> desde el{" "}
        <span className="text-[#9D83C6]">bienestar emocional</span>.
      </p>
      {/* Responsive collage */}
      <div className="flex flex-col md:flex-row items-center justify-center w-full gap-4 md:gap-0 relative h-auto md:h-[340px] lg:h-[420px] mb-4">
        {/* Imagen izquierda */}
        <img
          src={`${import.meta.env.BASE_URL}/img/pandadescansando.png`}
          alt="TeamZen inspiración 1"
          className={`rounded-2xl shadow-lg object-cover w-full max-w-[320px] h-[140px] sm:h-[180px] md:h-[220px] lg:h-[260px] aspect-[16/9] opacity-90 transition-all duration-700 hover:scale-105
            ${sobreInView ? "opacity-90 md:absolute md:left-1/2 md:-translate-x-[150%] md:top-1/2 md:-translate-y-1/3 -rotate-8" : "opacity-0 md:absolute md:left-1/2 md:-translate-x-[120%] md:top-1/2 md:-translate-y-1/3 -rotate-8"}
          `}
          style={{
            zIndex: 10,
            transform: "scaleX(-1)",
          }}
        />
        {/* Imagen central */}
        <img
          src={`${import.meta.env.BASE_URL}/img/pandalogo.png`}
          alt="TeamZen inspiración 2"
          className={`rounded-2xl shadow-2xl object-cover w-full max-w-[360px] h-[160px] sm:h-[200px] md:h-[270px] lg:h-[340px] aspect-[16/9] transition-all duration-700 hover:scale-105
            ${sobreInView ? "opacity-100 md:relative md:z-20 md:top-1/2 md:-translate-y-1/2" : "opacity-0 translate-y-8"}
          `}
        />
        {/* Imagen derecha */}
        <img
          src={`${import.meta.env.BASE_URL}/img/pandapintando.png`}
          alt="TeamZen inspiración 3"
          className={`rounded-2xl shadow-lg object-cover w-full max-w-[320px] h-[140px] sm:h-[180px] md:h-[220px] lg:h-[260px] aspect-[16/9] opacity-90 transition-all duration-700 hover:scale-105
            ${sobreInView ? "opacity-90 md:absolute md:right-1/2 md:translate-x-[150%] md:top-1/2 md:-translate-y-1/3 rotate-8" : "opacity-0 md:absolute md:right-1/2 md:translate-x-[120%] md:top-1/2 md:-translate-y-1/3 rotate-8"}
          `}
          style={{
            zIndex: 10,
          }}
        />
      </div>
      
      {/* SplitText destacado */}
      <div className="w-full justify-center mt-30 px-2 hidden lg:block">
        <SplitText
          text={
            <>
              <span className="text-[#55C2A2] font-extrabold">Anticiparse</span> es clave:{" "}
              <span className="text-[#9D83C6] font-bold">TeamZen</span> es el primer software que transforma{" "}
              <span className="text-[#55C2A2] font-bold">señales emocionales</span> en{" "}
              <span className="font-extrabold">prevención real</span> del{" "}
              <span className="text-[#2E2E3A] font-extrabold">agotamiento laboral</span>.
            </>
          }
          className="text-[1rem] sm:text-[6rem] md:text-[8rem] lg:text-[4rem] font-extrabold text-center text-[#2E2E3A] leading-snug drop-shadow-lg break-words sm:break-normal"
          delay={20}
          duration={0.5}
          ease="elastic.out(1, 0.9)"
          splitType="chars"
          from={{ opacity: 0, y: 40 }}
          to={{ opacity: 1, y: 0 }}
          threshold={0.1}
          rootMargin="-50px"
          textAlign="center"
          onLetterAnimationComplete={handleAnimationComplete}
        />
      </div>
    </section>
  );
}