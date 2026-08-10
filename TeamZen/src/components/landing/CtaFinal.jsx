import { IMG } from "./assets";
import { CtaButton } from "./ui";

export default function CtaFinal({ onRequestDemo }) {
  return (
    <section className="relative mx-auto max-w-[1120px] px-6 pb-[76px] pt-6">
      <div className="flex flex-wrap items-center justify-between gap-9 rounded-[32px] border border-[#DAD5E4] bg-[linear-gradient(135deg,rgba(85,194,162,.16),rgba(157,131,198,.18))] p-10">
        <div className="flex min-w-[280px] flex-1 items-center gap-6">
          <img src={IMG.formPanda} alt="" className="h-[110px] w-[110px] shrink-0 rounded-3xl object-cover" />
          <div className="flex flex-col gap-2">
            <h2 className="font-['Poppins',_Arial,_sans-serif] text-[26px] font-bold leading-[1.14] tracking-[-.02em] text-[#2E2E3A] lg:text-[32px]">
              ¿Vemos TeamZen con tu equipo?
            </h2>
            <p className="text-base text-[#5B5B6B]">Equipos más saludables, trabajo más productivo.</p>
          </div>
        </div>
        <CtaButton onClick={onRequestDemo} className="px-8 py-4">Solicitar una demo</CtaButton>
      </div>
    </section>
  );
}
