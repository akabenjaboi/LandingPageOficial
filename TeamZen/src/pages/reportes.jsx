import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import AppNavbar from '../components/AppNavbar';
import TrendChart from '../components/TrendChart';
import { Card, Btn, Badge, Dot, Highlight, PageTitle, Alert, Notice } from '../components/app-ui';
import { generateAdvice, getAIAdviceWithCache } from '../utils/adviceEngine';
import { classifyIbdl, computeWellbeingFromIbdlScores } from '../utils/ibdlClassification';

export default function ReportesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]); // leader teams
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [teamCycles, setTeamCycles] = useState([]); // cycles history for selected team
  const [scoresByCycle, setScoresByCycle] = useState({}); // cycle_id => array of {ag,ci,ef,user_id} (used only for the per-member badge; never for team aggregates)
  const [cycleAggregates, setCycleAggregates] = useState({}); // cycle_id => anonymized aggregate row from ibdl_team_cycle_aggregates
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  const [teamMembers, setTeamMembers] = useState([]); // Miembros del equipo activo
  const [membersLoading, setMembersLoading] = useState(false);
  const [respondedMembers, setRespondedMembers] = useState(new Set()); // IDs de usuarios que respondieron en el ciclo actual
  const [memberRiskLevels, setMemberRiskLevels] = useState(new Map()); // Nivel de riesgo IBDL por user_id

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user;
      if (!currentUser) { navigate('/login'); return; }
      setUser(currentUser);

      const { error: closeExpiredError } = await supabase.rpc('close_expired_ibdl_cycles');
      if (closeExpiredError) {
        console.warn('No se pudieron cerrar rondas vencidas', closeExpiredError);
      }

      const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
      if (profErr) {
        console.error('Error cargando perfil', profErr);
        setError('No se pudo cargar tu perfil.');
        setLoading(false);
        return;
      }
      setProfile(prof);

      if (prof?.role === 'leader') {
        // Cargar equipos para líderes
        const { data: leaderTeams, error: teamsErr } = await supabase.from('teams').select('id,name,include_leader_in_metrics,members_can_see_others,members_can_see_responses').eq('leader_id', currentUser.id).order('created_at',{ascending:true});
        if (teamsErr) {
          console.error('Error cargando equipos', teamsErr);
          setError('No se pudieron cargar tus equipos.');
        } else {
          setTeams(leaderTeams || []);
        }
      }
      // Tanto líderes como usuarios pueden acceder a reportes
      setLoading(false);
    })();
  }, [navigate]);

  // Handle query param team to pre-select when teams are loaded
  useEffect(() => {
    if (!teams.length) return;
    const params = new URLSearchParams(location.search);
    const teamParam = params.get('team');
    if (teamParam && teams.some(t => t.id === teamParam)) {
      setActiveTeamId(teamParam);
    } else if (!activeTeamId) {
      setActiveTeamId(teams[0].id);
    }
  }, [teams, location.search, activeTeamId]);

  useEffect(() => {
    const loadCyclesAndScores = async () => {
      if (!activeTeamId) return;
      setFetching(true); setError('');
      try {
        // 1. Fetch cycles for team
        const { data: cycles, error: cyclesErr } = await supabase
          .from('ibdl_evaluation_cycles')
          .select('id, status, created_at, start_at, end_at')
          .eq('team_id', activeTeamId)
          .order('created_at', { ascending: false });
        if (cyclesErr) throw cyclesErr;
        setTeamCycles(cycles || []);
        if (!cycles || cycles.length === 0) { setScoresByCycle({}); setCycleAggregates({}); return; }
        const cycleIds = cycles.map(c => c.id);

        // 2a. Fetch the anonymized team aggregate (includes opted-out members' numbers,
        // never their identified row) — this is the source for `aggregated`, not the
        // raw per-respondent query below.
        const { data: aggRows, error: aggErr } = await supabase.rpc('ibdl_team_cycle_aggregates', { p_team_id: activeTeamId });
        if (aggErr) throw aggErr;
        const aggByCycle = {};
        (aggRows || []).forEach(row => { aggByCycle[row.cycle_id] = row; });
        setCycleAggregates(aggByCycle);

        // 2b. Fetch responses with nested scores (more reliable filtering on cycle_id).
        // RLS now only returns rows for respondents who set share_results_with_leader = true —
        // this feeds only the per-member badge (memberRiskLevels), never the team aggregate.
        const { data: scoreRows, error: scoreErr } = await supabase
          .from('ibdl_scores')
          .select('ag_score, ci_score, ef_score, ibdl_responses (cycle_id, user_id)')
          .in('ibdl_responses.cycle_id', cycleIds);
        if (scoreErr) throw scoreErr;
        const grouped = {};
        (scoreRows || []).forEach(r => {
          const cId = r.ibdl_responses?.cycle_id; if (!cId) return;
          if (!grouped[cId]) grouped[cId] = [];
          grouped[cId].push({ ag: r.ag_score, ci: r.ci_score, ef: r.ef_score, user_id: r.ibdl_responses?.user_id });
        });
        setScoresByCycle(grouped);

        // 3. Obtener miembros que han respondido en el ciclo actual (más reciente)
        // Uses ibdl_cycle_respondents (participation only, no scores) so opted-out
        // members who did respond still show up as "respondido" rather than "pendiente".
        if (cycles.length > 0) {
          const currentCycle = cycles[0]; // El más reciente
          const { data: responses, error: responsesErr } = await supabase
            .rpc('ibdl_cycle_respondents', { p_cycle_id: currentCycle.id });

          if (!responsesErr && responses) {
            setRespondedMembers(new Set(responses));
          }
        }
      } catch (e) {
        console.error('Error cargando reportes', e);
        setError('No se pudieron cargar los datos del reporte.');
      } finally {
        setFetching(false);
      }
    };
    loadCyclesAndScores();
  }, [activeTeamId, reloadCount]);

  // Cargar miembros del equipo
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!activeTeamId) return;
      setMembersLoading(true);
      try {
        const { data: members, error } = await supabase
          .from('team_members')
          .select(`
            user_id,
            share_results_with_leader,
            profiles (
              id,
              first_name,
              last_name
            )
          `)
          .eq('team_id', activeTeamId);

        if (error) throw error;
        setTeamMembers(members || []);
      } catch (e) {
        console.error('Error cargando miembros del equipo', e);
      } finally {
        setMembersLoading(false);
      }
    };
    loadTeamMembers();
  }, [activeTeamId, reloadCount]);

  // Effect para calcular el nivel de riesgo de miembros que comparten resultados,
  // acotado al equipo/ciclo actual (antes esta consulta traía la respuesta más
  // reciente del usuario en CUALQUIER equipo, mezclando el reporte de un equipo
  // con datos de otro). Usa los scores del ciclo actual ya cargados en
  // `scoresByCycle` — evita además una consulta extra por miembro (N+1).
  useEffect(() => {
    if (!teamMembers.length || !teamCycles.length) {
      setMemberRiskLevels(new Map());
      return;
    }

    const currentCycleId = teamCycles[0]?.id;
    const scoresForCurrentCycle = scoresByCycle[currentCycleId] || [];

    const membersToCheck = teamMembers.filter(member =>
      member.share_results_with_leader === true &&
      respondedMembers.has(member.user_id)
    );

    const levels = new Map();
    membersToCheck.forEach(member => {
      const memberScore = scoresForCurrentCycle.find(s => s.user_id === member.user_id);
      if (!memberScore) return;
      const { level } = classifyIbdl(memberScore.ag, memberScore.ci, memberScore.ef);
      if (level) levels.set(member.user_id, level);
    });

    setMemberRiskLevels(levels);
  }, [teamMembers, respondedMembers, teamCycles, scoresByCycle]);

  const handleRefresh = () => setReloadCount(c => c + 1);

  const aggregated = useMemo(() => {
    if (!teamCycles.length) return [];
    return teamCycles.map(cycle => {
      const cycleEndDate = cycle.end_at ? new Date(cycle.end_at) : null;
      // Prefer the authoritative status column; a cycle only counts as active while
      // status says so AND it hasn't been given an end_at. This also covers legacy
      // rows that were closed without an end_at being recorded (see evaluaciones.jsx),
      // which must be treated as completed, not as permanently "in progress".
      const isActiveCycle = cycle.status === 'active' && !cycleEndDate;
      const agg = cycleAggregates[cycle.id];
      const count = agg?.respondent_count ?? 0;
      if (!agg || count === 0) return { cycle, count: 0, isActiveCycle };

      const wellbeing = computeWellbeingFromIbdlScores(agg.ag_avg, agg.ci_avg, agg.ef_avg);
      const dist = {
        'Muy alto': agg.muy_alto_count ?? 0,
        Alto: agg.alto_count ?? 0,
        Moderado: agg.moderado_count ?? 0,
        Bajo: agg.bajo_count ?? 0,
      };
      return {
        cycle,
        count,
        agAvg: agg.ag_avg != null ? Math.round(agg.ag_avg * 10) / 10 : null,
        ciAvg: agg.ci_avg != null ? Math.round(agg.ci_avg * 10) / 10 : null,
        efAvg: agg.ef_avg != null ? Math.round(agg.ef_avg * 10) / 10 : null,
        dominant: agg.dominant ?? null,
        wellbeing: wellbeing != null ? Math.round(wellbeing) : null,
        dist,
        isActiveCycle,
      };
    });
  }, [teamCycles, cycleAggregates]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6]"><LoadingSpinner size="large" message="Cargando reportes..."/></div>;
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <AppNavbar user={user} profile={profile} />
      <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 pb-32 pt-6 sm:px-6 sm:pt-8 md:pb-16">
        {error && !fetching && teams.length === 0 && <Alert>{error}</Alert>}
        {profile?.role === 'leader' ? (
          <LeaderReports
            teams={teams}
            activeTeamId={activeTeamId}
            setActiveTeamId={setActiveTeamId}
            aggregated={aggregated}
            fetching={fetching}
            error={error}
            onRefresh={handleRefresh}
            teamMembers={teamMembers}
            membersLoading={membersLoading}
            respondedMembers={respondedMembers}
            memberRiskLevels={memberRiskLevels}
          />
        ) : (
          <UserPersonalReports user={user} profile={profile} />
        )}
      </main>
    </div>
  );
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms/1000);
  const days = Math.floor(totalSec/86400);
  const hours = Math.floor((totalSec%86400)/3600);
  const mins = Math.floor((totalSec%3600)/60);
  if (days>0) return `${days}d ${hours}h`;
  if (hours>0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ===================================================================
// VISTA LÍDER
// ===================================================================
function LeaderReports({ teams, activeTeamId, setActiveTeamId, aggregated, fetching, error, onRefresh, teamMembers, membersLoading, respondedMembers, memberRiskLevels }) {
  const activeTeam = teams.find(t => t.id === activeTeamId);
  const canSeeOthers = activeTeam?.members_can_see_others ?? true;

  const totalParticipants = activeTeam
    ? teamMembers.length + (activeTeam.include_leader_in_metrics !== false ? 1 : 0)
    : 0;

  const latest = aggregated[0];
  const previous = aggregated[1];
  const kpis = useMemo(() => {
    const bienestarFoot = latest?.wellbeing != null && previous?.wellbeing != null
      ? `${latest.wellbeing - previous.wellbeing >= 0 ? '+' : ''}${latest.wellbeing - previous.wellbeing} vs. ronda anterior`
      : undefined;
    const earliest = aggregated[aggregated.length - 1];
    const earliestDate = earliest ? new Date(earliest.cycle.start_at || earliest.cycle.created_at) : null;
    const validCycles = aggregated.filter(r => r.count > 0);
    const avgParticipation = validCycles.length && totalParticipants > 0
      ? Math.round((validCycles.reduce((acc, r) => acc + r.count, 0) / validCycles.length / totalParticipants) * 100)
      : null;
    const dist = latest?.dist;
    const enRiesgo = dist ? (dist.Alto ?? 0) + (dist['Muy alto'] ?? 0) : 0;
    return {
      bienestar: latest?.wellbeing ?? '—',
      bienestarFoot,
      rondas: aggregated.length,
      rondasFoot: earliestDate ? `desde ${earliestDate.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}` : undefined,
      participacion: avgParticipation != null ? `${avgParticipation}%` : '—',
      participacionFoot: latest?.count != null && totalParticipants > 0 ? `${latest.count} de ${totalParticipants} en la última ronda` : undefined,
      dominante: latest?.dominant ?? '—',
      dominanteFoot: latest ? `${enRiesgo} en riesgo alto o muy alto` : undefined,
    };
  }, [aggregated, latest, previous, totalParticipants]);

  return (
    <>
      <PageTitle title="Reportes estratégicos" subtitle="Tendencias por ronda del equipo seleccionado">
        {!!teams.length && (
          <select
            className="cursor-pointer rounded-xl border border-[#DAD5E4] bg-white px-4 py-3 font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#2E2E3A] outline-none focus:border-[#55C2A2] focus:shadow-[0_0_0_3px_rgba(85,194,162,.22)]"
            value={activeTeamId || ''}
            onChange={e => setActiveTeamId(e.target.value)}
          >
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <Btn variant="secondary" onClick={onRefresh}>Refrescar</Btn>
      </PageTitle>

      {teams.length === 0 && !error ? (
        <Card className="py-12 text-center">
          <p className="text-[#5B5B6B]">No tienes equipos aún. Crea uno para generar reportes.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Bienestar actual" value={kpis.bienestar} color="text-[#8B6FB8]" foot={kpis.bienestarFoot} />
            <Kpi label="Rondas" value={kpis.rondas} foot={kpis.rondasFoot} />
            <Kpi label="Participación media" value={kpis.participacion} foot={kpis.participacionFoot} />
            <Kpi label="Nivel de riesgo dominante" value={kpis.dominante} color="text-[#3d8a74]" foot={kpis.dominanteFoot} />
          </div>

          <CycleHelp />

          {error && !fetching && <Alert>{error}</Alert>}

          {fetching ? (
            <Card className="text-center"><LoadingSpinner size="small" message="Cargando rondas..." /></Card>
          ) : aggregated.length === 0 ? (
            <Card>
              <p className="flex items-center gap-2 text-sm text-[#5B5B6B]">
                Sin rondas creadas todavía.
                <button onClick={onRefresh} className="font-semibold text-[#3d8a74] underline hover:no-underline">Actualizar</button>
              </p>
            </Card>
          ) : !aggregated.some(r => r.count > 0) ? (
            <Card>
              <p className="text-sm text-[#5B5B6B]">Hay {aggregated.length} ronda(s) pero aún sin respuestas con puntajes.</p>
              <button onClick={onRefresh} className="mt-2 text-sm font-semibold text-[#3d8a74] underline hover:no-underline">Reintentar</button>
            </Card>
          ) : (
            <>
              <Card className="flex flex-col gap-[18px]">
                <h2 className="font-['Poppins',_Arial,_sans-serif] text-xl font-semibold text-[#2E2E3A]">Tendencia por ronda</h2>
                <TrendChart data={aggregated.slice().reverse().map(c => ({
                  label: new Date(c.cycle.start_at || c.cycle.created_at).toLocaleDateString(),
                  values: { agAvg: c.agAvg, ciAvg: c.ciAvg, efAvg: c.efAvg, wellbeing: c.wellbeing }
                }))} />
                {aggregated.length < 2 && (
                  <p className="text-sm text-[#5B5B6B]">Se necesitan al menos 2 rondas con respuestas para graficar la tendencia.</p>
                )}
              </Card>

              <Card className="flex flex-col gap-4">
                <h2 className="font-['Poppins',_Arial,_sans-serif] text-xl font-semibold text-[#2E2E3A]">Historial de rondas</h2>
                <div className="flex flex-col gap-2">
                  <div className="hidden gap-3 px-4 md:grid md:grid-cols-[1.5fr_.7fr_.7fr_.7fr_.7fr_1.3fr_1fr]">
                    {['Ronda', 'Resp.', 'AG', 'CI', 'EF', 'Bienestar', 'Riesgo'].map((h) => (
                      <span key={h} className="text-[11px] font-bold uppercase tracking-[.06em] text-[#5B5B6B]">{h}</span>
                    ))}
                  </div>
                  {aggregated.map((row, idx) => {
                    const roundNumber = aggregated.length - idx;
                    const started = row.cycle.start_at || row.cycle.created_at;
                    const ended = row.cycle.end_at;
                    const startDate = started ? new Date(started) : null;
                    const endDate = ended ? new Date(ended) : null;
                    const hasReliableEnd = !!(startDate && endDate);
                    const duration = row.isActiveCycle ? 'en curso' : (hasReliableEnd ? formatDuration(endDate - startDate) : '—');
                    const ranFullTerm = hasReliableEnd ? (endDate.getTime() - startDate.getTime()) >= 7 * 24 * 60 * 60 * 1000 : true;
                    const statusText = row.isActiveCycle ? 'en curso' : (ranFullTerm ? 'completado' : 'cerrado anticipadamente');
                    const dist = row.dist;
                    const distText = dist ? `B:${dist.Bajo} · M:${dist.Moderado} · A:${dist.Alto} · MA:${dist['Muy alto']}` : null;
                    return (
                      <div key={row.cycle.id} className="grid grid-cols-2 items-center gap-x-3 gap-y-2 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] px-4 py-3.5 md:grid-cols-[1.5fr_.7fr_.7fr_.7fr_.7fr_1.3fr_1fr]">
                        <div className="col-span-2 flex flex-col md:col-span-1">
                          <span className="font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#2E2E3A]">Ronda {roundNumber}</span>
                          <span className="text-xs text-[#5B5B6B]">
                            {startDate ? startDate.toLocaleDateString() : '—'}
                            {row.isActiveCycle ? ' · en curso' : endDate ? ` – ${endDate.toLocaleDateString()} · ${statusText}` : ''}
                            {!row.isActiveCycle && hasReliableEnd && ` (${duration})`}
                          </span>
                        </div>
                        <MobileLabeled label="Resp."><span className="tabular-nums">{row.count}</span></MobileLabeled>
                        <MobileLabeled label="AG"><span className="tabular-nums">{row.agAvg ?? '—'}</span></MobileLabeled>
                        <MobileLabeled label="CI"><span className="tabular-nums">{row.ciAvg ?? '—'}</span></MobileLabeled>
                        <MobileLabeled label="EF"><span className="tabular-nums">{row.efAvg ?? '—'}</span></MobileLabeled>
                        <div className="col-span-2 flex items-center gap-2.5 md:col-span-1">
                          {row.wellbeing != null ? (
                            <>
                              <div className="h-2 flex-1 overflow-hidden rounded-[5px] bg-[#DAD5E4]">
                                <div className="h-full bg-[#9D83C6]" style={{ width: `${row.wellbeing}%` }} />
                              </div>
                              <span className="font-['Poppins',_Arial,_sans-serif] text-sm font-bold tabular-nums text-[#8B6FB8]">{row.wellbeing}</span>
                            </>
                          ) : <span className="text-sm text-[#5B5B6B]">—</span>}
                        </div>
                        {/* Riesgo: en md+ va en su propia columna; en mobile se muestra como fila completa (antes se ocultaba por completo bajo lg, perdiendo el nivel dominante y el desglose). */}
                        <div className="col-span-2 flex items-center gap-2.5 md:hidden">
                          <span className="text-[11px] font-bold uppercase tracking-[.06em] text-[#5B5B6B]">Riesgo</span>
                          {row.dominant ? <Badge tone={row.dominant === 'Bajo' ? 'mint' : 'purple'}>{row.dominant}</Badge> : <span className="text-sm text-[#5B5B6B]">—</span>}
                          {distText && <span className="text-xs text-[#5B5B6B]">{distText}</span>}
                        </div>
                        <div className="hidden md:flex md:flex-col md:items-start md:gap-1">
                          {row.dominant ? <Badge tone={row.dominant === 'Bajo' ? 'mint' : 'purple'}>{row.dominant}</Badge> : <span className="text-sm text-[#5B5B6B]">—</span>}
                          {distText && <span className="text-xs text-[#5B5B6B]">{distText}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[13px] text-[#5B5B6B]">
                  Los promedios provienen de una función agregada del servidor — nunca se calculan a partir de respuestas individuales.
                </p>
              </Card>

              <AdvicePanel key={activeTeamId} data={aggregated} teamId={activeTeamId} />
            </>
          )}

          <Card>
            <h2 className="mb-4 font-['Poppins',_Arial,_sans-serif] text-xl font-semibold text-[#2E2E3A]">
              Miembros del equipo
              {teamMembers.length > 0 && (
                <span className="ml-2 text-sm font-normal text-[#5B5B6B]">
                  ({canSeeOthers ? teamMembers.length : 'Privado'} miembro{teamMembers.length !== 1 ? 's' : ''})
                </span>
              )}
            </h2>

            {membersLoading ? (
              <LoadingSpinner size="small" message="Cargando miembros..." />
            ) : !canSeeOthers ? (
              <div className="py-6 text-center">
                <p className="text-sm text-[#5B5B6B]">La visibilidad de miembros está deshabilitada.</p>
                <p className="mt-1 text-xs text-[#5B5B6B]">El líder del equipo ha configurado los perfiles como privados.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {teamMembers.map((member) => {
                  const hasResponded = respondedMembers.has(member.user_id);
                  const fullName = `${member.profiles?.first_name || ''} ${member.profiles?.last_name || ''}`.trim() || 'Usuario sin nombre';
                  const sharesResults = member.share_results_with_leader === true;
                  const riskLevel = memberRiskLevels.get(member.user_id);

                  return (
                    <div key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] px-4 py-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(157,131,198,.2)] font-['Poppins',_Arial,_sans-serif] text-sm font-bold text-[#6f56a0]">
                          {fullName.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-[#2E2E3A]">{fullName}</p>
                            {sharesResults && hasResponded && riskLevel && (
                              <Badge tone={riskLevel === 'Bajo' ? 'mint' : 'purple'} className="shrink-0">{riskLevel}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-[#5B5B6B]">
                            {hasResponded ? 'Ha respondido la última ronda' : 'No ha respondido la última ronda'}
                            {sharesResults && hasResponded && ' · Resultados compartidos'}
                            {!sharesResults && hasResponded && ' · Resultados privados'}
                          </p>
                        </div>
                      </div>
                      <Badge tone={hasResponded ? 'mint' : 'purple'} className="shrink-0">{hasResponded ? 'Respondió' : 'Pendiente'}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}

function Kpi({ label, value, foot, color }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[20px] border border-[#DAD5E4] bg-white p-[18px] shadow-teamzen">
      <span className="text-[11px] font-bold uppercase tracking-[.06em] text-[#5B5B6B]">{label}</span>
      <span className={`break-words font-['Poppins',_Arial,_sans-serif] text-xl font-bold tabular-nums sm:text-2xl md:text-3xl ${color || 'text-[#2E2E3A]'}`}>{value}</span>
      {foot && <span className="text-xs text-[#5B5B6B]">{foot}</span>}
    </div>
  );
}

function MobileLabeled({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 md:contents">
      <span className="text-xs font-bold uppercase tracking-[.06em] text-[#5B5B6B] md:hidden">{label}</span>
      <span className="text-sm text-[#2E2E3A]">{children}</span>
    </div>
  );
}

function CycleHelp() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card pad="p-0" className="overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between p-4 transition-colors hover:bg-[#DAD5E4]/20"
      >
        <span className="font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#2E2E3A]">¿Qué son las rondas y las dimensiones del inventario?</span>
        <svg className={`h-5 w-5 text-[#9D83C6] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-4 border-t border-[#DAD5E4] p-5 text-sm leading-relaxed">
          <div>
            <h4 className="mb-1 flex items-center gap-2 font-['Poppins',_Arial,_sans-serif] font-semibold text-[#2E2E3A]">
              <Dot size={8} /> Qué es una ronda
            </h4>
            <p className="ml-4 text-[#5B5B6B]">Periodo activo en el que el equipo responde el cuestionario. Al cerrarlo se congelan sus resultados.</p>
          </div>

          <div>
            <h4 className="mb-1 flex items-center gap-2 font-['Poppins',_Arial,_sans-serif] font-semibold text-[#2E2E3A]">
              <Dot tone="purple" size={8} /> Dimensiones del Inventario Breve de Desgaste Laboral (IBDL-6)
            </h4>
            <div className="ml-4 flex flex-col gap-1.5 text-[#5B5B6B]">
              <p><strong className="font-semibold text-[#2E2E3A]">Agotamiento (AG):</strong> desgaste y cansancio mental. Menor puntaje es mejor.</p>
              <p><strong className="font-semibold text-[#2E2E3A]">Cinismo / distanciamiento (CI):</strong> distancia o desconexión hacia el trabajo. Menor puntaje es mejor.</p>
              <p><strong className="font-semibold text-[#2E2E3A]">Eficacia percibida (EF):</strong> sensación de logro y capacidad. Mayor puntaje es mejor.</p>
            </div>
          </div>

          <div>
            <h4 className="mb-1 flex items-center gap-2 font-['Poppins',_Arial,_sans-serif] font-semibold text-[#2E2E3A]">
              <Dot size={8} /> Escala de medición
            </h4>
            <p className="ml-4 text-[#5B5B6B]">
              Cada ítem se responde 1–5 (Nunca → Siempre) según qué tan seguido pasó en las últimas 2-4 semanas. Se suman 2 ítems por dimensión:
              <strong className="text-[#2E2E3A]"> AG (2 ítems, 2–10)</strong>,
              <strong className="text-[#2E2E3A]"> CI (2 ítems, 2–10)</strong>,
              <strong className="text-[#2E2E3A]"> EF (2 ítems, 2–10)</strong>.
            </p>
          </div>

          <div>
            <h4 className="mb-1 flex items-center gap-2 font-['Poppins',_Arial,_sans-serif] font-semibold text-[#2E2E3A]">
              <Dot tone="purple" size={8} /> Niveles de riesgo
            </h4>
            <p className="ml-4 mb-2 text-[#5B5B6B]">
              Riesgo total = AG + CI + (12 − EF), rango 6–30. Bandas provisionales, a recalibrar con datos piloto.
            </p>
            <div className="ml-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-[#DAD5E4] bg-[rgba(85,194,162,.08)] p-2.5 text-xs">
                <div className="font-semibold text-[#3d8a74]">Bajo</div>
                <div className="text-[#5B5B6B]">6-12</div>
              </div>
              <div className="rounded-xl border border-[#DAD5E4] bg-[#DAD5E4]/40 p-2.5 text-xs">
                <div className="font-semibold text-[#2E2E3A]">Moderado</div>
                <div className="text-[#5B5B6B]">13-18</div>
              </div>
              <div className="rounded-xl border border-[#DAD5E4] bg-[rgba(157,131,198,.1)] p-2.5 text-xs">
                <div className="font-semibold text-[#6f56a0]">Alto</div>
                <div className="text-[#5B5B6B]">19-24</div>
              </div>
              <div className="rounded-xl border border-[#DAD5E4] bg-[rgba(157,131,198,.18)] p-2.5 text-xs">
                <div className="font-semibold text-[#6f56a0]">Muy alto</div>
                <div className="text-[#5B5B6B]">25-30</div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-1 font-['Poppins',_Arial,_sans-serif] font-semibold text-[#2E2E3A]">Bienestar global (0–100)</h4>
            <p className="ml-4 text-[#5B5B6B]">
              Índice sintético que normaliza e invierte AG y CI, y normaliza EF. <strong className="text-[#8B6FB8]">Solo para tendencia general</strong>, siempre interpretar las 3 dimensiones por separado.
            </p>
          </div>

          <p className="text-xs text-[#5B5B6B]">
            El IBDL-6 es un instrumento de screening/monitoreo, no diagnóstico — ver inventario-breve-burnout.md para notas de validación pendiente.
          </p>
        </div>
      )}
    </Card>
  );
}

// ===================================================================
// PANEL DE SUGERENCIAS DE IA (con seguimiento de acciones)
// ===================================================================
const STATUS_CYCLE = { pendiente: 'en_curso', en_curso: 'hecha', hecha: 'pendiente' };
const STATE_TONE = { pendiente: 'neutral', en_curso: 'purple', hecha: 'mint' };
const STATE_LABEL = { pendiente: 'Pendiente', en_curso: 'En curso', hecha: 'Hecha' };

function AdvicePanel({ data, teamId }) {
  const [mode, setMode] = React.useState('ai'); // 'local' | 'ai' - IA por defecto
  const [loading, setLoading] = React.useState(false);
  const [aiAdvice, setAiAdvice] = React.useState(null);
  const [error, setError] = React.useState('');
  const [currentActionStatuses, setCurrentActionStatuses] = React.useState({}); // action_text -> status, for the current cycle
  const [prevActionStatuses, setPrevActionStatuses] = React.useState([]); // [{action_text, status}], for the previous cycle, oldest-first
  const [prevActionsExpanded, setPrevActionsExpanded] = React.useState(false);

  // Hoisted above this component's early returns below (React forbids hooks
  // after a conditional return), purely to learn the current/previous cycle
  // IDs — the render body further down computes its own `valid`/`current`/
  // `prev` again for its own purposes (pre-existing duplication in this
  // file, not introduced by this change).
  const validForTracking = data.filter(r => r.count > 0 && r.agAvg != null && r.ciAvg != null && r.efAvg != null && r.wellbeing != null);
  const currentForTracking = validForTracking[0];
  const prevForTracking = validForTracking.length > 1 ? validForTracking[1] : null;

  // Función para obtener sugerencias de IA - definida antes para usar en useEffect
  const handleAIFetch = React.useCallback(async (forceRegenerate = false) => {
    if (loading) return;

    const valid = data.filter(r => r.count > 0 && r.agAvg != null && r.ciAvg != null && r.efAvg != null && r.wellbeing != null);
    if (!valid.length) return; // No hay datos válidos

    const current = valid[0];
    const prev = valid.length > 1 ? valid[1] : null;

    const historyData = valid.slice(0, 5).map(item => ({
      ag: item.agAvg,
      ci: item.ciAvg,
      ef: item.efAvg,
      wellbeing: item.wellbeing,
      date: item.cycle.start_at || item.cycle.created_at
    }));

    const ibdlPayload = {
      ag: current.agAvg,
      ci: current.ciAvg,
      ef: current.efAvg,
      wellbeing: current.wellbeing,
      previous: prev ? { ag: prev.agAvg, ci: prev.ciAvg, ef: prev.efAvg, wellbeing: prev.wellbeing } : null,
      history: historyData,
      meta: {
        latestId: current.cycle.id,
        totalPeriods: valid.length,
        analysisScope: 'Análisis por rondas de evaluación (IBDL-6)'
      }
    };

    setLoading(true);
    setError('');

    try {
      // Timeout de 15 segundos para evitar esperas largas
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: IA externa tardó más de 15 segundos')), 15000)
      );

      const analysisId = current.cycle.id;

      const result = await Promise.race([
        getAIAdviceWithCache(ibdlPayload, teamId, analysisId, forceRegenerate),
        timeoutPromise
      ]);

      setAiAdvice({ ...result, _forCycleId: analysisId, _forTeamId: teamId });
      setMode('ai');
    } catch (err) {
      console.error('Error IA:', err);
      setError(err.message || 'Error conectando con IA');
      setMode('local'); // Volver a local en caso de error
    } finally {
      setLoading(false);
    }
  }, [loading, data, teamId]);

  // Sembrar y cargar el estado trackeado de las acciones de la ronda actual —
  // solo cuando se está mostrando IA (el modo local resamplea sus acciones al
  // azar en cada render, no es contenido estable al que asignarle un estado).
  const aiActionsKey = JSON.stringify((mode === 'ai' && aiAdvice?.actions) || []);

  React.useEffect(() => {
    if (mode !== 'ai' || !aiAdvice?.actions?.length || !currentForTracking?.cycle?.id) return;
    if (aiAdvice._forCycleId !== currentForTracking.cycle.id || aiAdvice._forTeamId !== teamId) return;
    const actionsList = aiAdvice.actions;
    let cancelled = false;
    (async () => {
      // Defensa contra un desfase transitorio durante el cambio de equipo: `teamId`
      // puede reflejar ya el equipo nuevo mientras `data` (y por lo tanto
      // `currentForTracking`) todavía refleja el equipo anterior. Verificar que el
      // ciclo realmente pertenece a `teamId` antes de escribir nada.
      const { data: cycleCheck, error: cycleCheckError } = await supabase
        .from('ibdl_evaluation_cycles')
        .select('team_id')
        .eq('id', currentForTracking.cycle.id)
        .single();
      if (cancelled) return;
      if (cycleCheckError || cycleCheck?.team_id !== teamId) {
        // Props obsoletas de un cambio de equipo en curso — el ciclo que se iba a
        // sembrar no pertenece en realidad al equipo que creemos estar viendo.
        // Omitir silenciosamente; el efecto se volverá a ejecutar cuando `data`
        // alcance al equipo actual real.
        return;
      }
      const rows = actionsList.map(action_text => ({ team_id: teamId, cycle_id: currentForTracking.cycle.id, action_text }));
      const { error: seedError } = await supabase
        .from('ibdl_action_tracking')
        .upsert(rows, { onConflict: 'team_id,cycle_id,action_text', ignoreDuplicates: true });
      if (seedError) console.warn('No se pudieron registrar las acciones sugeridas', seedError);

      const { data: loaded, error: loadError } = await supabase
        .from('ibdl_action_tracking')
        .select('action_text, status')
        .eq('team_id', teamId)
        .eq('cycle_id', currentForTracking.cycle.id);
      if (cancelled) return;
      if (loadError) { console.warn('No se pudieron cargar los estados de acciones', loadError); return; }
      const map = {};
      (loaded || []).forEach(r => { map[r.action_text] = r.status; });
      setCurrentActionStatuses(map);
    })();
    return () => { cancelled = true; };
  }, [teamId, currentForTracking?.cycle?.id, aiActionsKey]);

  // Cargar (solo lectura hasta que se haga clic) las acciones trackeadas de
  // la ronda anterior — no depende de `mode`/`aiAdvice`, ya que esa ronda
  // pudo haber sido sembrada en su propia sesión de modo IA, independiente
  // del modo que se esté viendo ahora.
  React.useEffect(() => {
    if (!prevForTracking?.cycle?.id) { setPrevActionStatuses([]); return; }
    let cancelled = false;
    (async () => {
      const { data: loaded, error } = await supabase
        .from('ibdl_action_tracking')
        .select('action_text, status')
        .eq('team_id', teamId)
        .eq('cycle_id', prevForTracking.cycle.id)
        .order('created_at', { ascending: true })
        .order('action_text', { ascending: true });
      if (cancelled) return;
      if (error) { console.warn('No se pudieron cargar las acciones de la ronda anterior', error); setPrevActionStatuses([]); return; }
      setPrevActionStatuses(loaded || []);
    })();
    return () => { cancelled = true; };
  }, [teamId, prevForTracking?.cycle?.id]);

  // Auto-generar análisis de IA cuando hay datos válidos
  React.useEffect(() => {
    const valid = data.filter(r => r.count > 0 && r.agAvg != null && r.ciAvg != null && r.efAvg != null && r.wellbeing != null);
    const adviceIsCurrent = aiAdvice?._forCycleId === valid[0]?.cycle.id && aiAdvice?._forTeamId === teamId;
    if (valid.length > 0 && !adviceIsCurrent && !loading && mode === 'ai') {
      handleAIFetch(false);
    }
  }, [data, teamId, aiAdvice, loading, mode, handleAIFetch]);

  if (!data.length) return null;

  // Considerar solo ciclos con respuestas (count > 0) para evitar nulls en clasificación
  const valid = data.filter(r => r.count > 0 && r.agAvg != null && r.ciAvg != null && r.efAvg != null && r.wellbeing != null);
  if (!valid.length) return null; // No hay datos aún

  // Generar sugerencias locales (siempre disponibles)
  const current = valid[0];
  const prev = valid.length > 1 ? valid[1] : null;
  const historyData = valid.slice(0, 5);
  const localAdvice = generateAdvice({
    ag: current.agAvg, ci: current.ciAvg, ef: current.efAvg, wellbeing: current.wellbeing,
    previous: prev ? { ag: prev.agAvg, ci: prev.ciAvg, ef: prev.efAvg, wellbeing: prev.wellbeing } : null,
    history: historyData.map(item => ({ ag: item.agAvg, ci: item.ciAvg, ef: item.efAvg, wellbeing: item.wellbeing, date: item.cycle.start_at || item.cycle.created_at })),
    meta: { latestId: current.cycle.id, totalPeriods: valid.length, analysisScope: 'Análisis por rondas de evaluación (IBDL-6)' },
  });

  // Determinar qué sugerencias mostrar
  const displayAdvice = mode === 'ai' && aiAdvice ? aiAdvice : localAdvice;

  const handleToggleActionStatus = async (cycleId, actionText, currentStatus, isCurrentCycle) => {
    const nextStatus = STATUS_CYCLE[currentStatus] || 'en_curso';
    const { data: updated, error: toggleError } = await supabase
      .from('ibdl_action_tracking')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('team_id', teamId)
      .eq('cycle_id', cycleId)
      .eq('action_text', actionText)
      .select('id');
    if (toggleError || !updated?.length) { console.warn('No se pudo actualizar el estado de la acción', toggleError); return; }
    if (isCurrentCycle) {
      setCurrentActionStatuses(m => ({ ...m, [actionText]: nextStatus }));
    } else {
      setPrevActionStatuses(list => list.map(r => r.action_text === actionText ? { ...r, status: nextStatus } : r));
    }
  };

  const sourceLabel = mode === 'ai'
    ? (aiAdvice ? (aiAdvice._cacheInfo?.fromCache ? `IA + tendencias · desde caché (${new Date(aiAdvice._cacheInfo.createdAt).toLocaleDateString()})` : `IA + tendencias · recién generado`) : (loading ? 'Analizando...' : 'IA + tendencias'))
    : 'Heurística local · instantánea, sin red';

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img src="/img/pandapintando.png" alt="" className="h-[52px] w-[52px] rounded-2xl object-cover" />
          <div className="flex flex-col">
            <h2 className="font-['Poppins',_Arial,_sans-serif] text-xl font-semibold text-[#2E2E3A]">Sugerencias para esta ronda</h2>
            <span className="text-[13px] text-[#5B5B6B]">{sourceLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-full border border-[#DAD5E4] bg-[#FAF9F6] p-1">
            <button
              type="button"
              onClick={() => { setMode('local'); setError(''); }}
              className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 font-['Poppins',_Arial,_sans-serif] text-[12.5px] font-semibold transition ${mode === 'local' ? 'bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] text-white' : 'text-[#5B5B6B]'}`}
            >
              Local
            </button>
            <button
              type="button"
              onClick={() => handleAIFetch(false)}
              disabled={loading}
              className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 font-['Poppins',_Arial,_sans-serif] text-[12.5px] font-semibold transition disabled:opacity-60 ${mode === 'ai' ? 'bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] text-white' : 'text-[#5B5B6B]'}`}
            >
              {loading ? 'Analizando...' : 'IA + Tendencias'}
            </button>
          </div>
          {mode === 'ai' && aiAdvice && !loading && (
            <button
              type="button"
              onClick={() => handleAIFetch(true)}
              aria-label="Regenerar consejo"
              title="Regenerar análisis forzadamente"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#DAD5E4] bg-[#FAF9F6] text-[15px] text-[#5B5B6B] hover:border-[#9D83C6] hover:text-[#2E2E3A]"
            >
              ↻
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-[#c0392b]">{error} (mostrando sugerencias locales)</p>}

      <Highlight>{displayAdvice.summary}</Highlight>

      {mode === 'ai' && aiAdvice?.trendAnalysis && (
        <div className="rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-[.06em] text-[#5B5B6B]">Análisis de evolución</p>
          <p className="text-sm text-[#2E2E3A]">{aiAdvice.trendAnalysis}</p>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-3">
          <h3 className="font-['Poppins',_Arial,_sans-serif] text-base font-semibold text-[#2E2E3A]">Riesgos identificados</h3>
          {!displayAdvice.keyRisks?.length ? (
            <p className="text-sm text-[#5B5B6B]">Sin riesgos identificados.</p>
          ) : displayAdvice.keyRisks.map((risk, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] px-4 py-3.5">
              <Dot tone="purple" size={8} className="mt-[7px]" />
              <span className="text-sm text-[#2E2E3A]">{risk}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-['Poppins',_Arial,_sans-serif] text-base font-semibold text-[#2E2E3A]">Acciones recomendadas</h3>
            {mode === 'ai' && aiAdvice && <span className="text-xs text-[#5B5B6B]">Toca el estado para avanzarlo</span>}
          </div>
          {!displayAdvice.actions?.length ? (
            <p className="text-sm text-[#5B5B6B]">Sin acciones prioritarias detectadas.</p>
          ) : displayAdvice.actions.map((action, i) => {
            const isTrackable = mode === 'ai' && !!aiAdvice;
            const status = currentActionStatuses[action] || 'pendiente';
            return (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] px-4 py-3.5">
                <span className="flex-1 text-sm text-[#2E2E3A]">{action}</span>
                {isTrackable ? (
                  <button
                    type="button"
                    onClick={() => handleToggleActionStatus(currentForTracking.cycle.id, action, status, true)}
                    aria-label={`Cambiar estado: ahora ${STATE_LABEL[status]}`}
                    className="-m-2 flex min-h-11 items-center p-2"
                  >
                    <Badge as="span" tone={STATE_TONE[status]} className="cursor-pointer">{STATE_LABEL[status]}</Badge>
                  </button>
                ) : (
                  <span className="text-xs text-[#5B5B6B]">sin seguimiento</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {mode === 'ai' && aiAdvice?.prognosis && (
        <div className="rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-[.06em] text-[#5B5B6B]">Pronóstico</p>
          <p className="text-sm text-[#2E2E3A]">{aiAdvice.prognosis}</p>
        </div>
      )}

      {prevActionStatuses.length > 0 && (
        <div className="flex flex-col gap-3 pt-1">
          <button
            type="button"
            onClick={() => setPrevActionsExpanded((o) => !o)}
            aria-expanded={prevActionsExpanded}
            className="flex items-center justify-between py-1 font-['Poppins',_Arial,_sans-serif] text-base font-semibold text-[#2E2E3A]"
          >
            <span>Acciones de la ronda anterior</span>
            <span className="text-sm text-[#5B5B6B]">{prevActionsExpanded ? '▲' : '▼'}</span>
          </button>
          {prevActionsExpanded && prevActionStatuses.map((row) => (
            <div key={row.action_text} className="flex items-center gap-3 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] px-4 py-3.5">
              <Dot tone={STATE_TONE[row.status] === 'mint' ? 'mint' : STATE_TONE[row.status] === 'purple' ? 'purple' : 'neutral'} size={12} />
              <span className="flex-1 text-sm text-[#2E2E3A]">{row.action_text}</span>
              <button type="button" onClick={() => handleToggleActionStatus(prevForTracking.cycle.id, row.action_text, row.status, false)} className="-m-2 flex min-h-11 items-center p-2">
                <Badge tone={STATE_TONE[row.status]} className="cursor-pointer">{STATE_LABEL[row.status] || STATE_LABEL.pendiente}</Badge>
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ===================================================================
// VISTA MIEMBRO — ANÁLISIS PERSONAL
// ===================================================================

// Mensaje de respaldo cuando el nivel de riesgo real (calculado de forma
// determinista, no según lo que diga la IA) es Alto o Muy alto, pero no hay
// un mensaje más específico disponible (falló la IA sin fallback, o el
// fallback/la IA no trajeron uno). Se muestra siempre en ese caso — nunca
// depende de que la IA haya recordado incluirlo.
const PROFESSIONAL_SUPPORT_DEFAULT_MESSAGE = 'Si sientes que esto te está superando, no estás solo/a. Buscar apoyo — con un profesional de salud mental, RRHH, tu líder si le tienes confianza, o alguien cercano — es un signo de fortaleza, no de debilidad.';

// Análisis heurístico local, usado cuando la IA externa no responde a tiempo
// o falla — mismo rol que el fallback local del panel de equipo (AdvicePanel),
// pero calculado a partir de la evaluación IBDL-6 más reciente del propio usuario.
function buildLocalPersonalFallback(ibdlHistory) {
  const latest = ibdlHistory[0];
  const latestScores = latest?.ibdl_scores;
  if (!latestScores || latestScores.ag_score == null || latestScores.ci_score == null || latestScores.ef_score == null) {
    return null;
  }

  const { level } = classifyIbdl(latestScores.ag_score, latestScores.ci_score, latestScores.ef_score);
  const burnout_level = (level === 'Muy alto' || level === 'Alto') ? 'Alto' : (level === 'Moderado' ? 'Medio' : 'Bajo');

  // Umbral simple por dimensión (mitad superior/inferior de su rango 2-10) solo
  // para nutrir el resumen local — el nivel de riesgo real es el total (arriba).
  const highAG = latestScores.ag_score >= 7, highCI = latestScores.ci_score >= 7, highEF = latestScores.ef_score < 6;

  const risk_areas = [];
  if (highAG) risk_areas.push('Agotamiento elevado');
  if (highCI) risk_areas.push('Cinismo / distanciamiento elevado');
  if (highEF) risk_areas.push('Baja eficacia percibida');

  const strengths = [];
  if (!highAG) strengths.push('Buen manejo del agotamiento');
  if (!highCI) strengths.push('Vínculo con el trabajo y las personas sostenido');
  if (!highEF) strengths.push('Buena sensación de logro y capacidad');

  const previousScores = ibdlHistory[1]?.ibdl_scores;
  let trend_analysis = null;
  if (previousScores && previousScores.ag_score != null && previousScores.ci_score != null && previousScores.ef_score != null) {
    const trendWord = (curr, prev, higherIsBetter = false) => {
      if (curr === prev) return 'estable';
      const up = curr > prev;
      return higherIsBetter ? (up ? 'mejoró' : 'empeoró') : (up ? 'empeoró' : 'mejoró');
    };
    trend_analysis = `Respecto a tu evaluación anterior: agotamiento ${trendWord(latestScores.ag_score, previousScores.ag_score)}, cinismo/distanciamiento ${trendWord(latestScores.ci_score, previousScores.ci_score)}, eficacia percibida ${trendWord(latestScores.ef_score, previousScores.ef_score, true)}.`;
  }

  const needsSupport = level === 'Alto' || level === 'Muy alto';

  return {
    personal_summary: `Análisis heurístico local (la IA externa no respondió a tiempo): tu nivel de riesgo según el IBDL-6 es ${level?.toLowerCase()}.`,
    burnout_level,
    trend_analysis,
    strengths,
    risk_areas,
    professional_support_recommended: needsSupport,
    professional_support_message: needsSupport ? PROFESSIONAL_SUPPORT_DEFAULT_MESSAGE : null,
    fromCache: false,
    isLocalFallback: true,
    generatedAt: new Date().toISOString()
  };
}

function UserPersonalReports({ user, profile }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ibdlHistory, setIbdlHistory] = useState([]);
  const [expanded, setExpanded] = useState(true);

  // Cargar historial de evaluaciones del usuario
  useEffect(() => {
    if (!user?.id) return;

    const loadHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('ibdl_responses')
          .select(`
            id,
            created_at,
            team_id,
            teams(name),
            ibdl_scores(ag_score, ci_score, ef_score)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10); // Últimas 10 evaluaciones

        if (error) throw error;
        setIbdlHistory(data || []);
      } catch (err) {
        console.error('Error cargando historial:', err);
      }
    };

    loadHistory();
  }, [user?.id]);

  // Generar análisis personal
  const generateAnalysis = async (forceRegenerate = false) => {
    if (!user?.id || !profile || ibdlHistory.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const { generatePersonalAnalysisWithCache } = await import('../utils/groqClient');

      const userData = { userId: user.id, profile, ibdlHistory };

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: IA externa tardó más de 15 segundos')), 15000)
      );

      const result = await Promise.race([
        generatePersonalAnalysisWithCache(userData, forceRegenerate),
        timeoutPromise
      ]);
      setAnalysis(result);
    } catch (err) {
      console.error('Error generando análisis personal:', err);
      const fallback = buildLocalPersonalFallback(ibdlHistory);
      if (fallback) {
        setAnalysis(fallback);
      } else {
        setError(err.message || 'Error generando análisis');
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-generar análisis cuando tenemos datos
  useEffect(() => {
    if (ibdlHistory.length > 0 && !analysis && !loading && !error) {
      generateAnalysis();
    }
  }, [ibdlHistory, analysis, loading, error]);

  const originLabel = analysis?.fromCache
    ? `Desde caché${analysis.cachedAt ? ` · ${new Date(analysis.cachedAt).toLocaleDateString()}` : ''}`
    : analysis?.isLocalFallback
      ? 'Análisis local (heurístico)'
      : analysis?.generatedAt
        ? `Recién generado · ${new Date(analysis.generatedAt).toLocaleDateString()}`
        : '';

  // Se calcula siempre desde el puntaje real más reciente, independiente de
  // si la IA respondió, falló, o si el análisis (IA o local) trajo su propio
  // "professional_support_message" — este aviso nunca debe depender de que
  // la IA se haya acordado de incluirlo.
  const latestScoresForSupport = ibdlHistory[0]?.ibdl_scores;
  const latestLevelForSupport = latestScoresForSupport?.ag_score != null && latestScoresForSupport?.ci_score != null && latestScoresForSupport?.ef_score != null
    ? classifyIbdl(latestScoresForSupport.ag_score, latestScoresForSupport.ci_score, latestScoresForSupport.ef_score).level
    : null;
  const needsProfessionalSupport = latestLevelForSupport === 'Alto' || latestLevelForSupport === 'Muy alto';

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-[22px]">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-['Poppins',_Arial,_sans-serif] text-[26px] font-bold tracking-[-.02em] text-[#2E2E3A] sm:text-[32px]">Mi análisis personal de bienestar</h1>
        <p className="text-base text-[#5B5B6B]">Solo tú ves esta pantalla. Tu líder nunca accede a este detalle.</p>
      </div>

      {ibdlHistory.length > 0 && (
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Kpi label="Evaluaciones" value={ibdlHistory.length} />
          <Kpi label="Última" value={new Date(ibdlHistory[0]?.created_at).toLocaleDateString()} />
          <Kpi label="Cargo actual" value={profile?.job_title || 'No especificado'} />
        </div>
      )}

      {needsProfessionalSupport && (
        <Notice tone="purple">
          <strong className="font-semibold">Tu último resultado muestra un nivel de riesgo alto.</strong>{' '}
          {(analysis?.professional_support_message) || PROFESSIONAL_SUPPORT_DEFAULT_MESSAGE}
        </Notice>
      )}

      {ibdlHistory.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-12 text-center" pad="p-12">
          <h3 className="font-['Poppins',_Arial,_sans-serif] text-xl font-semibold text-[#2E2E3A]">Sin evaluaciones aún</h3>
          <p className="mx-auto max-w-md text-[#5B5B6B]">
            Para ver tu análisis personal, necesitas completar al menos una evaluación.
          </p>
          <Btn onClick={() => window.location.href = '/mbi'}>Completar primera evaluación</Btn>
        </Card>
      ) : (
        <Card className="flex flex-col gap-[18px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img src="/img/pandadescansando.png" alt="" className="h-[52px] w-[52px] rounded-2xl object-cover" />
              <div className="flex flex-col">
                <h2 className="font-['Poppins',_Arial,_sans-serif] text-xl font-semibold text-[#2E2E3A]">Análisis inteligente</h2>
                <span className="text-[13px] text-[#5B5B6B]">{loading ? 'Generando análisis...' : originLabel}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {analysis?.burnout_level && (
                <Badge tone={analysis.burnout_level === 'Alto' ? 'purple' : analysis.burnout_level === 'Medio' ? 'purple' : 'mint'} className="px-3.5 py-[7px] text-xs">
                  Nivel de riesgo: {analysis.burnout_level.toLowerCase()}
                </Badge>
              )}
              <Btn variant="secondary" onClick={() => generateAnalysis(true)} disabled={loading}>
                {loading ? 'Analizando...' : 'Actualizar'}
              </Btn>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <LoadingSpinner size="small" message="Generando análisis personalizado con IA..." />
            </div>
          )}

          {error && <Alert>{error}</Alert>}

          {analysis && !loading && (
            <>
              <Highlight>{analysis.personal_summary}</Highlight>

              <button
                type="button"
                onClick={() => setExpanded((o) => !o)}
                aria-expanded={expanded}
                className="self-start py-1.5 font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#8B6FB8]"
              >
                {expanded ? 'Contraer detalles' : 'Ver detalles'}
              </button>

              {expanded && (
                <div className="flex flex-col gap-[18px]">
                  {analysis.trend_analysis && (
                    <div className="rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] p-4">
                      <p className="mb-1 text-xs font-bold uppercase tracking-[.06em] text-[#5B5B6B]">Evolución de tu bienestar</p>
                      <p className="text-sm text-[#2E2E3A]">{analysis.trend_analysis}</p>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    {analysis.strengths?.length > 0 && (
                      <div className="flex flex-col gap-2.5">
                        <h3 className="font-['Poppins',_Arial,_sans-serif] text-base font-semibold text-[#2E2E3A]">Fortalezas</h3>
                        <div className="flex flex-col gap-2">
                          {analysis.strengths.map((s, i) => (
                            <div key={i} className="flex items-start gap-3 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] px-[15px] py-[13px]">
                              <Dot size={8} className="mt-[7px]" />
                              <span className="text-sm text-[#2E2E3A]">{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysis.risk_areas?.length > 0 && (
                      <div className="flex flex-col gap-2.5">
                        <h3 className="font-['Poppins',_Arial,_sans-serif] text-base font-semibold text-[#2E2E3A]">Áreas de atención</h3>
                        <div className="flex flex-col gap-2">
                          {analysis.risk_areas.map((r, i) => (
                            <div key={i} className="flex items-start gap-3 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] px-[15px] py-[13px]">
                              <Dot tone="purple" size={8} className="mt-[7px]" />
                              <span className="text-sm text-[#2E2E3A]">{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {analysis.personalized_recommendations?.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <h3 className="font-['Poppins',_Arial,_sans-serif] text-base font-semibold text-[#2E2E3A]">Recomendaciones para ti</h3>
                      {analysis.personalized_recommendations.map((rec, i) => (
                        <div key={i} className="flex flex-col gap-1.5 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] p-4">
                          <Badge tone={rec.category === 'Inmediato' ? 'mint' : rec.category === 'Corto plazo' ? 'purple' : 'neutral'} className="self-start text-[11px] uppercase tracking-[.06em]">
                            {rec.category}
                          </Badge>
                          <span className="font-['Poppins',_Arial,_sans-serif] text-[15px] font-semibold text-[#2E2E3A]">{rec.action}</span>
                          <span className="text-sm text-[#5B5B6B]">Por qué: {rec.why}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {analysis.next_evaluation_suggestion && (
                    <div className="flex items-center gap-3 rounded-2xl border border-[rgba(85,194,162,.3)] bg-[rgba(85,194,162,.1)] px-4 py-3.5">
                      <Dot />
                      <span className="text-sm text-[#2E2E3A]">{analysis.next_evaluation_suggestion}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {ibdlHistory.length > 0 && (
        <Card className="flex flex-col gap-3.5">
          <h2 className="font-['Poppins',_Arial,_sans-serif] text-xl font-semibold text-[#2E2E3A]">Mi historial</h2>
          <div className="hidden gap-3 px-4 md:grid md:grid-cols-[2fr_.6fr_.6fr_.6fr_.8fr]">
            {['Fecha', 'AG', 'CI', 'EF', 'Nivel'].map((h) => (
              <span key={h} className="text-[11px] font-bold uppercase tracking-[.06em] text-[#5B5B6B]">{h}</span>
            ))}
          </div>
          {ibdlHistory.map((h) => {
            const scores = h.ibdl_scores;
            const { level } = scores?.ag_score != null && scores?.ci_score != null && scores?.ef_score != null
              ? classifyIbdl(scores.ag_score, scores.ci_score, scores.ef_score)
              : { level: null };
            return (
              <div key={h.id} className="grid grid-cols-2 items-center gap-x-3 gap-y-2 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] px-4 py-[15px] md:grid-cols-[2fr_.6fr_.6fr_.6fr_.8fr]">
                <div className="col-span-2 flex flex-col md:col-span-1">
                  <span className="font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#2E2E3A]">{new Date(h.created_at).toLocaleDateString()}</span>
                  <span className="text-xs text-[#5B5B6B]">{h.teams?.name || 'Individual'}</span>
                </div>
                <MobileLabeled label="AG"><span className="tabular-nums">{scores?.ag_score ?? '—'}</span></MobileLabeled>
                <MobileLabeled label="CI"><span className="tabular-nums">{scores?.ci_score ?? '—'}</span></MobileLabeled>
                <MobileLabeled label="EF"><span className="tabular-nums">{scores?.ef_score ?? '—'}</span></MobileLabeled>
                <div className="col-span-2 md:col-span-1">
                  {level ? <Badge tone={level === 'Bajo' ? 'mint' : 'purple'}>{level}</Badge> : <span className="text-sm text-[#5B5B6B]">—</span>}
                </div>
              </div>
            );
          })}
          <p className="text-[13px] text-[#5B5B6B]">
            El nivel de riesgo se calcula con las bandas del IBDL-6 (6-30, ver panel de ayuda arriba).
          </p>
        </Card>
      )}
    </div>
  );
}
