import { Chip, Eyebrow, Meter } from "./ui";

const DIMENSIONES = [
  { titulo: "Agotamiento", rango: "2 – 10", texto: "Cuánta energía queda al final del día. Baja primero y avisa antes que el resto.", meter: 46, color: "mint" },
  { titulo: "Cinismo / distanciamiento", rango: "2 – 10", texto: "Distancia y cinismo hacia el trabajo y las personas con las que se trabaja.", meter: 28, color: "purple" },
  { titulo: "Eficacia percibida", rango: "2 – 10", texto: "Sensación de logro y competencia. Acá un puntaje alto es buena señal.", meter: 72, color: "mint" },
];

export default function Dimensiones() {
  return (
    <section id="metodo" className="relative mx-auto max-w-[1120px] px-6 py-[72px]">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Eyebrow tone="mint">Qué medimos</Eyebrow>
          <h2 className="font-['Poppins',_Arial,_sans-serif] text-[30px] font-bold leading-[1.14] tracking-[-.02em] text-[#2E2E3A] lg:text-[38px]">
            Un cuestionario breve, tres dimensiones
          </h2>
          <p className="max-w-[34em] text-[17px] text-[#5B5B6B] [text-wrap:pretty]">
            Cada ronda evalúa tres dimensiones del desgaste laboral y devuelve un puntaje por
            dimensión, más un índice de bienestar de 0 a 100 comparable entre rondas.
          </p>
          <div className="mt-1 flex flex-wrap gap-2.5">
            <Chip>6 preguntas · 2 minutos</Chip>
            <Chip>Rondas de 7 días</Chip>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          {DIMENSIONES.map((d) => (
            <div
              key={d.titulo}
              className="flex flex-col gap-2.5 rounded-2xl border border-[#DAD5E4] bg-white p-5 shadow-[0_10px_25px_rgba(85,194,162,.12),0_4px_10px_rgba(157,131,198,.08)] transition hover:border-[#55C2A2] hover:shadow-[0_25px_50px_rgba(85,194,162,.2),0_10px_20px_rgba(157,131,198,.12)]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-['Poppins',_Arial,_sans-serif] text-lg font-semibold text-[#2E2E3A]">{d.titulo}</h3>
                <span className="text-[13px] tabular-nums text-[#5B5B6B]">{d.rango}</span>
              </div>
              <p className="text-sm text-[#5B5B6B]">{d.texto}</p>
              <Meter value={d.meter} color={d.color} height={6} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
