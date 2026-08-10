import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import AppNavbar from '../components/AppNavbar';
import LaunchMBIPanel from '../components/LaunchMBIPanel';
import { classifyIbdl, IBDL_CLASSIFICATION_NOTE } from '../utils/ibdlClassification';

export default function EvaluacionesPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState([]);
  const [launching, setLaunching] = useState(false);
  const [teams, setTeams] = useState([]);
  const [activeCycles, setActiveCycles] = useState({}); // {team_id: cycle_id}
  const [showLaunchPanel, setShowLaunchPanel] = useState(false);
  const [launchContext, setLaunchContext] = useState(null); // {teamId, teamName, activeCycleId, pendingMembers, totalMembers}
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Usamos rangos fijos proporcionados para clasificar

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user;
      if (!currentUser) { navigate('/login'); return; }
      setUser(currentUser);

      const { error: closeExpiredError } = await supabase.rpc('close_expired_ibdl_cycles');
      if (closeExpiredError) {
        console.warn('No se pudieron cerrar rondas vencidas', closeExpiredError);
      }

      const { data: prof, error: profError } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
      if (profError) {
        setError('No se pudo cargar tu perfil.');
        setLoading(false);
        return;
      }
      setProfile(prof);

      // Load personal evaluation history (scores join)
      const { data: respData, error: respError } = await supabase
        .from('ibdl_responses')
        .select('id, created_at, team_id, teams(name), ibdl_scores(ag_score,ci_score,ef_score)')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
      if (respError) {
        setError('No se pudo cargar tu historial de evaluaciones.');
      } else {
        setResponses(respData || []);
      }

      if (prof?.role === 'leader') {
        const { data: leaderTeams, error: teamsError } = await supabase
          .from('teams')
          .select('id,name')
          .eq('leader_id', currentUser.id);
        if (teamsError) {
          setError('No se pudieron cargar tus equipos.');
        } else {
          setTeams(leaderTeams || []);
          if (leaderTeams && leaderTeams.length > 0) {
            try {
              const { data: cycles, error: cyclesError } = await supabase
                .from('ibdl_evaluation_cycles')
                .select('id, team_id, status')
                .in('team_id', leaderTeams.map(t => t.id))
                .eq('status', 'active');
              if (cyclesError) {
                console.warn('No se pudieron cargar ciclos activos', cyclesError);
                setError('No se pudieron cargar las rondas activas de tus equipos.');
              } else {
                const map = {};
                (cycles || []).forEach(c => { map[c.team_id] = c.id; });
                setActiveCycles(map);
              }
            } catch (e) {
              console.warn('No se pudieron cargar ciclos activos', e);
              setError('No se pudieron cargar las rondas activas de tus equipos.');
            }
          }
        }
      }

      setLoading(false);
    };
    init();
  }, [navigate]);

  const prepareLaunch = async (team) => {
    setError(''); setSuccess('');
    const teamId = team.id;
    const activeCycleId = activeCycles[teamId];
    // Obtener miembros
    let members = [];
    try {
      const { data: teamMembers, error: membersError } = await supabase
        .from('team_members')
        .select('user_id, profiles(first_name,last_name)')
        .eq('team_id', teamId);
      if (membersError) {
        setError('No se pudo cargar la lista de miembros del equipo.');
        return;
      }
      members = teamMembers || [];
    } catch (e) {
      console.warn('No se pudieron cargar miembros', e);
      setError('No se pudo cargar la lista de miembros del equipo.');
      return;
    }
    let pendingMembers = members.slice();
    if (activeCycleId) {
      try {
        // Uses ibdl_cycle_respondents (participation only, no scores) so opted-out
        // members who did respond aren't nudged with a reminder.
        const { data: responded, error: respondedError } = await supabase
          .rpc('ibdl_cycle_respondents', { p_cycle_id: activeCycleId });
        if (respondedError) {
          setError('No se pudo verificar quién ha respondido.');
          return;
        }
        const respondedSet = new Set(responded || []);
        pendingMembers = members.filter(m => !respondedSet.has(m.user_id));
      } catch (e) {
        console.warn('No se pudieron cargar respuestas de ciclo', e);
        setError('No se pudo verificar quién ha respondido.');
        return;
      }
    }
    setLaunchContext({
      teamId,
      teamName: team.name,
      activeCycleId: activeCycleId || null,
      pendingMembers,
      totalMembers: members.length
    });
    setShowLaunchPanel(true);
  };

  const launchMBIForTeam = async (teamId) => {
    setError(''); setSuccess('');
    setLaunching(true);
    try {
      // Cerrar ciclo activo previo
      const { error: closeError } = await supabase
        .from('ibdl_evaluation_cycles')
        .update({ status: 'closed', end_at: new Date().toISOString() })
        .eq('team_id', teamId)
        .eq('status', 'active');
      if (closeError) {
        setError('No se pudo cerrar la ronda anterior. Intenta iniciar la evaluación de nuevo.');
        return;
      }
      // Crear nuevo
      const { data: newCycle, error } = await supabase
        .from('ibdl_evaluation_cycles')
        .insert([{ team_id: teamId, status: 'active' }])
        .select('id, team_id')
        .single();
      if (error) throw error;
      setActiveCycles(prev => ({ ...prev, [teamId]: newCycle.id }));
      setSuccess('Nueva ronda creada correctamente.');
      setShowLaunchPanel(false);
      setLaunchContext(null);
    } catch (e) {
      setError(e.message || 'Error al iniciar la ronda');
    } finally {
      setLaunching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center text-[#5B5B6B]">
        Cargando...
      </div>
    );
  }

  // Utilizamos la versión centralizada (clasificación + estado)

  const statusColor = (level) => {
    switch (level) {
      case 'Muy alto': return 'bg-red-100 text-red-700';
      case 'Alto': return 'bg-orange-100 text-orange-700';
      case 'Moderado': return 'bg-yellow-100 text-yellow-700';
      case 'Bajo': return 'bg-green-100 text-green-700';
      default: return 'bg-[#DAD5E4]/50 text-[#5B5B6B]';
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <AppNavbar user={user} profile={profile} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8 space-y-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2E2E3A] tracking-tight">Evaluaciones</h1>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}
        {success && <p className="text-sm text-[#2C7B64] bg-[#55C2A2]/10 border border-[#55C2A2]/30 rounded-xl px-4 py-3">{success}</p>}
        {profile?.role === 'leader' && (
          <section className="bg-[#FAF9F6] border border-[#DAD5E4] rounded-2xl shadow-teamzen p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-[#2E2E3A]">Iniciar ronda de evaluación en un equipo</h2>
            </div>

            {/* Información importante sobre duración de ciclos — acción operativa, tono mint */}
            <div className="mb-4 bg-[#55C2A2]/10 border border-[#55C2A2]/30 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-[#2C7B64] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xs font-medium text-[#2E2E3A] mb-1">Gestión de rondas</p>
                  <p className="text-xs text-[#5B5B6B]">
                    Las rondas duran <strong className="text-[#2E2E3A]">7 días calendario</strong> desde su inicio y se cierran automáticamente.
                    Puedes ver el progreso y generar reportes en cualquier momento durante este período.
                  </p>
                </div>
              </div>
            </div>

            {teams.length === 0 && (
              <p className="text-sm text-[#5B5B6B]">No tienes equipos. Crea uno primero.</p>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              {teams.map(t => {
                const isLaunchingThisTeam = showLaunchPanel && launchContext?.teamId === t.id;
                return (
                  <div key={t.id} className="border border-[#DAD5E4] rounded-xl p-4 bg-[#FAF9F6] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm sm:text-base font-semibold text-[#2E2E3A]">{t.name}</h3>
                    </div>
                    <button
                      className="bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#4AB393] hover:to-[#8B6FB8] disabled:from-[#55C2A2]/50 disabled:to-[#9D83C6]/50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                      disabled={launching}
                      onClick={() => prepareLaunch(t)}
                      aria-expanded={isLaunchingThisTeam}
                    >
                      {activeCycles[t.id] ? (launching ? 'Iniciando...' : 'Nueva ronda') : (launching ? 'Iniciando...' : 'Iniciar ronda')}
                    </button>
                    <button
                      className="text-[#8160B6] text-xs font-medium underline underline-offset-2 self-start"
                      onClick={() => navigate(`/mbi?team=${t.id}`)}
                    >Responder como líder</button>

                    {/* Panel de lanzamiento en línea — reemplaza al LaunchMBIModal flotante */}
                    {isLaunchingThisTeam && (
                      <LaunchMBIPanel
                        isOpen={isLaunchingThisTeam}
                        context={launchContext}
                        launching={launching}
                        onClose={() => { setShowLaunchPanel(false); setLaunchContext(null); }}
                        onConfirm={launchMBIForTeam}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="bg-[#FAF9F6] border border-[#DAD5E4] rounded-2xl shadow-teamzen p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-[#2E2E3A] mb-4">Mi historial</h2>
            {responses.length === 0 && (
              <p className="text-sm text-[#5B5B6B]">Aún no has enviado respuestas.</p>
            )}
            <div className="space-y-3">
              {responses.map(r => {
                const ag = r.ibdl_scores?.ag_score; const ci = r.ibdl_scores?.ci_score; const ef = r.ibdl_scores?.ef_score;
                const { level } = classifyIbdl(ag, ci, ef);
                return (
                  <div key={r.id} className="border border-[#DAD5E4] rounded-xl p-3 space-y-2 bg-[#FAF9F6]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#2E2E3A]">{new Date(r.created_at).toLocaleString()}</p>
                        <p className="text-xs text-[#5B5B6B]">Equipo: {r.team_id ? (r.teams?.name || '—') : 'Individual'}</p>
                      </div>
                      {level && (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(level)}`}>{level}</span>
                      )}
                    </div>
                    {/* Desglose analítico por subescala — tono púrpura (medición/analítico) */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded-full bg-[#9D83C6]/10 text-[#8160B6] font-medium tabular-nums">AG {ag ?? '—'}</span>
                      <span className="px-2 py-1 rounded-full bg-[#9D83C6]/10 text-[#8160B6] font-medium tabular-nums">CI {ci ?? '—'}</span>
                      <span className="px-2 py-1 rounded-full bg-[#9D83C6]/10 text-[#8160B6] font-medium tabular-nums">EF {ef ?? '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 text-xs text-[#5B5B6B] space-y-1">
              <p>{IBDL_CLASSIFICATION_NOTE}</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => navigate('/mbi')} className="bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#4AB393] hover:to-[#8B6FB8] text-white px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300 ease-out transform hover:scale-105 shadow-lg hover:shadow-teamzen-glow">Responder evaluación</button>
            </div>
        </section>
      </main>
    </div>
  );
}
