import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Card, Btn, Check, Dot, Alert } from '../components/app-ui';

const STEPS = ['Código', 'Confirmar', 'Listo'];
const STEP_INDEX = { 'enter-code': 1, confirm: 2, success: 3 };

const CONSENT = [
  { tone: 'mint', text: 'Vas a poder responder evaluaciones de forma privada.' },
  { tone: 'mint', text: 'Tus respuestas individuales no se muestran a tu líder por defecto — solo un promedio del equipo, y nunca con menos de 3 personas respondiendo.' },
  { tone: 'purple', text: 'Puedes elegir compartir tus resultados individuales con el líder, y cambiar esa decisión después.' },
];
const NEXT = [
  { tone: 'mint', text: 'Podrás ver a los demás miembros del equipo.' },
  { tone: 'mint', text: 'Próximamente podrás realizar evaluaciones de bienestar.' },
  { tone: 'purple', text: 'Recibirás consejos personalizados según tus resultados.' },
];

export default function UnirseEquipo() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('enter-code'); // 'enter-code' | 'confirm' | 'success'
  const [error, setError] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [shareResults, setShareResults] = useState(false);

  // Obtener usuario autenticado
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) navigate('/login');
    });
  }, [navigate]);

  const handlePreview = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // La validación real (código válido, no expirado, política de unión)
      // ocurre en la base de datos (preview_team_invite_code), no en el
      // cliente — este paso solo muestra qué equipo es antes de unirte.
      const { data, error: previewError } = await supabase
        .rpc('preview_team_invite_code', { p_code: code.toUpperCase() })
        .single();

      if (previewError) {
        throw new Error(previewError.message || 'No se pudo verificar el código.');
      }

      setTeamName(data.team_name);
      setShareResults(false);
      setStep('confirm');
    } catch (err) {
      console.error('Error al verificar el código:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmJoin = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validación + verificación de membresía + insert ocurren atómicamente
      // en la base de datos (join_team_with_code), incluyendo la elección de
      // compartir resultados hecha en esta misma pantalla.
      const { error: joinError } = await supabase
        .rpc('join_team_with_code', { p_code: code.toUpperCase(), p_share_results: shareResults })
        .single();

      if (joinError) {
        throw new Error(joinError.message || 'No se pudo unir al equipo.');
      }

      setCode('');
      setStep('success');
    } catch (err) {
      console.error('Error al unirse al equipo:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelConfirm = () => {
    setStep('enter-code');
    setTeamName('');
    setError(null);
  };

  const currentStepNum = STEP_INDEX[step];

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <main className="mx-auto flex max-w-[680px] flex-col gap-[22px] px-4 pb-16 pt-8 sm:px-6">
        <div className="flex flex-wrap items-center gap-[18px]">
          <img src="/img/formpanda.png" alt="" className="h-[72px] w-[72px] shrink-0 rounded-3xl object-cover sm:h-[88px] sm:w-[88px]" />
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <h1 className="font-['Poppins',_Arial,_sans-serif] text-[26px] font-bold tracking-[-.02em] text-[#2E2E3A] sm:text-3xl">Unirse a un equipo</h1>
            <p className="text-base text-[#5B5B6B]">Pide el código de 6 letras a quien lidera el equipo.</p>
          </div>
          <Btn variant="ghost" onClick={() => navigate('/dashboard')}>← Volver al dashboard</Btn>
        </div>

        <div className="flex items-center gap-2.5">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const on = currentStepNum >= n;
            return (
              <div key={label} className="flex flex-1 items-center gap-2.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-['Poppins',_Arial,_sans-serif] text-[13px] font-bold ${on ? 'bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] text-white' : 'border-[1.5px] border-[#DAD5E4] bg-[#FAF9F6] text-[#5B5B6B]'}`}>
                  {currentStepNum > n ? '✓' : n}
                </span>
                <span className={`whitespace-nowrap font-['Poppins',_Arial,_sans-serif] text-[13px] font-semibold ${on ? 'text-[#2E2E3A]' : 'text-[#5B5B6B]'}`}>{label}</span>
                {i < STEPS.length - 1 && <span className="h-0.5 flex-1 rounded-sm bg-[#DAD5E4]" />}
              </div>
            );
          })}
        </div>

        <Card pad="p-7" className="flex flex-col gap-5">
          {step === 'enter-code' && (
            <form onSubmit={handlePreview} className="flex flex-col gap-4">
              <h2 className="font-['Poppins',_Arial,_sans-serif] text-xl font-semibold text-[#2E2E3A]">Ingresa el código de invitación</h2>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                maxLength={6}
                autoFocus
                className="rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] px-4 py-[18px] text-center font-['Poppins',_Arial,_sans-serif] text-[28px] font-bold uppercase tracking-[.28em] text-[#2E2E3A] outline-none transition focus:border-[#55C2A2] focus:bg-white focus:shadow-[0_0_0_3px_rgba(85,194,162,.22)]"
              />
              <span className="text-center text-[13px] text-[#5B5B6B]">Los códigos tienen 6 letras y son únicos por equipo.</span>
              <Btn type="submit" disabled={loading || code.length < 6} className="justify-center">
                {loading ? 'Verificando código...' : 'Continuar'}
              </Btn>
            </form>
          )}

          {step === 'confirm' && (
            <div className="flex flex-col gap-[18px]">
              <h2 className="font-['Poppins',_Arial,_sans-serif] text-xl font-semibold text-[#2E2E3A]">Antes de unirte a {teamName}</h2>
              <p className="text-[15px] text-[#5B5B6B]">
                Este equipo usa TeamZen para medir su bienestar con evaluaciones periódicas. Esto es lo que debes saber:
              </p>
              <div className="flex flex-col gap-2.5">
                {CONSENT.map((c) => (
                  <div key={c.text} className="flex items-start gap-3 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] px-4 py-3.5">
                    <Dot tone={c.tone} size={8} className="mt-[7px]" />
                    <span className="text-sm text-[#2E2E3A]">{c.text}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-3.5 rounded-2xl border border-[rgba(157,131,198,.3)] bg-[rgba(157,131,198,.1)] p-4">
                <Check checked={shareResults} onChange={() => setShareResults((v) => !v)} />
                <div>
                  <h4 className="font-['Poppins',_Arial,_sans-serif] text-[15px] font-semibold text-[#2E2E3A]">Compartir mis resultados individuales con el líder de este equipo</h4>
                  <p className="mt-0.5 text-sm text-[#5B5B6B]">Opcional. Por defecto está desactivado.</p>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <Btn variant="secondary" onClick={handleCancelConfirm} disabled={loading}>Cancelar</Btn>
                <Btn onClick={handleConfirmJoin} disabled={loading}>{loading ? 'Uniéndose...' : 'Unirme al equipo'}</Btn>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-[rgba(85,194,162,.18)] text-[28px] text-[#3d8a74]">✓</span>
              <h2 className="font-['Poppins',_Arial,_sans-serif] text-2xl font-bold text-[#2E2E3A]">¡Bienvenido al equipo!</h2>
              <div className="flex w-full flex-col gap-2.5 text-left">
                <h3 className="font-['Poppins',_Arial,_sans-serif] text-base font-semibold text-[#2E2E3A]">¿Qué sigue?</h3>
                {NEXT.map((n) => (
                  <div key={n.text} className="flex items-start gap-3 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] px-4 py-3.5">
                    <Dot tone={n.tone} size={8} className="mt-[7px]" />
                    <span className="text-sm text-[#2E2E3A]">{n.text}</span>
                  </div>
                ))}
              </div>
              <Btn onClick={() => navigate('/dashboard')} className="w-full justify-center">Ir al dashboard</Btn>
            </div>
          )}

          {error && <Alert title="Error al unirse al equipo">{error}</Alert>}
        </Card>

        <div className="flex items-start gap-3.5 rounded-[20px] border border-dashed border-[#DAD5E4] bg-[#DAD5E4]/35 p-[18px]">
          <Dot tone="purple" className="mt-[7px]" />
          <div>
            <h4 className="font-['Poppins',_Arial,_sans-serif] text-[15px] font-semibold text-[#2E2E3A]">¿No tienes un código?</h4>
            <p className="mt-0.5 text-sm text-[#5B5B6B]">
              Pídelo a quien lidera el equipo. Los códigos son únicos por equipo y se generan automáticamente — no hay forma de obtenerlos por cuenta propia.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
