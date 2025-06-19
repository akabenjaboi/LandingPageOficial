import "./navbar.css";
import React, { useState, useEffect } from "react";

const navItems = [
  { name: "Inicio", href: "#top" },
  { name: "Nosotros", href: "#nosotros" },
  { name: "Servicios", href: "#servicios" },
  { name: "Equipo", href: "#equipo" },
];

export default function Navbar() {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false); // Nuevo estado

  useEffect(() => {
    const timeout = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Maneja el cierre con animación
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
    }, 350); // Duración igual a la animación de salida
  };

  return (
    <nav className="w-full fixed top-0 left-0 z-50">
      {/* Desktop Navbar */}
      <div
        className={`hidden md:flex justify-center w-full mt-6 transition-all duration-700 ease-out
        ${show ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-8"}`}
      >
        <div className="backdrop-blur-md bg-[#FAF9F6]/80 border border-[#DAD5E4] rounded-2xl shadow-xl px-8 py-3 flex gap-6 items-center transition-all duration-300">
          {navItems.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="relative px-4 py-2 font-semibold text-[#2E2E3A] transition-all duration-300 hover:text-[#FAF9F6] group"
            >
              <span className="absolute inset-0 rounded-xl scale-95 opacity-0 group-hover:opacity-100 group-hover:scale-100 bg-gradient-to-tr from-[#55C2A2] via-[#9D83C6] to-[#DAD5E4] blur-sm transition-all duration-300 z-0"></span>
              <span className="absolute inset-0 rounded-xl scale-95 opacity-0 group-hover:opacity-100 group-hover:scale-100 bg-gradient-to-tr from-[#55C2A2] via-[#9D83C6] to-[#DAD5E4] transition-all duration-300 z-10"></span>
              <span className="relative z-20">{item.name}</span>
            </a>
          ))}
        </div>
      </div>
      {/* Mobile Navbar */}
      <div className="flex md:hidden justify-between items-center px-4 py-3 bg-[#FAF9F6]/95 border-b border-[#DAD5E4]">
        <span className="text-2xl font-extrabold text-[#2E2E3A] select-none">
          Team<span className="text-[#55C2A2]">Zen</span>
        </span>
        <button
          className="p-2 rounded-lg bg-[#FAF9F6]/80 border border-[#DAD5E4] shadow-md"
          onClick={() => setOpen(!open)}
          aria-label="Abrir menú"
        >
          <svg
            className="w-7 h-7 text-[#2E2E3A]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
            )}
          </svg>
        </button>
        {(open || isClosing) && (
          <div
            className={`fixed inset-0 bg-[#FAF9F6]/98 z-50 flex flex-col items-center justify-center gap-8
              ${isClosing ? "animate-fadeout" : "animate-fadein"}`}
          >
            <button
              className="absolute top-6 right-8 p-2"
              onClick={handleClose}
              aria-label="Cerrar menú"
            >
              <svg
                className="w-8 h-8 text-[#2E2E3A]"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {navItems.map((item, idx) => (
              <a
                key={item.name}
                href={item.href}
                className={`text-2xl font-bold text-[#2E2E3A] px-8 py-3 rounded-xl hover:bg-[#55C2A2] hover:text-[#FAF9F6] transition-all duration-300
                  animate-slideup`}
                style={{ animationDelay: `${0.1 + idx * 0.08}s` }}
                onClick={handleClose}
              >
                {item.name}
              </a>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}