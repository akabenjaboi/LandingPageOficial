import { IMG } from "./assets";

export default function Footer() {
  return (
    <footer className="relative">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-5 px-6 py-[26px]">
        <div className="flex items-center gap-2.5">
          <img src={IMG.favicon} alt="" className="h-7 w-7 rounded-[9px]" />
          <span className="text-sm text-[#5B5B6B]">TeamZen © {new Date().getFullYear()}</span>
        </div>
        <div className="flex gap-[22px]">
          <a href="#privacidad" className="text-sm text-[#8B6FB8] hover:text-[#9D83C6]">Privacidad</a>
          <a href="/terminos" className="text-sm text-[#8B6FB8] hover:text-[#9D83C6]">Términos</a>
          <a href="/contacto" className="text-sm text-[#8B6FB8] hover:text-[#9D83C6]">Contacto</a>
        </div>
      </div>
    </footer>
  );
}
