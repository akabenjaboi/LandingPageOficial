// ===================================================================
// DASHBOARD PRINCIPAL - CENTRO DE CONTROL DE TEAMZEN
// ===================================================================
// Este componente maneja:
// - Autenticación y perfiles de usuario
// - Gestión de equipos (crear, editar, eliminar)
// - Lanzamiento y gestión de ciclos MBI
// - Dashboard diferenciado por rol (líder vs miembro)
// - Métricas y estado en tiempo real
// ===================================================================

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import LoadingSpinner from "../components/LoadingSpinner";
import { Card, Btn, Field, Badge, Stat, Dot, Check, Notice, Alert, PageTitle } from "../components/app-ui";
import AppNavbar from "../components/AppNavbar";
import LaunchMBIPanel from "../components/LaunchMBIPanel";
import CreateTeamPanel from "../components/CreateTeamPanel";
import TeamOptionsMenu from "../components/TeamOptionsMenu";
import EditTeamPanel from "../components/EditTeamPanel";
import TransferLeadershipModal from "../components/TransferLeadershipModal";
import Modal from "../components/Modal";

export default function Dashboard() {
  // ===================================================================
  // ESTADO - NAVEGACIÓN Y USUARIO
  // ===================================================================
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  // ===================================================================
  // ESTADO - PERFIL DE USUARIO
  // ===================================================================
  const [profile, setProfile] = useState(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // ===================================================================
  // ESTADO - EQUIPOS Y MIEMBROS
  // ===================================================================
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState({}); // { team_id: [members] }
  const [membersLoading, setMembersLoading] = useState(false);

  // ===================================================================
  // ESTADO - CICLOS MBI Y RESPUESTAS
  // ===================================================================
  const [activeCycles, setActiveCycles] = useState({}); // { team_id: cycle_id }
  const [respondedCycles, setRespondedCycles] = useState({}); // { cycle_id: true }
  const [respondedMembersByTeam, setRespondedMembersByTeam] = useState({}); // { team_id: Set(user_ids) }
  const [wellbeingByTeam, setWellbeingByTeam] = useState({}); // { team_id: { avg: number, count: number } }

  // ===================================================================
  // ESTADO - OPERACIONES DE EQUIPOS
  // ===================================================================
  const [launchingTeam, setLaunchingTeam] = useState(null);
  const [endingTeam, setEndingTeam] = useState(null);

  // ===================================================================
  // ESTADO - PANELES EN LÍNEA Y MODALES
  // ===================================================================
  // Crear equipo, editar equipo y lanzar MBI son flujos de configuración
  // rutinarios: se muestran como paneles que se expanden dentro de la
  // página (ver CreateTeamPanel/EditTeamPanel/LaunchMBIPanel), no como
  // modales flotantes. Transferir liderazgo sigue siendo un modal a
  // propósito: es una decisión de alto impacto que sí amerita interrumpir.
  const [showLaunchPanel, setShowLaunchPanel] = useState(false);
  const [launchContext, setLaunchContext] = useState(null); // {teamId, teamName, activeCycleId, pendingMembers:[], totalMembers}
  const [showCreateTeamPanel, setShowCreateTeamPanel] = useState(false);
  const [showEditTeamPanel, setShowEditTeamPanel] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferringTeam, setTransferringTeam] = useState(null);

  // ===================================================================
  // EFECTO PRINCIPAL - INICIALIZACIÓN Y CARGA DE DATOS
  // ===================================================================

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user;
      if (!currentUser) return navigate("/login");
      setUser(currentUser);

      // Cierra automáticamente rondas activas que ya pasaron su plazo de 7 días.
      // Best-effort: si falla, no bloquea la carga de la página — es limpieza de
      // datos, no una dependencia funcional de lo que sigue.
      const { error: closeExpiredError } = await supabase.rpc('close_expired_mbi_cycles');
      if (closeExpiredError) {
        console.warn('No se pudieron cerrar rondas vencidas', closeExpiredError);
      }

      // Cargar perfil
      // Nota: se usa maybeSingle() en vez de single() para poder distinguir
      // "el perfil todavía no existe" (data null, sin error — usuario nuevo)
      // de un error real de red/permite, que sí debe mostrarse al usuario.
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error cargando perfil:", profileError);
        setDataError("No se pudo cargar tu perfil. Intenta recargar la página.");
        setLoading(false);
        return;
      }

      if (profileData) {
        setProfile(profileData);
        setFirstName(profileData.first_name || "");
        setLastName(profileData.last_name || "");
        setRole(profileData.role || "");
        setBirthDate(profileData.birth_date || "");
        setEmploymentType(profileData.employment_type || "");
        setJobTitle(profileData.job_title || "");
        setStartDate(profileData.start_date || "");
        setJobDescription(profileData.job_description || "");

        // Cargar equipos que lidera y equipos de los que es miembro SIEMPRE,
        // sin importar profileData.role — profiles.role ya no indica de forma
        // confiable el único tipo de relación que este usuario tiene con
        // equipos, porque transferir liderazgo (transfer_team_leadership) no
        // modifica profiles.role a propósito. Cada bloque corre siempre; si
        // no aplica, su propia consulta simplemente devuelve vacío.
        setTeamsLoading(true);
        setMembersLoading(true);

        // --- Equipos que lidera ---
        const { data: leaderTeamsData, error: leaderTeamsError } = await supabase
          .from("teams")
          .select("*, team_invite_codes(code, expires_at)")
          .eq("leader_id", currentUser.id);

        if (leaderTeamsError) {
          console.error("Error cargando equipos de líder:", leaderTeamsError);
          setDataError("No se pudieron cargar tus equipos. Intenta recargar la página.");
        }

        if (leaderTeamsData && leaderTeamsData.length > 0) {
          try {
            const teamIds = leaderTeamsData.map(t => t.id);
            const { data: cycles, error: cyclesError } = await supabase
              .from('mbi_evaluation_cycles')
              .select('id, team_id, status')
              .in('team_id', teamIds)
              .eq('status', 'active');
            if (cyclesError) {
              console.warn('Error cargando ciclos activos (líder):', cyclesError);
              setDataError('No se pudieron cargar las rondas de evaluación. Algunos datos podrían faltar.');
            }
            const cycleMap = {};
            (cycles || []).forEach(c => { cycleMap[c.team_id] = c.id; });
            setActiveCycles(prev => ({ ...prev, ...cycleMap }));

            const activeCycleIds = Object.values(cycleMap);
            if (activeCycleIds.length > 0) {
              // Uses mbi_cycle_respondents (participation only, no scores) per active
              // cycle, so opted-out members who did respond still count as "responded".
              const cycleResults = await Promise.all(
                Object.entries(cycleMap).map(async ([teamId, cycleId]) => {
                  const { data, error } = await supabase
                    .rpc('mbi_cycle_respondents', { p_cycle_id: cycleId });
                  return { teamId, cycleId, data, error };
                })
              );

              const allResponsesError = cycleResults.find(r => r.error)?.error;
              if (allResponsesError) {
                console.warn('Error cargando respuestas MBI (líder):', allResponsesError);
                setDataError('No se pudieron cargar algunas respuestas de bienestar. Algunos datos podrían faltar.');
              }

              const respMap = {};
              const teamResponded = {};
              cycleResults.forEach(({ teamId, cycleId, data }) => {
                const respondentIds = data || [];
                if (respondentIds.includes(currentUser.id)) respMap[cycleId] = true;
                teamResponded[teamId] = new Set(respondentIds);
              });

              setRespondedCycles(prev => ({ ...prev, ...respMap }));
              setRespondedMembersByTeam(prev => ({ ...prev, ...teamResponded }));

              const { data: scoreRows, error: scoreErr } = await supabase
                .from('mbi_scores')
                .select('response_id, ae_score, d_score, rp_score, mbi_responses (cycle_id, team_id)')
                .in('mbi_responses.cycle_id', activeCycleIds);
              if (scoreErr) {
                console.warn('Error obteniendo scores para wellbeing', scoreErr);
              }

              const wb = {};
              const MIN_AE = 0, MAX_AE = 54, MIN_D = 0, MAX_D = 30, MIN_RP = 0, MAX_RP = 48;
              const rangeAE = MAX_AE - MIN_AE, rangeD = MAX_D - MIN_D, rangeRP = MAX_RP - MIN_RP;
              (scoreRows || []).forEach(row => {
                const cycleId = row.mbi_responses?.cycle_id;
                const teamId = row.mbi_responses?.team_id;
                if (!teamId || !cycleId) return;
                const ae = row.ae_score ?? MIN_AE;
                const d = row.d_score ?? MIN_D;
                const rp = row.rp_score ?? MIN_RP;
                const aeWell = 1 - ((ae - MIN_AE) / (rangeAE || 1));
                const dWell = 1 - ((d - MIN_D) / (rangeD || 1));
                const rpWell = (rp - MIN_RP) / (rangeRP || 1);
                const wellbeing = (aeWell + dWell + rpWell) / 3;
                if (!wb[teamId]) wb[teamId] = { sum: 0, count: 0 };
                wb[teamId].sum += wellbeing;
                wb[teamId].count += 1;
              });
              const formatted = {};
              Object.keys(wb).forEach(tid => {
                formatted[tid] = { avg: Math.round((wb[tid].sum / wb[tid].count) * 100), count: wb[tid].count };
              });
              setWellbeingByTeam(prev => ({ ...prev, ...formatted }));
            }
          } catch (e) {
            console.warn('Tabla mbi_evaluation_cycles no disponible aún', e);
          }

          const leaderMembersObj = {};
          for (const team of leaderTeamsData) {
            const { data: team_members, error } = await supabase
              .from("team_members")
              .select("user_id, profiles(first_name, last_name)")
              .eq("team_id", team.id);

            if (error) {
              console.error(`Error cargando miembros para equipo ${team.id}:`, error);
            }
            leaderMembersObj[team.id] = team_members || [];
          }
          setTeamMembers(prev => ({ ...prev, ...leaderMembersObj }));
        }

        // --- Equipos de los que es miembro ---
        const { data: memberships, error: membershipsError } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", currentUser.id);

        let memberTeamsData = [];
        if (membershipsError) {
          console.error("Error cargando membresías:", membershipsError);
        } else if (memberships && memberships.length > 0) {
          const teamIds = memberships.map((m) => m.team_id);
          const { data: teamsData, error: teamsDataError } = await supabase
            .from("teams")
            .select("*")
            .in("id", teamIds);

          if (teamsDataError) {
            console.error("Error cargando equipos de miembro:", teamsDataError);
            setDataError("No se pudieron cargar tus equipos. Intenta recargar la página.");
          } else {
            memberTeamsData = teamsData || [];

            const memberMembersObj = {};
            for (const teamId of teamIds) {
              const currentTeam = memberTeamsData.find(t => t.id === teamId);

              const { data: team_members, error } = await supabase
                .from("team_members")
                .select("user_id, profiles(first_name, last_name)")
                .eq("team_id", teamId);

              if (error) {
                console.error(`Error cargando miembros para equipo ${teamId}:`, error);
                memberMembersObj[teamId] = [];
                continue;
              }

              let finalMembers = team_members || [];

              if (currentTeam && currentTeam.include_leader_in_metrics && currentTeam.leader_id) {
                const leaderAlreadyInMembers = finalMembers.some(m => m.user_id === currentTeam.leader_id);

                if (!leaderAlreadyInMembers) {
                  const { data: leaderInfo, error: leaderInfoError } = await supabase
                    .rpc("get_team_leader_name", { p_team_id: teamId })
                    .single();

                  if (leaderInfoError) {
                    console.warn(`No se pudo obtener el nombre del líder para equipo ${teamId}:`, leaderInfoError);
                  }

                  if (leaderInfo) {
                    finalMembers.push({
                      user_id: leaderInfo.leader_id,
                      profiles: {
                        first_name: leaderInfo.first_name,
                        last_name: leaderInfo.last_name
                      },
                      is_leader: true
                    });
                  }
                }
              }

              memberMembersObj[teamId] = finalMembers;
            }
            setTeamMembers(prev => ({ ...prev, ...memberMembersObj }));

            try {
              const { data: cycles, error: cyclesError } = await supabase
                .from('mbi_evaluation_cycles')
                .select('id, team_id, status')
                .in('team_id', teamIds)
                .eq('status', 'active');
              if (cyclesError) {
                console.warn('Error cargando ciclos activos (miembro):', cyclesError);
                setDataError('No se pudieron cargar las rondas de evaluación. Algunos datos podrían faltar.');
              }
              const cycleMap = {};
              (cycles || []).forEach(c => { cycleMap[c.team_id] = c.id; });
              setActiveCycles(prev => ({ ...prev, ...cycleMap }));
              const cycleIds = Object.values(cycleMap);
              if (cycleIds.length > 0) {
                const { data: respRows, error: respRowsError } = await supabase
                  .from('mbi_responses')
                  .select('cycle_id, user_id')
                  .in('cycle_id', cycleIds);
                if (respRowsError) {
                  console.warn('Error cargando respuestas MBI (miembro):', respRowsError);
                  setDataError('No se pudieron cargar algunas respuestas de bienestar. Algunos datos podrían faltar.');
                }
                const respMap = {};
                (respRows || []).filter(r => r.user_id === currentUser.id).forEach(r => { if (r.cycle_id) respMap[r.cycle_id] = true; });
                setRespondedCycles(prev => ({ ...prev, ...respMap }));
                const teamResponded = {};
                (respRows || []).forEach(r => {
                  const teamId = Object.keys(cycleMap).find(tid => cycleMap[tid] === r.cycle_id);
                  if (teamId) {
                    if (!teamResponded[teamId]) teamResponded[teamId] = new Set();
                    teamResponded[teamId].add(r.user_id);
                  }
                });
                setRespondedMembersByTeam(prev => ({ ...prev, ...teamResponded }));
              }
            } catch (e) {
              console.warn('Tabla mbi_evaluation_cycles no disponible para miembros', e);
            }
          }
        }

        setTeams([...(leaderTeamsData || []), ...memberTeamsData]);
        setTeamsLoading(false);
        setMembersLoading(false);
      }
      setLoading(false);
    };
    init();
  }, [navigate]);

  // Suscripción en tiempo real para actualizar estado de respuestas sin recargar
  useEffect(() => {
    if (!user) return;
    if (!activeCycles || Object.keys(activeCycles).length === 0) return;
    const channel = supabase
      .channel('mbi_responses_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mbi_responses' }, (payload) => {
        const { cycle_id, user_id } = payload.new || {};
        if (!cycle_id || !user_id) return;
        // Encontrar teamId asociado a ese ciclo activo
        const teamId = Object.keys(activeCycles).find(tid => activeCycles[tid] === cycle_id);
        if (!teamId) return; // Puede ser de otro equipo o ciclo no activo
        setRespondedMembersByTeam(prev => {
          const clone = { ...prev };
          const set = new Set(clone[teamId] ? Array.from(clone[teamId]) : []);
          set.add(user_id);
          clone[teamId] = set;
          return clone;
        });
        // Si es este usuario, marcar respondedCycles
        if (user_id === user.id) {
          setRespondedCycles(prev => ({ ...prev, [cycle_id]: true }));
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCycles, user]);

  // Mostrar modal de perfil automáticamente si no tiene perfil creado
  useEffect(() => {
    if (!loading && user && !profile) {
      setShowProfileForm(true);
    }
  }, [loading, user, profile]);

  // ===================================================================
  // HANDLERS - AUTENTICACIÓN Y NAVEGACIÓN
  // ===================================================================

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // ===================================================================
  // HANDLERS - GESTIÓN DE CICLOS MBI
  // ===================================================================

  const launchMBI = async (teamId) => {
    setLaunchingTeam(teamId);
    try {
      const { error: closeError } = await supabase
        .from('mbi_evaluation_cycles')
        .update({ status: 'closed', end_at: new Date().toISOString() })
        .eq('team_id', teamId)
        .eq('status', 'active');
      if (closeError) {
        console.error('Error cerrando ciclo anterior:', closeError);
        setDataError('No se pudo cerrar la ronda anterior. Intenta iniciar el MBI de nuevo.');
        return;
      }
      const { data: newCycle, error } = await supabase
        .from('mbi_evaluation_cycles')
        .insert([{ team_id: teamId, status: 'active' }])
        .select('id, team_id')
        .single();
      if (error) throw error;
      setActiveCycles(prev => ({ ...prev, [teamId]: newCycle.id }));
      setRespondedCycles(prev => ({ ...prev }));
      // Reset responded members list for the new active cycle
      setRespondedMembersByTeam(prev => ({ ...prev, [teamId]: new Set() }));
      setWellbeingByTeam(prev => ({ ...prev, [teamId]: { avg: null, count: 0 } }));
      setShowLaunchPanel(false);
      setLaunchContext(null);
    } catch (e) {
      alert('Error iniciando la ronda: ' + (e.message || ''));
    } finally {
      setLaunchingTeam(null);
    }
  };

  const endCycle = async (teamId) => {
    const cycleId = activeCycles[teamId];
    if (!cycleId) return;
    setEndingTeam(teamId);
    try {
      const { error } = await supabase
        .from('mbi_evaluation_cycles')
        .update({ status: 'closed', end_at: new Date().toISOString() })
        .eq('id', cycleId)
        .eq('status', 'active');
      if (error) throw error;
      setActiveCycles(prev => {
        const clone = { ...prev };
        delete clone[teamId];
        return clone;
      });
    } catch (e) {
      alert('Error terminando ronda: ' + (e.message || ''));
    } finally {
      setEndingTeam(null);
    }
  };

  const prepareLaunch = async (team) => {
    const teamId = team.id;
    const members = teamMembers[teamId] || [];
    const activeCycleId = activeCycles[teamId];
    let pendingMembers = [];
    if (activeCycleId) {
      // Uses mbi_cycle_respondents (participation only, no scores) so opted-out
      // members who did respond aren't nudged with a reminder.
      const { data: responded, error } = await supabase
        .rpc('mbi_cycle_respondents', { p_cycle_id: activeCycleId });
      if (error) {
        console.error('Error cargando respuestas del ciclo:', error);
        setDataError('No se pudo verificar quién ha respondido. Intenta de nuevo.');
        return;
      }
      const respondedSet = new Set(responded || []);
      pendingMembers = members.filter(m => !respondedSet.has(m.user_id));
    } else {
      // Si no hay ciclo activo, todos son potenciales participantes
      pendingMembers = members.slice();
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

  // ===================================================================
  // HANDLERS - GESTIÓN DE EQUIPOS (CREAR, EDITAR, ELIMINAR)
  // ===================================================================

  const handleTeamCreated = async () => {
    // Refrescar la lista de equipos
    try {
      const { data: leaderTeams, error } = await supabase
        .from("teams")
        .select("*, team_invite_codes(code, expires_at)")
        .eq("leader_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error refrescando equipos:", error);
        setDataError("Tu equipo se creó, pero no pudimos refrescar la lista. Recarga la página.");
      } else {
        setTeams(leaderTeams || []);
      }

      // Cerrar el modal después de un breve delay para mostrar el éxito
      setTimeout(() => {
        setShowCreateTeamPanel(false);
      }, 2000);
    } catch (error) {
      console.error("Error refrescando equipos:", error);
      setDataError("Tu equipo se creó, pero no pudimos refrescar la lista. Recarga la página.");
    }
  };

  const handleEditTeam = (team) => {
    setEditingTeam(team);
    setShowEditTeamPanel(true);
  };

  const handleTeamUpdated = async (updatedTeam) => {
    // Actualizar el equipo en el estado local
    setTeams(prevTeams =>
      prevTeams.map(team =>
        team.id === updatedTeam.id ? { ...team, ...updatedTeam } : team
      )
    );
    setShowEditTeamPanel(false);
    setEditingTeam(null);
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este equipo? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      // Eliminar el equipo (Supabase debería manejar las referencias en cascada)
      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("id", teamId)
        .eq("leader_id", user.id); // Seguridad extra

      if (error) {
        throw error;
      }

      // Actualizar la lista de equipos
      setTeams(prevTeams => prevTeams.filter(team => team.id !== teamId));

      // Limpiar datos relacionados
      setTeamMembers(prev => {
        const newMembers = { ...prev };
        delete newMembers[teamId];
        return newMembers;
      });

      setActiveCycles(prev => {
        const newCycles = { ...prev };
        delete newCycles[teamId];
        return newCycles;
      });

      setRespondedMembersByTeam(prev => {
        const newResponded = { ...prev };
        delete newResponded[teamId];
        return newResponded;
      });

      setWellbeingByTeam(prev => {
        const newWellbeing = { ...prev };
        delete newWellbeing[teamId];
        return newWellbeing;
      });

    } catch (error) {
      console.error("Error eliminando equipo:", error);
      alert("Error al eliminar el equipo. Por favor, inténtalo de nuevo.");
    }
  };

  const handleRegenerateCode = async (teamId) => {
    if (!confirm("¿Seguro que quieres generar un nuevo código? El código actual dejará de funcionar de inmediato.")) {
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc("regenerate_team_invite_code", { p_team_id: teamId })
        .single();

      if (error) throw error;

      setTeams(prevTeams =>
        prevTeams.map(team =>
          team.id === teamId
            ? { ...team, team_invite_codes: [{ code: data.code, expires_at: data.expires_at }] }
            : team
        )
      );
    } catch (error) {
      console.error("Error regenerando código:", error);
      alert("No se pudo regenerar el código. Inténtalo de nuevo.");
    }
  };

  const handleKickMember = async (teamId, memberUserId) => {
    if (!confirm("¿Estás seguro de que quieres expulsar a este miembro del equipo? Su historial de evaluaciones se conserva, pero perderá el acceso al equipo.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("team_id", teamId)
        .eq("user_id", memberUserId);

      if (error) throw error;

      setTeamMembers(prev => ({
        ...prev,
        [teamId]: (prev[teamId] || []).filter(m => m.user_id !== memberUserId)
      }));
    } catch (error) {
      console.error("Error expulsando miembro:", error);
      alert("No se pudo expulsar al miembro. Inténtalo de nuevo.");
    }
  };

  const handleOpenTransfer = (team) => {
    setTransferringTeam(team);
    setShowTransferModal(true);
  };

  const handleTransferred = () => {
    setShowTransferModal(false);
    setTransferringTeam(null);
    // Leadership of this team just changed hands — the transferring user's
    // view flips from leader to member, which touches enough state
    // (teams, teamMembers, activeCycles, respondedMembersByTeam,
    // wellbeingByTeam) that a full reload is simpler and safer than
    // hand-patching every piece of derived state. This mirrors the existing
    // "Dashboard" mobile nav button, which already reloads the page rather
    // than re-running init() piecemeal.
    window.location.reload();
  };

  // ===================================================================
  // HANDLERS - GESTIÓN DE PERFIL DE USUARIO
  // ===================================================================

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setProfileMsg("");

    try {
      // Verifica si el perfil existe
      // Se usa maybeSingle() en vez de single() para distinguir "el perfil
      // aún no existe" (data null, sin error — caso normal antes de crear el
      // primer perfil) de un error real de verificación, que si se tratara
      // como "no existe" arriesgaría un insert duplicado más abajo.
      const { data: existingProfile, error: existingProfileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (existingProfileError) {
        console.error("Error verificando perfil existente:", existingProfileError);
        setProfileMsg("Error verificando tu perfil. Intenta de nuevo.");
        setSaving(false);
        return;
      }

      let error;
      const profileData = {
        first_name: firstName,
        last_name: lastName,
        role: role,
        birth_date: birthDate || null,
        employment_type: employmentType || null,
        job_title: jobTitle || null,
        start_date: startDate || null,
        job_description: jobDescription || null,
      };

      if (existingProfile) {
        // Si existe, actualiza
        ({ error } = await supabase
          .from("profiles")
          .update(profileData)
          .eq("id", user.id));
      } else {
        // Si no existe, inserta
        ({ error } = await supabase
          .from("profiles")
          .insert([{
            id: user.id,
            ...profileData
          }]));
      }

      if (error) {
        throw error;
      }

      // Actualizar estado local
      const newProfile = {
        id: user.id,
        ...profileData,
        created_at: existingProfile?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setProfile(newProfile);
      setProfileMsg(existingProfile ? "Perfil actualizado correctamente." : "¡Perfil creado exitosamente! Bienvenido a TeamZen.");

      // Cerrar modal después de un momento para mostrar el mensaje
      setTimeout(() => {
        setShowProfileForm(false);
        setProfileMsg("");

        // Si es un usuario nuevo, recargar la página para aplicar los cambios
        if (!existingProfile) {
          window.location.reload();
        }
      }, 2000);

    } catch (error) {
      console.error("Error updating profile:", error);
      setProfileMsg(`Error: ${error.message || 'No se pudo guardar el perfil'}`);
    } finally {
      setSaving(false);
    }
  };

  // Separar los equipos por la relación real del usuario con cada uno.
  // Memoizado: `teams` cambia solo al (re)cargar datos, pero este componente
  // re-renderiza por muchos otros motivos (toggles de modales, hover, toasts,
  // etc.); sin useMemo estos dos .filter() se recalculaban en cada uno de
  // esos renders solo para alimentar los .map() de tarjetas de equipo.
  const myLeaderTeams = useMemo(
    () => teams.filter(t => t.leader_id === user?.id),
    [teams, user?.id]
  );
  const myMemberTeams = useMemo(
    () => teams.filter(t => t.leader_id !== user?.id),
    [teams, user?.id]
  );

  // Ir a la tarjeta de un equipo específico y darle foco visual momentáneo.
  const scrollToTeam = (teamId) => {
    const el = document.getElementById(`team-card-${teamId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ===================================================================
  // "REQUIERE TU ATENCIÓN" - derivado de datos ya cargados, sin fetches
  // adicionales ni métricas inventadas: ciclos activos, respuestas
  // pendientes, bienestar promedio y expiración de código de invitación
  // ya están en el estado del componente para otros fines.
  // ===================================================================
  const attentionItems = useMemo(() => {
    const items = [];
    const now = new Date();

    myLeaderTeams.forEach((team) => {
      const activeCycleId = activeCycles[team.id];
      const members = teamMembers[team.id] || [];
      const leaderCounts = team.include_leader_in_metrics !== false;
      const totalParticipants = leaderCounts ? members.length + 1 : members.length;

      if (activeCycleId) {
        const respondedSet = respondedMembersByTeam[team.id];
        let respondedCount = respondedSet ? respondedSet.size : 0;
        if (!leaderCounts && respondedSet && team.leader_id) {
          respondedCount -= respondedSet.has(team.leader_id) ? 1 : 0;
        }
        respondedCount = Math.min(Math.max(respondedCount, 0), totalParticipants);
        const pending = totalParticipants - respondedCount;
        if (pending > 0) {
          items.push({
            id: `pending-${team.id}`,
            tone: 'mint',
            message: `${team.name}: ${pending} de ${totalParticipants} aún no ${pending === 1 ? 'ha' : 'han'} respondido la ronda activa`,
            ctaLabel: 'Ver equipo',
            onClick: () => scrollToTeam(team.id),
          });
        }
      } else if (members.length > 0) {
        items.push({
          id: `nocycle-${team.id}`,
          tone: 'mint',
          message: `${team.name} no tiene una ronda de evaluación activa`,
          ctaLabel: 'Iniciar MBI',
          onClick: () => prepareLaunch(team),
        });
      }

      const wb = wellbeingByTeam[team.id];
      if (activeCycleId && wb && wb.avg != null && wb.avg < 50) {
        items.push({
          id: `wellbeing-${team.id}`,
          tone: 'purple',
          message: `${team.name}: bienestar promedio bajo (${wb.avg}/100) en el ciclo actual`,
          ctaLabel: 'Ver reporte',
          onClick: () => navigate(`/reportes?team=${team.id}`),
        });
      }

      const invite = team.team_invite_codes?.[0];
      if (invite?.expires_at && new Date(invite.expires_at) <= now) {
        items.push({
          id: `expired-${team.id}`,
          tone: 'mint',
          message: `${team.name}: el código de invitación expiró`,
          ctaLabel: 'Regenerar código',
          onClick: () => handleRegenerateCode(team.id),
        });
      }
    });

    myMemberTeams.forEach((team) => {
      const activeCycleId = activeCycles[team.id];
      if (activeCycleId && !respondedCycles[activeCycleId]) {
        items.push({
          id: `respond-${team.id}`,
          tone: 'mint',
          message: `Tienes una evaluación MBI pendiente en "${team.name}"`,
          ctaLabel: 'Completar MBI',
          onClick: () => navigate(`/mbi?team=${team.id}`),
        });
      }
    });

    return items;
  }, [myLeaderTeams, myMemberTeams, activeCycles, teamMembers, respondedMembersByTeam, wellbeingByTeam, respondedCycles, navigate]);

  // ===================================================================
  // RENDERIZADO PRINCIPAL
  // ===================================================================

  // Pantalla de carga inicial
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6]">
      <LoadingSpinner size="large" message="Cargando tu dashboard..." />
    </div>
  );

  // myLeaderTeams / myMemberTeams ya se calcularon arriba (memoizados, antes
  // del early return de loading). Se separan por la relación real del
  // usuario con cada equipo (teams.leader_id), no por profiles.role:
  // transferir liderazgo no cambia profiles.role, así que el rol no sirve
  // para decidir qué secciones mostrar. profile.role solo se usa como
  // respaldo para el estado vacío de onboarding, y únicamente cuando no hay
  // ninguna otra relación con equipos que mostrar.
  const showLeaderSection = myLeaderTeams.length > 0 || (profile?.role === "leader" && myMemberTeams.length === 0);
  const showMemberSection = myMemberTeams.length > 0 || (profile?.role === "user" && myLeaderTeams.length === 0);

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <AppNavbar
        user={user}
        profile={profile}
        onProfileEdit={() => setShowProfileForm(true)}
        onLogout={handleLogout}
      />

      <main className="mx-auto flex max-w-[1280px] flex-col gap-[22px] px-4 pb-24 pt-6 sm:px-6 sm:pt-8 md:pb-16" id="teams-section">
        {dataError && (
          <Alert title="Error al cargar datos">{dataError}</Alert>
        )}

        {(!profile?.first_name || !profile?.last_name) && (
          <Notice tone="purple">
            <strong className="font-semibold">Completa tu perfil.</strong> Para aprovechar al máximo TeamZen, hazlo desde tu avatar arriba a la derecha.
          </Notice>
        )}

        <PageTitle
          title={profile?.role === "leader" ? "Panel de Líder" : "Mis Equipos"}
          subtitle={
            profile?.role === "leader"
              ? "Gestiona tus equipos y monitorea el bienestar"
              : "Visualiza los equipos de los que formas parte"
          }
        >
          {profile?.role === "leader" && (
            <Btn variant="primary" onClick={() => setShowCreateTeamPanel(true)}>Crear equipo</Btn>
          )}
          <Btn variant="secondary" onClick={() => navigate("/unirse-equipo")}>Unirse a equipo</Btn>
        </PageTitle>

        {(showLeaderSection || showMemberSection) && <AttentionSection items={attentionItems} />}

        {showLeaderSection && (
          <>
            <CreateTeamPanel
              isOpen={showCreateTeamPanel}
              onClose={() => setShowCreateTeamPanel(false)}
              onTeamCreated={handleTeamCreated}
            />
            <LeaderTeamsSection
              teams={myLeaderTeams}
              teamsLoading={teamsLoading}
              teamMembers={teamMembers}
              membersLoading={membersLoading}
              navigate={navigate}
              activeCycles={activeCycles}
              onPrepareLaunch={prepareLaunch}
              launchingTeam={launchingTeam}
              endingTeam={endingTeam}
              onEndCycle={endCycle}
              respondedMembersByTeam={respondedMembersByTeam}
              wellbeingByTeam={wellbeingByTeam}
              onCreateTeam={() => setShowCreateTeamPanel(true)}
              onEditTeam={handleEditTeam}
              onDeleteTeam={handleDeleteTeam}
              onRegenerateCode={handleRegenerateCode}
              onKickMember={handleKickMember}
              onTransferLeadership={handleOpenTransfer}
              profile={profile}
              currentUserId={user?.id}
              editingTeam={editingTeam}
              showEditTeamPanel={showEditTeamPanel}
              onCloseEditPanel={() => { setShowEditTeamPanel(false); setEditingTeam(null); }}
              onTeamUpdated={handleTeamUpdated}
              launchContext={launchContext}
              showLaunchPanel={showLaunchPanel}
              onCloseLaunchPanel={() => { setShowLaunchPanel(false); setLaunchContext(null); }}
              onConfirmLaunch={launchMBI}
            />
          </>
        )}
        {showMemberSection && (
          <UserTeamsSection
            teams={myMemberTeams}
            teamMembers={teamMembers}
            membersLoading={membersLoading}
            navigate={navigate}
            userId={user?.id}
            activeCycles={activeCycles}
            respondedCycles={respondedCycles}
            respondedMembersByTeam={respondedMembersByTeam}
          />
        )}
        {!showLeaderSection && !showMemberSection && (
          <WelcomeSection onSetupProfile={() => setShowProfileForm(true)} />
        )}

        {showProfileForm && (
          <ProfileFormModal
            profile={profile}
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            role={role}
            setRole={setRole}
            birthDate={birthDate}
            setBirthDate={setBirthDate}
            employmentType={employmentType}
            setEmploymentType={setEmploymentType}
            jobTitle={jobTitle}
            setJobTitle={setJobTitle}
            startDate={startDate}
            setStartDate={setStartDate}
            jobDescription={jobDescription}
            setJobDescription={setJobDescription}
            saving={saving}
            profileMsg={profileMsg}
            onSubmit={handleProfileUpdate}
            onCancel={() => setShowProfileForm(false)}
          />
        )}
        {/* CreateTeamPanel/EditTeamPanel/LaunchMBIPanel ya se renderizan en línea,
            arriba (junto a la sección de equipos) y dentro de cada LeaderTeamCard
            respectivamente — ver comentario en el bloque de estado de paneles. */}

        <TransferLeadershipModal
          isOpen={showTransferModal}
          onClose={() => { setShowTransferModal(false); setTransferringTeam(null); }}
          team={transferringTeam}
          members={transferringTeam ? (teamMembers[transferringTeam.id] || []) : []}
          onTransferred={handleTransferred}
        />
      </main>
    </div>
  );
}

// ===================================================================
// SECCIÓN "REQUIERE TU ATENCIÓN" - resumen accionable, action-forward
// ===================================================================
// Se ubica antes de la lista de equipos para que un usuario que vuelve
// vea primero lo que necesita hacer (respuestas pendientes, bienestar
// bajo, código expirado) en vez de tener que abrir cada equipo para
// descubrirlo. mint = acción operativa disponible ahora mismo;
// púrpura = hallazgo analítico (bienestar) que amerita revisar el reporte.
function AttentionSection({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[#DAD5E4] bg-[linear-gradient(135deg,rgba(85,194,162,.08),rgba(157,131,198,.06))] p-4 shadow-teamzen sm:p-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(85,194,162,.16)] text-base text-[#3d8a74]">✓</span>
        <p className="text-sm text-[#2E2E3A]">
          <span className="font-semibold">Todo al día.</span> No hay evaluaciones pendientes ni alertas en tus equipos.
        </p>
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-['Poppins',_Arial,_sans-serif] text-xl font-semibold text-[#2E2E3A]">Requiere tu atención</h2>
        <span className="text-[13px] text-[#5B5B6B]">{items.length} {items.length === 1 ? 'asunto' : 'asuntos'}</span>
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const isPurple = item.tone === 'purple';
          return (
            <div
              key={item.id}
              className={`flex flex-wrap items-center gap-4 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] p-4 border-l-4 ${isPurple ? 'border-l-[#9D83C6]' : 'border-l-[#55C2A2]'}`}
            >
              <span className="min-w-[220px] flex-1 text-[15px] leading-snug text-[#2E2E3A]">{item.message}</span>
              <button
                type="button"
                onClick={item.onClick}
                className={`whitespace-nowrap rounded-xl px-[18px] py-2.5 font-['Poppins',_Arial,_sans-serif] text-sm font-semibold transition-colors ${
                  isPurple
                    ? 'bg-[rgba(157,131,198,.18)] text-[#6f56a0] hover:bg-[rgba(157,131,198,.28)]'
                    : 'bg-[rgba(85,194,162,.16)] text-[#3d8a74] hover:bg-[rgba(85,194,162,.26)]'
                }`}
              >
                {item.ctaLabel}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ===================================================================
// COMPONENTES DE SECCIÓN - VISTAS ESPECIALIZADAS POR ROL
// ===================================================================

// Sección de equipos para líderes - Gestión completa de equipos
function LeaderTeamsSection({ teams, teamsLoading, teamMembers, membersLoading, navigate, activeCycles, onPrepareLaunch, launchingTeam, endingTeam, onEndCycle, respondedMembersByTeam, wellbeingByTeam = {}, onCreateTeam, onEditTeam, onDeleteTeam, onRegenerateCode, onKickMember, onTransferLeadership, profile, currentUserId, editingTeam, showEditTeamPanel, onCloseEditPanel, onTeamUpdated, launchContext, showLaunchPanel, onCloseLaunchPanel, onConfirmLaunch }) {
  if (teamsLoading) {
    return (
      <Card className="text-center">
        <LoadingSpinner message="Cargando tus equipos..." />
      </Card>
    );
  }

  if (teams.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-4 py-12 text-center" pad="p-12">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(157,131,198,.16)] text-2xl">👥</span>
        <div>
          <h3 className="font-['Poppins',_Arial,_sans-serif] text-xl font-semibold text-[#2E2E3A]">No tienes equipos creados</h3>
          <p className="mx-auto mt-2 max-w-md text-[#5B5B6B]">
            Crea tu primer equipo para comenzar a gestionar el bienestar de tu grupo de trabajo.
          </p>
        </div>
        <Btn onClick={onCreateTeam}>Crear mi primer equipo</Btn>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      {teams.map((team) => (
        <LeaderTeamCard
          key={team.id}
          team={team}
          members={teamMembers[team.id] || []}
          membersLoading={membersLoading}
          activeCycleId={activeCycles[team.id]}
          onLaunch={onPrepareLaunch}
          launching={launchingTeam === team.id}
          ending={endingTeam === team.id}
          onEndCycle={onEndCycle}
          respondedMembers={respondedMembersByTeam[team.id]}
          wellbeingMetric={wellbeingByTeam[team.id]}
          onEdit={onEditTeam}
          onDelete={onDeleteTeam}
          onRegenerateCode={onRegenerateCode}
          onKickMember={onKickMember}
          onTransferLeadership={onTransferLeadership}
          profile={profile}
          currentUserId={currentUserId}
          isEditingThisTeam={showEditTeamPanel && editingTeam?.id === team.id}
          onCloseEditPanel={onCloseEditPanel}
          onTeamUpdated={onTeamUpdated}
          isLaunchingThisTeam={showLaunchPanel && launchContext?.teamId === team.id}
          launchContext={launchContext?.teamId === team.id ? launchContext : null}
          onCloseLaunchPanel={onCloseLaunchPanel}
          onConfirmLaunch={onConfirmLaunch}
          navigate={navigate}
        />
      ))}
    </div>
  );
}

// Sección de equipos para usuarios miembros - Vista de participación
function UserTeamsSection({ teams, teamMembers, membersLoading, navigate, userId, activeCycles, respondedCycles, respondedMembersByTeam }) {
  if (teams.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-4 py-12 text-center" pad="p-12">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(85,194,162,.16)] text-2xl">🔍</span>
        <div>
          <h3 className="font-['Poppins',_Arial,_sans-serif] text-xl font-semibold text-[#2E2E3A]">No perteneces a ningún equipo</h3>
          <p className="mx-auto mt-2 max-w-md text-[#5B5B6B]">
            Únete a un equipo usando un código de invitación para comenzar a participar en evaluaciones de bienestar.
          </p>
        </div>
        <Btn onClick={() => navigate("/unirse-equipo")}>Unirse a un equipo</Btn>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      {teams.map((team) => (
        <UserTeamCard
          key={team.id}
          team={team}
          members={teamMembers[team.id] || []}
          membersLoading={membersLoading}
          currentUserId={userId}
          activeCycleId={activeCycles[team.id]}
          respondedCycles={respondedCycles}
          respondedMembers={respondedMembersByTeam[team.id]}
          navigate={navigate}
        />
      ))}
    </div>
  );
}

// Sección de bienvenida para usuarios sin rol
function WelcomeSection({ onSetupProfile }) {
  return (
    <Card className="flex flex-col items-center gap-4 py-12 text-center" pad="p-12">
      <img src="/img/pandazen_favicon.png" alt="" className="h-16 w-16 rounded-2xl object-cover shadow-[0_16px_30px_rgba(157,131,198,.22)]" />
      <div>
        <h2 className="font-['Poppins',_Arial,_sans-serif] text-2xl font-bold text-[#2E2E3A]">¡Bienvenido a TeamZen!</h2>
        <p className="mx-auto mt-2 max-w-lg text-[#5B5B6B]">
          TeamZen te ayuda a medir y reducir el burnout en equipos de trabajo. Para comenzar, configura tu perfil y selecciona tu rol.
        </p>
      </div>
      <Btn onClick={onSetupProfile}>Configurar mi perfil</Btn>
    </Card>
  );
}

// Componente para el formulario de perfil en modal
function ProfileFormModal({
  profile,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  role,
  setRole,
  birthDate,
  setBirthDate,
  employmentType,
  setEmploymentType,
  jobTitle,
  setJobTitle,
  startDate,
  setStartDate,
  jobDescription,
  setJobDescription,
  saving,
  profileMsg,
  onSubmit,
  onCancel
}) {
  const isNewUser = !profile; // Usuario nuevo si no tiene perfil

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(46,46,58,.42)] p-4 backdrop-blur-[4px]">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[#DAD5E4] bg-[#FAF9F6] p-6 shadow-teamzen-strong sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/img/pandazen_favicon.png" alt="" className="h-10 w-10 rounded-xl object-cover" />
            <h3 className="font-['Poppins',_Arial,_sans-serif] text-xl font-bold text-[#2E2E3A]">
              {isNewUser ? "¡Bienvenido a TeamZen!" : "Actualizar perfil"}
            </h3>
          </div>
          {!isNewUser && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cerrar"
              disabled={saving}
              className="rounded-xl p-1.5 text-[#5B5B6B] transition-colors hover:bg-[#DAD5E4]/40 hover:text-[#2E2E3A]"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {isNewUser && (
          <Notice className="mb-6">Para comenzar a usar TeamZen, necesitamos algunos datos básicos sobre ti.</Notice>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre*" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Tu nombre" required disabled={saving} />
            <Field label="Apellido*" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Tu apellido" required disabled={saving} />
          </div>

          <Field
            as="select"
            label="¿Vas a crear y liderar equipos?*"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            disabled={(!isNewUser && profile?.role === 'leader') || saving}
          >
            <option value="">Selecciona una opción</option>
            <option value="leader">Sí, quiero poder crear y liderar equipos</option>
            <option value="user">No, por ahora solo quiero unirme a equipos existentes</option>
          </Field>
          {!isNewUser && profile?.role === 'leader' && (
            <p className="-mt-3 text-xs text-[#5B5B6B]">
              Ya activaste la creación de equipos — esto no se puede desactivar. Podés seguir uniéndote a otros equipos como miembro normal cuando quieras.
            </p>
          )}
          {!isNewUser && profile?.role === 'user' && (
            <p className="-mt-3 text-xs text-[#5B5B6B]">
              Podés activar esto más adelante si cambiás de opinión. Una vez que actives la creación de equipos, no vas a poder desactivarla.
            </p>
          )}

          <div className="border-t border-[#DAD5E4] pt-5">
            <h4 className="font-['Poppins',_Arial,_sans-serif] text-base font-semibold text-[#2E2E3A]">Información laboral</h4>
          </div>

          <Field as="input" type="date" label="Fecha de nacimiento*" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required disabled={saving} />

          <Field as="select" label="Tipo de empleo*" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} required disabled={saving}>
            <option value="">Selecciona el tipo de empleo</option>
            <option value="full-time">Tiempo completo</option>
            <option value="part-time">Medio tiempo</option>
          </Field>

          <Field
            label="Cargo/Puesto*"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Ej: Desarrollador Frontend, Gerente de Marketing..."
            required
            disabled={saving}
          />

          <Field as="input" type="date" label="Fecha de inicio en el cargo*" value={startDate} onChange={(e) => setStartDate(e.target.value)} required disabled={saving} />

          <Field
            as="textarea"
            label="Descripción del trabajo (opcional)"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Describe brevemente tus responsabilidades principales..."
            rows={3}
            maxLength={500}
            disabled={saving}
            hint={`${jobDescription.length}/500 caracteres`}
          />

          {profileMsg && (
            <Alert tone={profileMsg.includes('Error') ? 'error' : 'success'}>{profileMsg}</Alert>
          )}

          <div className={`flex ${isNewUser ? 'justify-center' : 'flex-col sm:flex-row'} gap-3 pt-2`}>
            {!isNewUser && (
              <Btn type="button" variant="ghost" onClick={onCancel} disabled={saving} className="flex-1 justify-center sm:flex-none">
                Cancelar
              </Btn>
            )}
            <Btn type="submit" disabled={saving} className={isNewUser ? 'w-full justify-center' : 'flex-1 justify-center'}>
              {saving ? "Guardando..." : isNewUser ? "Crear mi perfil" : "Guardar cambios"}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===================================================================
// COMPONENTES DE TARJETAS - ELEMENTOS DE INTERFAZ ESPECIALIZADOS
// ===================================================================

// Tarjeta de equipo para líderes - Control completo y métricas
function LeaderTeamCard({ team, members, membersLoading, activeCycleId, onLaunch, launching, ending, onEndCycle, respondedMembers, wellbeingMetric, onEdit, onDelete, onRegenerateCode, onKickMember, onTransferLeadership, profile, currentUserId, isEditingThisTeam, onCloseEditPanel, onTeamUpdated, isLaunchingThisTeam, launchContext, onCloseLaunchPanel, onConfirmLaunch, navigate }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  // Cálculo de participación (incluye al líder como participante potencial)
  const totalBase = members?.length || 0;
  const leaderCounts = team.include_leader_in_metrics !== false; // default true if undefined
  const totalParticipantes = leaderCounts ? totalBase + 1 : totalBase; // +1 leader
  let respondedCountRaw = respondedMembers ? respondedMembers.size : 0;
  if (!leaderCounts && respondedMembers && team.leader_id) {
    // Exclude leader id if present
    respondedCountRaw = respondedCountRaw - (respondedMembers.has(team.leader_id) ? 1 : 0);
  }

  // Para vista de líder: incluir líder si está habilitado en métricas
  const allMembersForLeader = useMemo(() => {
    const baseMembers = members || [];

    // Si el líder debe incluirse y es el usuario actual
    if (leaderCounts && profile && team.leader_id === currentUserId) {
      const leaderAsMember = {
        user_id: currentUserId,
        profiles: {
          first_name: profile.first_name,
          last_name: profile.last_name
        },
        isLeader: true
      };

      // Evitar duplicados
      const memberExists = baseMembers.some(m => m.user_id === currentUserId);
      if (!memberExists) {
        return [leaderAsMember, ...baseMembers];
      }
    }

    return baseMembers;
  }, [members, leaderCounts, profile, team.leader_id, currentUserId]);
  const respondedCount = Math.min(Math.max(respondedCountRaw, 0), totalParticipantes);
  const participationPct = activeCycleId ? Math.round((respondedCount / (totalParticipantes || 1)) * 100) : 0;

  const copyCode = async () => {
    if (team.team_invite_codes?.length > 0) {
      try {
        await navigator.clipboard.writeText(team.team_invite_codes[0].code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      } catch { /* clipboard permisos denegados: no bloquear la UI */ }
    }
  };

  const codeExpired = team.team_invite_codes?.[0]?.expires_at && new Date(team.team_invite_codes[0].expires_at) <= new Date();

  return (
    <Card id={`team-card-${team.id}`} className="scroll-mt-20" pad="p-6">
      <div className="flex flex-col gap-[18px]">
        {/* Header del equipo */}
        <div className="flex items-start justify-between gap-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] font-['Poppins',_Arial,_sans-serif] text-xl font-bold text-white">
              {team.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-['Poppins',_Arial,_sans-serif] text-[19px] font-semibold text-[#2E2E3A]">{team.name}</h3>
              <span className="text-[13px] text-[#5B5B6B]">Creado el {new Date(team.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone="purple">Líder</Badge>
            {team.include_leader_in_metrics === false && (
              <Badge tone="neutral" className="hidden sm:inline-flex" title="El líder no se contabiliza en métricas">Líder excluido</Badge>
            )}
            <TeamOptionsMenu
              team={team}
              onEdit={() => onEdit && onEdit(team)}
              onDelete={() => onDelete && onDelete(team.id)}
              onTransferLeadership={onTransferLeadership}
            />
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Ocultar miembros del equipo' : 'Mostrar miembros del equipo'}
              className="rounded-xl border border-[#DAD5E4] bg-[#FAF9F6] p-2 text-[#5B5B6B] transition-colors hover:border-[#9D83C6] hover:text-[#2E2E3A]"
            >
              <svg className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Panel de edición en línea */}
        {isEditingThisTeam && (
          <EditTeamPanel isOpen={isEditingThisTeam} onClose={onCloseEditPanel} team={team} onTeamUpdated={onTeamUpdated} />
        )}

        {/* Estadísticas */}
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Miembros" value={totalParticipantes} />
          <Stat label="Ronda" value={activeCycleId ? "Activa" : "Sin ronda"} color={activeCycleId ? "mint" : undefined} />
          <Stat
            label="Participación"
            value={activeCycleId ? `${participationPct}%` : "—"}
            meter={activeCycleId ? participationPct : undefined}
            foot={activeCycleId ? `${respondedCount} / ${totalParticipantes} respondieron` : undefined}
          />
          <Stat
            label="Bienestar"
            value={activeCycleId ? (wellbeingMetric && wellbeingMetric.avg != null ? wellbeingMetric.avg : "—") : "—"}
            suffix={activeCycleId && wellbeingMetric?.avg != null ? "/100" : undefined}
            color="purple"
            meter={activeCycleId && wellbeingMetric?.avg != null ? wellbeingMetric.avg : undefined}
            foot={activeCycleId && wellbeingMetric?.avg != null ? `${wellbeingMetric.count} resp.` : undefined}
          />
        </div>

        {/* Código de invitación */}
        <div className="flex flex-wrap items-start gap-3.5 rounded-2xl border border-dashed border-[#DAD5E4] bg-[#DAD5E4]/35 px-4 py-3.5">
          <div className="flex min-w-[150px] flex-1 flex-col">
            <span className="text-[11px] font-bold uppercase tracking-[.06em] text-[#5B5B6B]">Código de invitación</span>
            {team.team_invite_codes?.length > 0 ? (
              <>
                <span className="select-all break-all font-['Poppins',_Arial,_sans-serif] text-xl font-bold tracking-[.18em] text-[#2E2E3A]">
                  {showInvite ? team.team_invite_codes[0].code : '••••••'}
                </span>
                {codeExpired ? (
                  <span className="text-xs font-medium text-red-600">Expirado — genera uno nuevo</span>
                ) : (
                  team.team_invite_codes[0].expires_at && (
                    <span className="text-xs text-[#5B5B6B]">Expira el {new Date(team.team_invite_codes[0].expires_at).toLocaleDateString()}</span>
                  )
                )}
                {copied && <span className="text-xs font-medium text-[#3d8a74]">Copiado</span>}
              </>
            ) : (
              <span className="font-['Poppins',_Arial,_sans-serif] text-base font-semibold text-[#5B5B6B]">Sin código</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowInvite((v) => !v)}
              className="rounded-xl border border-[#DAD5E4] bg-white px-3.5 py-2.5 font-['Poppins',_Arial,_sans-serif] text-[13px] font-semibold text-[#2E2E3A] hover:border-[#9D83C6]"
            >
              {showInvite ? 'Ocultar' : 'Mostrar'}
            </button>
            <button
              type="button"
              onClick={copyCode}
              className="rounded-xl bg-[rgba(85,194,162,.16)] px-3.5 py-2.5 font-['Poppins',_Arial,_sans-serif] text-[13px] font-semibold text-[#3d8a74] hover:bg-[rgba(85,194,162,.26)]"
            >
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              type="button"
              onClick={() => onRegenerateCode && onRegenerateCode(team.id)}
              className="rounded-xl border border-[#9D83C6]/50 px-3.5 py-2.5 font-['Poppins',_Arial,_sans-serif] text-[13px] font-semibold text-[#6f56a0] hover:bg-[rgba(157,131,198,.1)]"
            >
              Regenerar
            </button>
          </div>
        </div>

        {/* Miembros expandibles */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setIsExpanded((o) => !o)}
            aria-expanded={isExpanded}
            className="flex items-center justify-between py-1 font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#2E2E3A]"
          >
            <span>Miembros del equipo</span>
            <span className="text-[#5B5B6B]">{isExpanded ? '▲' : '▼'}</span>
          </button>
          {isExpanded && (
            membersLoading ? (
              <LoadingSpinner size="small" />
            ) : allMembersForLeader?.length > 0 ? (
              <div className="flex flex-col gap-2">
                {allMembersForLeader.map((member) => {
                  const hasResponded = !!(respondedMembers && respondedMembers.has(member.user_id));
                  const isLeaderMember = member.isLeader;
                  return (
                    <div key={member.user_id} className="flex items-center gap-3 rounded-[14px] border border-[#DAD5E4] bg-[#FAF9F6] px-3.5 py-[11px]">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-['Poppins',_Arial,_sans-serif] text-[13px] font-bold ${isLeaderMember ? 'bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] text-white' : 'bg-[rgba(157,131,198,.2)] text-[#6f56a0]'}`}>
                        {member.profiles?.first_name?.charAt(0) || 'U'}
                      </span>
                      <span className="flex-1 truncate text-sm text-[#2E2E3A]">
                        {member.profiles?.first_name && member.profiles?.last_name
                          ? `${member.profiles.first_name} ${member.profiles.last_name}`
                          : 'Usuario sin nombre'}
                      </span>
                      <span className="hidden text-xs text-[#5B5B6B] sm:inline">{isLeaderMember ? 'Líder' : 'Miembro'}</span>
                      {activeCycleId ? (
                        <Badge tone={hasResponded ? 'mint' : 'purple'}>{hasResponded ? 'Respondió' : 'Pendiente'}</Badge>
                      ) : (
                        <Badge tone="neutral">Sin ronda</Badge>
                      )}
                      {!isLeaderMember && (
                        <button
                          type="button"
                          onClick={() => onKickMember && onKickMember(team.id, member.user_id)}
                          aria-label="Expulsar miembro"
                          title="Expulsar del equipo"
                          className="rounded-lg p-1 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm italic text-[#5B5B6B]">Sin miembros aún</p>
            )
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[#DAD5E4] pt-4">
          {activeCycleId ? (
            <Btn variant="danger" onClick={() => onEndCycle && onEndCycle(team.id)} disabled={ending} className="min-w-[150px] flex-1 justify-center">
              {ending ? 'Terminando...' : 'Terminar ronda'}
            </Btn>
          ) : (
            <Btn onClick={() => onLaunch && onLaunch(team)} disabled={launching} aria-expanded={isLaunchingThisTeam} className="min-w-[150px] flex-1 justify-center">
              {launching ? 'Iniciando...' : 'Iniciar ronda'}
            </Btn>
          )}
          {activeCycleId && (
            <span className="hidden rounded-xl border border-[rgba(85,194,162,.3)] bg-[rgba(85,194,162,.1)] px-4 py-2.5 text-xs font-medium text-[#3d8a74] sm:inline-flex sm:min-w-[150px] sm:flex-1 sm:items-center sm:justify-center">
              {participationPct === 100 ? 'Todos respondieron' : 'Ronda activa'}
            </span>
          )}
          <Btn variant="secondary" onClick={() => navigate(`/reportes?team=${team.id}`)} className="min-w-[150px] flex-1 justify-center">
            Generar reporte
          </Btn>
        </div>

        {isLaunchingThisTeam && (
          <LaunchMBIPanel isOpen={isLaunchingThisTeam} context={launchContext} launching={launching} onClose={onCloseLaunchPanel} onConfirm={onConfirmLaunch} />
        )}
      </div>
    </Card>
  );
}

// Tarjeta de equipo para usuarios miembros - Vista de participación
function UserTeamCard({ team, members, membersLoading, currentUserId, activeCycleId, respondedCycles, respondedMembers, navigate }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const currentMember = members?.find(m => m.user_id === currentUserId);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showOptionsMenu && !event.target.closest('.options-menu')) {
        setShowOptionsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOptionsMenu]);

  // Aplicar configuraciones de privacidad
  const canSeeOthers = team.members_can_see_others ?? true;
  const canSeeResponses = team.members_can_see_responses ?? true;

  // Filtrar miembros basado en configuración de privacidad
  const visibleMembers = canSeeOthers
    ? members
    : members?.filter(m => m.user_id === currentUserId) || [];

  // Calcular total de participantes (siempre mostrar el total real)
  const totalParticipantes = members?.length || 0;

  const handleUpdatePrivacy = async (privacySettings) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('team_members')
        .update({ share_results_with_leader: privacySettings.share_results_with_leader })
        .eq('team_id', team.id)
        .eq('user_id', currentUserId);

      if (error) throw error;

      setShowPrivacyModal(false);
      // Recargar la página para reflejar los cambios
      window.location.reload();
    } catch (error) {
      console.error('Error actualizando preferencias:', error);
      alert(`Error al actualizar las preferencias de privacidad: ${error.message || JSON.stringify(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveTeam = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', team.id)
        .eq('user_id', currentUserId);

      if (error) throw error;

      setShowLeaveModal(false);
      // Recargar la página para reflejar los cambios
      window.location.reload();
    } catch (error) {
      console.error('Error saliendo del equipo:', error);
      alert('Error al salir del equipo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card pad="p-6">
      <div className="flex flex-col gap-[18px]">
        {/* Header del equipo */}
        <div className="flex items-start justify-between gap-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] font-['Poppins',_Arial,_sans-serif] text-xl font-bold text-white">
              {team.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-['Poppins',_Arial,_sans-serif] text-[19px] font-semibold text-[#2E2E3A]">{team.name}</h3>
              <span className="text-[13px] text-[#5B5B6B]">Miembro desde que te uniste al equipo</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone="mint">Miembro</Badge>
            <div className="options-menu relative">
              <button
                type="button"
                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                aria-label="Opciones del equipo"
                aria-expanded={showOptionsMenu}
                className="rounded-xl border border-[#DAD5E4] bg-[#FAF9F6] p-2 text-[#5B5B6B] transition-colors hover:border-[#9D83C6] hover:text-[#2E2E3A]"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>

              {showOptionsMenu && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-10 flex w-56 flex-col gap-1 rounded-2xl border border-[#DAD5E4] bg-white p-2 shadow-teamzen-strong">
                  <button
                    type="button"
                    onClick={() => { setShowPrivacyModal(true); setShowOptionsMenu(false); }}
                    className="rounded-xl px-3 py-2 text-left font-['Poppins',_Arial,_sans-serif] text-sm font-medium text-[#2E2E3A] hover:bg-[#DAD5E4]/40"
                  >
                    Configurar privacidad
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowLeaveModal(true); setShowOptionsMenu(false); }}
                    className="rounded-xl px-3 py-2 text-left font-['Poppins',_Arial,_sans-serif] text-sm font-medium text-[#c0392b] hover:bg-[rgba(192,57,43,.08)]"
                  >
                    Salir del equipo
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Ocultar miembros del equipo' : 'Mostrar miembros del equipo'}
              className="rounded-xl border border-[#DAD5E4] bg-[#FAF9F6] p-2 text-[#5B5B6B] transition-colors hover:border-[#9D83C6] hover:text-[#2E2E3A]"
            >
              <svg className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Miembros" value={totalParticipantes} />
          <Stat label="Ronda" value={activeCycleId ? "Activa" : "Sin ronda"} color={activeCycleId ? "mint" : undefined} />
        </div>

        {activeCycleId && (
          <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${respondedCycles[activeCycleId] ? 'border-[rgba(85,194,162,.3)] bg-[rgba(85,194,162,.1)]' : 'border-[rgba(157,131,198,.32)] bg-[rgba(157,131,198,.12)]'}`}>
            <Dot tone={respondedCycles[activeCycleId] ? 'mint' : 'purple'} />
            <div>
              <p className="text-sm font-medium text-[#2E2E3A]">
                {respondedCycles[activeCycleId] ? 'Ya respondiste este ciclo' : 'Evaluación pendiente — tus respuestas son privadas.'}
              </p>
            </div>
          </div>
        )}

        {/* Miembros expandibles */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setIsExpanded((o) => !o)}
            aria-expanded={isExpanded}
            className="flex items-center justify-between py-1 font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#2E2E3A]"
          >
            <span>Miembros del equipo</span>
            <span className="text-[#5B5B6B]">{isExpanded ? '▲' : '▼'}</span>
          </button>
          {isExpanded && (
            membersLoading ? (
              <LoadingSpinner size="small" />
            ) : visibleMembers?.length > 0 ? (
              <div className="flex flex-col gap-2">
                {visibleMembers.map((member) => {
                  const hasResponded = !!(respondedMembers && respondedMembers.has(member.user_id));
                  const isCurrentUser = member.user_id === currentUserId;
                  const isLeader = member.is_leader || member.user_id === team.leader_id;

                  return (
                    <div key={member.user_id} className="flex items-center gap-3 rounded-[14px] border border-[#DAD5E4] bg-[#FAF9F6] px-3.5 py-[11px]">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-['Poppins',_Arial,_sans-serif] text-[13px] font-bold ${isCurrentUser || isLeader ? 'bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] text-white' : 'bg-[rgba(157,131,198,.2)] text-[#6f56a0]'}`}>
                        {member.profiles?.first_name?.charAt(0) || 'U'}
                      </span>
                      <span className="flex-1 truncate text-sm text-[#2E2E3A]">
                        {member.profiles?.first_name && member.profiles?.last_name
                          ? `${member.profiles.first_name} ${member.profiles.last_name}`
                          : 'Usuario sin nombre'}
                        {isCurrentUser && <span className="ml-2 text-xs font-semibold text-[#3d8a74]">(Tú)</span>}
                        {isLeader && <span className="ml-2 text-xs font-semibold text-[#3d8a74]">(Líder)</span>}
                      </span>
                      {activeCycleId && canSeeResponses ? (
                        <Badge tone={hasResponded ? 'mint' : 'purple'}>{hasResponded ? 'Respondió' : 'Pendiente'}</Badge>
                      ) : activeCycleId && !canSeeResponses && isCurrentUser ? (
                        <Badge tone={hasResponded ? 'mint' : 'purple'}>{hasResponded ? 'Respondiste' : 'Pendiente'}</Badge>
                      ) : activeCycleId ? (
                        <Badge tone="neutral">Privado</Badge>
                      ) : (
                        <Badge tone="neutral">Sin ronda</Badge>
                      )}
                    </div>
                  );
                })}
                {!canSeeOthers && visibleMembers.length === 1 && (
                  <Notice tone="purple">Configuración de privacidad: Solo puedes verte a ti mismo.</Notice>
                )}
                {canSeeOthers && visibleMembers.filter(m => m.user_id !== currentUserId).length === 0 && (
                  <p className="text-sm italic text-[#5B5B6B]">Eres el único miembro del equipo</p>
                )}
              </div>
            ) : (
              <p className="text-sm italic text-[#5B5B6B]">Sin otros miembros</p>
            )
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[#DAD5E4] pt-4">
          {!activeCycleId ? (
            <span className="flex min-w-[150px] flex-1 items-center justify-center rounded-xl border border-[#DAD5E4] bg-[#DAD5E4]/30 px-4 py-2.5 text-sm font-medium text-[#5B5B6B]">Sin ronda activa</span>
          ) : respondedCycles[activeCycleId] ? (
            <span className="flex min-w-[150px] flex-1 items-center justify-center rounded-xl border border-[rgba(85,194,162,.3)] bg-[rgba(85,194,162,.1)] px-4 py-2.5 text-sm font-medium text-[#3d8a74]">Respondido</span>
          ) : (
            <Btn onClick={() => navigate(`/mbi?team=${team.id}`)} className="min-w-[150px] flex-1 justify-center">Completar MBI</Btn>
          )}
          <Btn variant="ghost" className="min-w-[150px] flex-1 justify-center">Ver Historial</Btn>
        </div>
      </div>

      {/* Modal de configuración de privacidad */}
      <Modal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} title="Configurar privacidad">
        <PrivacySettingsForm
          currentSettings={currentMember}
          teamSettings={team}
          teamName={team.name}
          onSave={handleUpdatePrivacy}
          onCancel={() => setShowPrivacyModal(false)}
          loading={loading}
        />
      </Modal>

      {/* Modal de salir del equipo */}
      <Modal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="Salir del equipo">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#5B5B6B]">¿Estás seguro de que quieres salir del equipo "{team.name}"?</p>
          <Alert title="Esta acción no se puede deshacer">
            Al salir del equipo perderás acceso a todos los datos y evaluaciones.
          </Alert>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
            <Btn type="button" variant="ghost" onClick={() => setShowLeaveModal(false)} disabled={loading} className="flex-1 justify-center">
              Cancelar
            </Btn>
            <Btn type="button" variant="danger" onClick={handleLeaveTeam} disabled={loading} className="flex-1 justify-center">
              {loading ? "Saliendo..." : "Salir del equipo"}
            </Btn>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

// Componente para configurar las preferencias de privacidad (personal, por miembro)
function PrivacySettingsForm({ currentSettings, onSave, onCancel, loading, teamSettings, teamName }) {
  const [shareResults, setShareResults] = useState(currentSettings?.share_results_with_leader ?? false);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[#5B5B6B]">Configura qué información quieres compartir en el equipo "{teamName}".</p>

      <div className="flex items-start gap-3.5 rounded-2xl border border-[#DAD5E4] bg-[#FAF9F6] p-4">
        <Check checked={shareResults} onChange={() => setShareResults((v) => !v)} />
        <div>
          <h4 className="font-['Poppins',_Arial,_sans-serif] text-[15px] font-semibold text-[#2E2E3A]">Compartir mis resultados de evaluación con el líder</h4>
          <p className="mt-0.5 text-sm text-[#5B5B6B]">Si lo desactivas, tu líder solo verá que respondiste, nunca tu puntaje.</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-3 text-sm text-[#5B5B6B]">
          <Dot tone={teamSettings?.members_can_see_others ? 'mint' : 'neutral'} size={8} />
          Los miembros pueden ver a otros integrantes — <strong className="font-bold text-[#2E2E3A]">{teamSettings?.members_can_see_others ? 'activado' : 'desactivado'} por el líder</strong>
        </div>
        <div className="flex items-center gap-3 text-sm text-[#5B5B6B]">
          <Dot tone={teamSettings?.members_can_see_responses ? 'mint' : 'neutral'} size={8} />
          Los miembros pueden ver si otros respondieron — <strong className="font-bold text-[#2E2E3A]">{teamSettings?.members_can_see_responses ? 'activado' : 'desactivado'} por el líder</strong>
        </div>
      </div>
      <p className="text-[13px] text-[#5B5B6B]">Estas dos configuraciones las controla el líder del equipo; se muestran solo para tu información.</p>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
        <Btn type="button" variant="ghost" onClick={onCancel} disabled={loading} className="flex-1 justify-center">
          Cancelar
        </Btn>
        <Btn type="button" onClick={() => onSave({ share_results_with_leader: shareResults })} disabled={loading} className="flex-1 justify-center">
          {loading ? "Guardando..." : "Guardar preferencia"}
        </Btn>
      </div>
    </div>
  );
}
