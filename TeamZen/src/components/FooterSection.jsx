import React from "react";

export default function Footer() {
  return (
    <footer className="bg-[#FAF9F6] border-t border-[#DAD5E4] pt-10 pb-4 px-0 mt-5 w-full relative overflow-hidden">
      <div className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between items-center gap-8 px-20">
        {/* Descripción con imagen arriba */}
        <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
          {/* Imagen pequeña y justo arriba de la descripción */}
          <img
            src={`${import.meta.env.BASE_URL}/img/footerimg.png`}
            alt="Decoración TeamZen"
            className="w-30 h-auto mb-3 pointer-events-none select-none"
            style={{ maxWidth: "300px" }}
          />
          <p className="text-base md:text-lg text-[#5B5B6B] max-w-sm mx-auto md:mx-0">
            TeamZen es una plataforma digital que impulsa el bienestar y la
            colaboración en equipos, combinando tecnología y empatía para
            transformar la cultura organizacional.
          </p>
        </div>

        {/* Registro de correo con frase arriba */}
        <div className="flex flex-col items-center mt-6 md:mt-0">
          <span className="text-lg sm:text-xl md:text-2xl font-semibold text-[#2E2E3A] mb-4">
            Sé el primero en enterarte
          </span>
          <form
            className="flex flex-col sm:flex-row items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              // Aquí puedes manejar el registro de correo
            }}
          >
            <input
              type="email"
              required
              placeholder="Tu correo electrónico"
              className="rounded-full border border-[#DAD5E4] px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#55C2A2] bg-white"
            />
            <button
              type="submit"
              className="rounded-full bg-[#55C2A2] hover:bg-[#9D83C6] text-white font-semibold px-5 py-2 transition-colors"
            >
              Notificarme
            </button>
          </form>
          {/* Redes sociales debajo del form */}
          <div className="flex items-center gap-4 mt-4">
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-[#9D83C6] hover:text-[#55C2A2] transition-colors text-2xl"
            >
              <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5zm4.25 3.25a5.25 5.25 0 1 1 0 10.5 5.25 5.25 0 0 1 0-10.5zm0 1.5a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5zm5.25.75a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-[#9D83C6] hover:text-[#55C2A2] transition-colors text-2xl"
            >
              <svg width="28" height="28" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11.75 20h-3v-10h3v10zm-1.5-11.25c-.97 0-1.75-.78-1.75-1.75s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.75-1.75 1.75zm15.25 11.25h-3v-5.5c0-1.1-.9-2-2-2s-2 .9-2 2v5.5h-3v-10h3v1.25c.41-.59 1.36-1.25 2.5-1.25 1.93 0 3.5 1.57 3.5 3.5v6.5z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Línea y copyright */}
      <div className="mt-10 border-t border-[#DAD5E4] pt-4 text-center text-sm text-[#1F1F1F] opacity-80">
        © {new Date().getFullYear()} TeamZen — Plataforma digital para equipos.
      </div>
    </footer>
  );
}