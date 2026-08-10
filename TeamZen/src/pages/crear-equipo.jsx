import { useNavigate } from 'react-router-dom';
import { Card, Btn } from '../components/app-ui';
import CreateTeamForm from '../components/CreateTeamForm';

export default function CrearEquipo() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <main className="mx-auto flex max-w-[760px] flex-col gap-[22px] px-4 pb-16 pt-8 sm:px-6">
        <div className="flex flex-wrap items-center gap-[18px]">
          <img src="/img/pandapintando.png" alt="" className="h-[72px] w-[72px] shrink-0 rounded-3xl object-cover sm:h-[88px] sm:w-[88px]" />
          <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
            <h1 className="font-['Poppins',_Arial,_sans-serif] text-[26px] font-bold tracking-[-.02em] text-[#2E2E3A] sm:text-3xl">Crear nuevo equipo</h1>
            <p className="text-base text-[#5B5B6B]">Define el equipo y comparte el código de invitación con quienes lo integran.</p>
          </div>
          <Btn variant="ghost" onClick={() => navigate('/dashboard')}>← Volver al dashboard</Btn>
        </div>

        <Card pad="p-7">
          <CreateTeamForm onCancel={() => navigate('/dashboard')} onDone={() => navigate('/dashboard')} doneLabel="Ir al dashboard" />
        </Card>
      </main>
    </div>
  );
}
