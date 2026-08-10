// ===================================================================
// FORMULARIO DE CREACIÓN DE EQUIPO (compartido)
// ===================================================================
// Unifica las dos implementaciones que existían antes (la página
// standalone /crear-equipo y el panel inline del dashboard, que
// ofrecían distintos controles de privacidad): un solo set de campos,
// reutilizado en ambos contextos. El contenedor visual (página vs.
// InlinePanel) lo decide quien lo monta, este componente solo sabe
// crear el equipo y mostrar el código resultante.
// ===================================================================
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Field, Check, Btn, Notice, Alert } from './app-ui';

const PRIVACY_TOGGLES = (state, setState) => [
  {
    key: 'includeLeader',
    checked: state.includeLeader,
    onChange: () => setState((s) => ({ ...s, includeLeader: !s.includeLeader })),
    title: 'Incluir al líder en las métricas',
    help: 'Si lo desactivas, tu participación y puntaje no cuentan en el promedio del equipo.',
  },
  {
    key: 'seeOthers',
    checked: state.seeOthers,
    onChange: () => setState((s) => ({ ...s, seeOthers: !s.seeOthers })),
    title: 'Los miembros pueden ver a otros integrantes',
    help: 'Si lo desactivas, cada persona solo se ve a sí misma en el listado.',
  },
  {
    key: 'seeResponses',
    checked: state.seeResponses,
    onChange: () => setState((s) => ({ ...s, seeResponses: !s.seeResponses })),
    title: 'Los miembros pueden ver si otros ya respondieron',
    help: 'Si lo desactivas, el estado de los demás aparece como "Privado".',
  },
];

export default function CreateTeamForm({ resetOn = true, onCancel, onTeamCreated, onDone, doneLabel = 'Ir al dashboard', onLoadingChange, onSuccessChange }) {
  const [userId, setUserId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [flags, setFlags] = useState({ includeLeader: true, seeOthers: true, seeResponses: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // Se resetea cada vez que `resetOn` pasa a un valor verdadero — permite que
  // el panel inline del dashboard vuelva a mostrar el formulario en blanco
  // cada vez que se reabre, en vez de conservar el envío anterior.
  useEffect(() => {
    if (!resetOn) return;
    setTeamName('');
    setDescription('');
    setFlags({ includeLeader: true, seeOthers: true, seeResponses: true });
    setLoading(false);
    setError(null);
    setSuccess(false);
    setInviteCode(null);
    setCopied(false);
  }, [resetOn]);

  useEffect(() => { onLoadingChange?.(loading); }, [loading, onLoadingChange]);
  useEffect(() => { onSuccessChange?.(success); }, [success, onSuccessChange]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profileError || profile?.role !== 'leader') {
        throw new Error('No tienes permisos para crear un equipo.');
      }

      const { data: newTeam, error: teamError } = await supabase
        .from('teams')
        .insert([{
          name: teamName,
          description,
          leader_id: userId,
          join_policy: 'code',
          include_leader_in_metrics: flags.includeLeader,
          members_can_see_others: flags.seeOthers,
          members_can_see_responses: flags.seeResponses,
        }])
        .select()
        .single();

      if (teamError || !newTeam?.id) {
        throw new Error('Error al crear el equipo.');
      }

      const { data: codeResult, error: codeError } = await supabase
        .rpc('regenerate_team_invite_code', { p_team_id: newTeam.id })
        .single();

      if (codeError || !codeResult?.code) {
        throw new Error('Equipo creado, pero ocurrió un error al generar el código.');
      }

      setInviteCode(codeResult.code);
      setSuccess(true);
      onTeamCreated?.(newTeam, codeResult.code);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard permisos denegados: no bloquear la UI */ }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-[18px] py-2 text-center">
        <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-[rgba(85,194,162,.18)] text-[28px] text-[#3d8a74]">✓</span>
        <h2 className="font-['Poppins',_Arial,_sans-serif] text-[26px] font-bold text-[#2E2E3A]">¡Equipo creado!</h2>
        <p className="max-w-[34em] text-base text-[#5B5B6B]">
          Comparte este código con tu equipo. Cada persona lo usa una vez para unirse; puedes regenerarlo cuando quieras.
        </p>
        <div className="flex flex-col items-center gap-2 rounded-[20px] border border-[#DAD5E4] bg-[linear-gradient(135deg,rgba(85,194,162,.14),rgba(157,131,198,.16))] px-[34px] py-[22px]">
          <span className="text-[11px] font-bold uppercase tracking-[.08em] text-[#5B5B6B]">Código de invitación</span>
          <span className="font-['Poppins',_Arial,_sans-serif] text-[38px] font-extrabold tracking-[.22em] text-[#2E2E3A]">{inviteCode}</span>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Btn variant="secondary" onClick={copyCode}>{copied ? 'Copiado' : 'Copiar'} código</Btn>
          <Btn onClick={onDone}>{doneLabel}</Btn>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleCreateTeam} className="flex flex-col gap-5">
      <Field
        label="Nombre del equipo *"
        placeholder="Ej: Equipo de Desarrollo, Marketing Team..."
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        required
        disabled={loading}
      />
      <Field
        as="textarea"
        label="Descripción"
        value={description}
        onChange={(e) => setDescription(e.target.value.slice(0, 200))}
        placeholder="Describe brevemente el área, departamento o función del equipo — esto alimenta el análisis de IA."
        rows={3}
        maxLength={200}
        disabled={loading}
        hint={`${description.length} / 200`}
      />

      <div className="flex flex-col gap-3">
        <h3 className="font-['Poppins',_Arial,_sans-serif] text-base font-semibold text-[#2E2E3A]">Métricas y privacidad</h3>
        {PRIVACY_TOGGLES(flags, setFlags).map((t) => (
          <label key={t.key} className="flex items-start gap-3.5 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] p-4">
            <Check checked={t.checked} onChange={t.onChange} />
            <span>
              <span className="font-['Poppins',_Arial,_sans-serif] text-[15px] font-semibold text-[#2E2E3A]">{t.title}</span>
              <p className="mt-0.5 text-sm text-[#5B5B6B]">{t.help}</p>
            </span>
          </label>
        ))}
      </div>

      <Notice>
        Los miembros se unen con un <strong className="font-bold">código de invitación</strong> que se genera automáticamente al crear el equipo.
      </Notice>

      {error && <Alert title="Error al crear equipo">{error}</Alert>}

      <div className="flex flex-wrap justify-end gap-3">
        <Btn type="button" variant="secondary" onClick={onCancel} disabled={loading}>Cancelar</Btn>
        <Btn type="submit" disabled={loading || !teamName.trim()}>{loading ? 'Creando equipo...' : 'Crear equipo'}</Btn>
      </div>
    </form>
  );
}
