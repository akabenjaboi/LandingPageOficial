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
import { Card, Button, Alert, Badge, Input } from "../components/UIComponents";
import AppNavbar from "../components/AppNavbar";
import LaunchMBIPanel from "../components/LaunchMBIPanel";
import CreateTeamPanel from "../components/CreateTeamPanel";
import TeamOptionsMenu from "../components/TeamOptionsMenu";
import EditTeamPanel from "../components/EditTeamPanel";
import TransferLeadershipModal from "../components/TransferLeadershipModal";

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
              setDataError('No se pudieron cargar los ciclos de evaluación. Algunos datos podrían faltar.');
            }
            const cycleMap = {};
            (cycles || []).forEach(c => { cycleMap[c.team_id] = c.id; });
            setActiveCycles(prev => ({ ...prev, ...cycleMap }));

            const activeCycleIds = Object.values(cycleMap);
            if (activeCycleIds.length > 0) {
              const { data: allResponses, error: allResponsesError } = await supabase
                .from('mbi_responses')
                .select('cycle_id, user_id')
                .in('cycle_id', activeCycleIds);
              if (allResponsesError) {
                console.warn('Error cargando respuestas MBI (líder):', allResponsesError);
                setDataError('No se pudieron cargar algunas respuestas de bienestar. Algunos datos podrían faltar.');
              }

              const respMap = {};
              (allResponses || []).filter(r => r.user_id === currentUser.id).forEach(r => {
                if (r.cycle_id) respMap[r.cycle_id] = true;
              });

              const teamResponded = {};
              (allResponses || []).forEach(r => {
                const teamId = Object.keys(cycleMap).find(tid => cycleMap[tid] === r.cycle_id);
                if (teamId && r.user_id) {
                  if (!teamResponded[teamId]) teamResponded[teamId] = new Set();
                  teamResponded[teamId].add(r.user_id);
                }
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
                setDataError('No se pudieron cargar los ciclos de evaluación. Algunos datos podrían faltar.');
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
        setDataError('No se pudo cerrar el ciclo anterior. Intenta lanzar el MBI de nuevo.');
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
      alert('Error lanzando MBI: ' + (e.message || ''));
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
      alert('Error terminando ciclo: ' + (e.message || ''));
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
      const { data: responded, error } = await supabase
        .from('mbi_responses')
        .select('user_id')
        .eq('cycle_id', activeCycleId);
      if (error) {
        console.error('Error cargando respuestas del ciclo:', error);
        setDataError('No se pudo verificar quién ha respondido. Intenta de nuevo.');
        return;
      }
      const respondedSet = new Set((responded || []).map(r => r.user_id));
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
  
  const handleTeamCreated = async (newTeam, inviteCode) => {
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
    // "Dashboard" mobile nav button at line ~936, which already reloads
    // the page rather than re-running init() piecemeal.
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
            message: `${team.name}: ${pending} de ${totalParticipants} aún no ${pending === 1 ? 'ha' : 'han'} respondido el ciclo activo`,
            ctaLabel: 'Ver equipo',
            onClick: () => scrollToTeam(team.id),
          });
        }
      } else if (members.length > 0) {
        items.push({
          id: `nocycle-${team.id}`,
          tone: 'mint',
          message: `${team.name} no tiene un ciclo de evaluación activo`,
          ctaLabel: 'Lanzar MBI',
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
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
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
      {/* Header Navigation */}
      <AppNavbar
        user={user}
        profile={profile}
        onProfileEdit={() => setShowProfileForm(true)}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 md:pb-8"
           id="teams-section">
        {dataError && (
          <Alert type="error" title="Error al cargar datos" className="mb-4">
            {dataError}
          </Alert>
        )}
        {/* Welcome Section & Profile Setup */}
        {(!profile?.first_name || !profile?.last_name) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 mb-6 sm:mb-8">
            <div className="flex items-start sm:items-center">
              <svg className="w-5 h-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5 sm:mt-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-amber-800">Completa tu perfil</h3>
                <p className="text-xs sm:text-sm text-amber-700 mt-1">
                  Para aprovechar al máximo TeamZen, completa tu información personal haciendo clic en tu avatar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#2E2E3A] tracking-tight">
                {profile?.role === "leader" ? "Panel de Líder" : "Mis Equipos"}
              </h1>
              <p className="text-sm sm:text-base text-[#5B5B6B] mt-1">
                {profile?.role === "leader" 
                  ? "Gestiona tus equipos y monitorea el bienestar"
                  : "Visualiza los equipos de los que formas parte"
                }
              </p>
            </div>
            
            {/* Action Button */}
            {profile?.role === "leader" ? (
              <button
                onClick={() => setShowCreateTeamPanel(true)}
                className="bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#4AB393] hover:to-[#8B6FB8] 
                           text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-all duration-300 
                           ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow flex items-center 
                           space-x-1.5 sm:space-x-2 text-sm sm:text-base w-full sm:w-auto justify-center"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Crear Equipo</span>
              </button>
            ) : profile?.role === "user" ? (
              <button
                onClick={() => navigate("/unirse-equipo")}
                className="bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#4AB393] hover:to-[#8B6FB8] 
                           text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-all duration-300 
                           ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow flex items-center 
                           space-x-1.5 sm:space-x-2 text-sm sm:text-base w-full sm:w-auto justify-center"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Unirse a Equipo</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Requiere tu atención — resumen accionable antes de la lista de equipos */}
        {(showLeaderSection || showMemberSection) && (
          <AttentionSection items={attentionItems} />
        )}

        {/* Teams Section */}
        <div className="space-y-6">
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
        </div>

        {/* Profile Form Modal */}
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
      </div>
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
      <div className="mb-6 sm:mb-8 rounded-2xl border border-[#55C2A2]/30 bg-gradient-to-r from-[#55C2A2]/[0.07] to-[#9D83C6]/[0.05] shadow-teamzen p-4 sm:p-5 flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-[#55C2A2]/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-[#2C7B64]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <p className="text-sm text-[#2E2E3A]">
          <span className="font-semibold">Todo al día.</span> No hay evaluaciones pendientes ni alertas en tus equipos.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 sm:mb-8">
      <h2 className="text-lg sm:text-xl font-semibold text-[#2E2E3A] mb-3">Requiere tu atención</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => {
          const isPurple = item.tone === 'purple';
          return (
            <li
              key={item.id}
              className={`rounded-2xl border shadow-teamzen p-4 flex items-start gap-3 ${
                isPurple ? 'border-[#9D83C6]/30 bg-[#9D83C6]/[0.06]' : 'border-[#55C2A2]/30 bg-[#55C2A2]/[0.06]'
              }`}
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isPurple ? 'bg-[#9D83C6]/20' : 'bg-[#55C2A2]/20'}`}>
                {isPurple ? (
                  <svg className="w-4 h-4 text-[#8160B6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-[#2C7B64]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#2E2E3A] leading-snug">{item.message}</p>
                <button
                  onClick={item.onClick}
                  className={`mt-2 text-xs sm:text-sm font-semibold rounded-lg px-3 py-1.5 transition-colors duration-200 ${
                    isPurple
                      ? 'text-[#8160B6] hover:bg-[#9D83C6]/15'
                      : 'text-[#2C7B64] hover:bg-[#55C2A2]/15'
                  }`}
                >
                  {item.ctaLabel} →
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ===================================================================
// COMPONENTES DE SECCIÓN - VISTAS ESPECIALIZADAS POR ROL
// ===================================================================

// Sección de equipos para líderes - Gestión completa de equipos
function LeaderTeamsSection({ teams, teamsLoading, teamMembers, membersLoading, navigate, activeCycles, onPrepareLaunch, launchingTeam, endingTeam, onEndCycle, respondedMembersByTeam, wellbeingByTeam = {}, onCreateTeam, onEditTeam, onDeleteTeam, onRegenerateCode, onKickMember, onTransferLeadership, profile, currentUserId, editingTeam, showEditTeamPanel, onCloseEditPanel, onTeamUpdated, launchContext, showLaunchPanel, onCloseLaunchPanel, onConfirmLaunch }) {
  if (teamsLoading) {
    return (
      <div className="bg-[#FAF9F6] rounded-2xl shadow-teamzen border border-[#DAD5E4] p-8 text-center">
        <LoadingSpinner message="Cargando tus equipos..." />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="bg-[#FAF9F6] border border-[#DAD5E4] rounded-2xl shadow-teamzen p-12 text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-[#55C2A2]/20 to-[#9D83C6]/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#55C2A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-[#2E2E3A] mb-2">No tienes equipos creados</h3>
        <p className="text-[#5B5B6B] mb-6 max-w-md mx-auto">
          Crea tu primer equipo para comenzar a gestionar el bienestar de tu grupo de trabajo.
        </p>
        <button
          onClick={onCreateTeam}
          className="bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#4AB393] hover:to-[#8B6FB8] text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow"
        >
          Crear mi primer equipo
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {teams.map((team) => (
        <div key={team.id} className="w-full">
          <LeaderTeamCard
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
          />
        </div>
      ))}
    </div>
  );
}

// Sección de equipos para usuarios miembros - Vista de participación
function UserTeamsSection({ teams, teamMembers, membersLoading, navigate, userId, activeCycles, respondedCycles, respondedMembersByTeam }) {
  if (teams.length === 0) {
    return (
      <div className="bg-[#FAF9F6] border border-[#DAD5E4] rounded-2xl shadow-teamzen p-12 text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-[#55C2A2]/20 to-[#9D83C6]/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#55C2A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-[#2E2E3A] mb-2">No perteneces a ningún equipo</h3>
        <p className="text-[#5B5B6B] mb-6 max-w-md mx-auto">
          Únete a un equipo usando un código de invitación para comenzar a participar en evaluaciones de bienestar.
        </p>
        <button
          onClick={() => navigate("/unirse-equipo")}
          className="bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#4AB393] hover:to-[#8B6FB8] text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow"
        >
          Unirse a un equipo
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        />
      ))}
    </div>
  );
}

// Sección de bienvenida para usuarios sin rol
function WelcomeSection({ onSetupProfile }) {
  return (
    <div className="bg-[#FAF9F6] border border-[#DAD5E4] rounded-2xl shadow-teamzen p-12 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-[#55C2A2] to-[#9D83C6] rounded-full flex items-center justify-center mx-auto mb-6 shadow-teamzen-glow animate-pulse-glow">
        <img 
          src="/img/pandalogo.png" 
          alt="TeamZen Logo" 
          className="w-12 h-12"
        />
      </div>
      <h2 className="text-2xl font-bold text-[#2E2E3A] mb-3">¡Bienvenido a TeamZen!</h2>
      <p className="text-[#5B5B6B] mb-8 max-w-lg mx-auto">
        TeamZen te ayuda a medir y reducir el burnout en equipos de trabajo. 
        Para comenzar, configura tu perfil y selecciona tu rol.
      </p>
      <button
        onClick={onSetupProfile}
        className="bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#4AB393] hover:to-[#8B6FB8] text-white px-8 py-3 rounded-xl font-medium transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow flex items-center gap-2 mx-auto"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Configurar mi perfil
      </button>
    </div>
  );
}

// Componente para el formulario de perfil
function ProfileForm({ profile, firstName, setFirstName, lastName, setLastName, role, setRole, saving, profileMsg, onSubmit, onCancel }) {
  const handleSubmit = (e) => {
    console.log("ProfileForm handleSubmit called"); // Debug
    onSubmit(e);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-[#2E2E3A]">
            {!profile?.first_name && !profile?.last_name ? "Completar Perfil" : "Actualizar Perfil"}
          </h3>
          <button onClick={onCancel} aria-label="Cerrar" className="text-[#5B5B6B] hover:text-[#2E2E3A]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            placeholder="Tu nombre"
          />
          
          <Input
            label="Apellido"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            placeholder="Tu apellido"
          />

          {(!profile?.first_name && !profile?.last_name) && (
            <div className="flex flex-col gap-1">
              <label className="font-semibold text-[#2E2E3A] text-sm">
                Rol <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                className="w-full border border-[#DAD5E4] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#55C2A2] focus:border-transparent"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                <option value="">Selecciona tu rol</option>
                <option value="user">Miembro de Equipo</option>
                <option value="leader">Líder de Equipo</option>
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancelar
            </Button>
            <button
              type="submit"
              disabled={saving}
              className={`
                bg-[#55C2A2] hover:bg-[#9D83C6] text-[#2E2E3A] px-6 py-3 text-base
                rounded-full font-semibold transition-all duration-300 
                flex items-center justify-center gap-2 flex-1
                ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:transform hover:scale-105'}
              `}
            >
              {saving && (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              )}
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>

          {profileMsg && (
            <Alert type={profileMsg.includes("Error") ? "error" : "success"}>
              {profileMsg}
            </Alert>
          )}
        </form>
      </Card>
    </div>
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
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Gestionar animaciones de apertura
  useEffect(() => {
    setIsVisible(true);
    setTimeout(() => setIsAnimating(true), 10);
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);
  
  return (
    <div className={`modal-backdrop-motion fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ease-out
      ${isAnimating ? 'backdrop-blur-sm bg-white/10' : 'backdrop-blur-none bg-white/0'}`}>
      <div className={`modal-panel-motion bg-[#FAF9F6] border border-[#DAD5E4] rounded-2xl shadow-teamzen-strong max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 transition-all duration-300 ease-out
        ${isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img 
              src="/img/pandalogo.png" 
              alt="TeamZen Profile" 
              className="w-10 h-10 object-contain animate-pulse-glow"
            />
            <h3 className="text-xl font-bold text-[#2E2E3A]">
              {isNewUser ? "¡Bienvenido a TeamZen!" : "Actualizar perfil"}
            </h3>
          </div>
          {!isNewUser && (
            <button
              onClick={onCancel}
              aria-label="Cerrar"
              className="text-[#5B5B6B] hover:text-[#2E2E3A] transition-colors duration-200 p-1 rounded-lg hover:bg-[#DAD5E4]/30"
              disabled={saving}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {isNewUser && (
          <div className="bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border border-[#55C2A2]/30 rounded-xl p-4 mb-6">
            <p className="text-[#2E2E3A] text-sm">
              Para comenzar a usar TeamZen, necesitamos algunos datos básicos sobre ti.
            </p>
          </div>
        )}
        
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
                Nombre*
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A] placeholder-[#5B5B6B]"
                placeholder="Tu nombre"
                required
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
                Apellido*
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A] placeholder-[#5B5B6B]"
                placeholder="Tu apellido"
                required
                disabled={saving}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
              Rol en TeamZen*
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A]"
              required
              disabled={(!isNewUser && profile?.role) || saving}
            >
              <option value="">Selecciona tu rol</option>
              <option value="leader">Líder de equipo - Puedo crear y gestionar equipos</option>
              <option value="user">Miembro de equipo - Me uno a equipos existentes</option>
            </select>
            {!isNewUser && profile?.role && (
              <p className="text-xs text-[#5B5B6B] mt-2">
                El rol no se puede cambiar una vez establecido. Contacta al administrador si necesitas cambiarlo.
              </p>
            )}
          </div>

          {/* Separador visual */}
          <div className="border-t border-[#DAD5E4] pt-6">
            <h4 className="text-lg font-medium text-[#2E2E3A] mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#55C2A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2h8z" />
              </svg>
              Información laboral
            </h4>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
              Fecha de nacimiento*
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A]"
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
              Tipo de empleo*
            </label>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A]"
              required
              disabled={saving}
            >
              <option value="">Selecciona el tipo de empleo</option>
              <option value="full-time">Tiempo completo</option>
              <option value="part-time">Medio tiempo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
              Cargo/Puesto*
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Ej: Desarrollador Frontend, Gerente de Marketing..."
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A] placeholder-[#5B5B6B]"
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
              Fecha de inicio en el cargo*
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A]"
              required
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2E2E3A] mb-2">
              Descripción del trabajo (opcional)
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Describe brevemente tus responsabilidades principales..."
              className="w-full px-4 py-3 border border-[#DAD5E4] rounded-xl focus:ring-2 focus:ring-[#55C2A2]/20 focus:border-[#55C2A2] transition-all duration-200 bg-[#FAF9F6] text-[#2E2E3A] placeholder-[#5B5B6B] resize-none"
              rows={3}
              maxLength={500}
              disabled={saving}
            />
            <p className="text-xs text-[#5B5B6B] mt-2">
              {jobDescription.length}/500 caracteres
            </p>
          </div>

          {profileMsg && (
            <div className={`rounded-xl p-4 border transition-all duration-300 ${
              profileMsg.includes('Error') 
                ? 'bg-red-50 border-red-200 text-red-700' 
                : 'bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border-[#55C2A2]/30 text-[#2E2E3A]'
            }`}>
              <p className="text-sm">{profileMsg}</p>
            </div>
          )}
          
          <div className={`flex ${isNewUser ? 'justify-center' : 'flex-col sm:flex-row gap-3'} pt-6`}>
            {!isNewUser && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 sm:flex-none bg-white border-2 border-[#DAD5E4] hover:border-[#55C2A2] text-[#2E2E3A] font-medium py-3 px-6 rounded-xl transition-all duration-300 ease-out transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:transform-none"
                disabled={saving}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className={`${isNewUser ? 'w-full' : 'flex-1'} bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#4AB393] hover:to-[#8B6FB8] disabled:from-[#55C2A2]/50 disabled:to-[#9D83C6]/50 text-white font-medium py-3 px-6 rounded-xl transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center gap-2`}
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {isNewUser ? "Crear mi perfil" : "Guardar cambios"}
                </>
              )}
            </button>
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
function LeaderTeamCard({ team, members, membersLoading, activeCycleId, onLaunch, launching, ending, onEndCycle, respondedMembers, wellbeingMetric, onEdit, onDelete, onRegenerateCode, onKickMember, onTransferLeadership, profile, currentUserId, isEditingThisTeam, onCloseEditPanel, onTeamUpdated, isLaunchingThisTeam, launchContext, onCloseLaunchPanel, onConfirmLaunch }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

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

  return (
    <div id={`team-card-${team.id}`} className="bg-[#FAF9F6] border border-[#DAD5E4] rounded-2xl shadow-teamzen hover:shadow-teamzen-strong transition-shadow scroll-mt-20">
      <div className="p-6">
        {/* Header del equipo */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#55C2A2] to-[#9D83C6] rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white font-bold text-sm sm:text-lg">
                {team.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-[#2E2E3A] truncate">{team.name}</h3>
              <p className="text-xs sm:text-sm text-[#5B5B6B]">
                Creado el {new Date(team.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0 ml-2">
            <span className="bg-gradient-to-r from-[#55C2A2]/20 to-[#9D83C6]/20 text-[#2E2E3A] text-xs font-medium px-2 py-0.5 rounded-full border border-[#55C2A2]/30">
              Líder
            </span>
            {team.include_leader_in_metrics === false && (
              <span className="bg-[#DAD5E4] text-[#5B5B6B] text-xs font-medium px-2 py-0.5 rounded-full hidden sm:inline" title="El líder no se contabiliza en métricas">
                Líder excluido
              </span>
            )}
            <TeamOptionsMenu
              team={team}
              onEdit={() => onEdit && onEdit(team)}
              onDelete={() => onDelete && onDelete(team.id)}
              onTransferLeadership={onTransferLeadership}
            />
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Ocultar miembros del equipo' : 'Mostrar miembros del equipo'}
              className="p-1.5 sm:p-2 hover:bg-[#DAD5E4]/30 rounded-lg transition-colors"
            >
              <svg
                className={`w-4 h-4 sm:w-5 sm:h-5 text-[#5B5B6B] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Panel de edición en línea — reemplaza al EditTeamModal flotante */}
        {isEditingThisTeam && (
          <EditTeamPanel
            isOpen={isEditingThisTeam}
            onClose={onCloseEditPanel}
            team={team}
            onTeamUpdated={onTeamUpdated}
          />
        )}

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 mt-4">
          <div className="bg-[#FAF9F6] border border-[#DAD5E4] p-3 rounded-xl">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#5B5B6B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <div>
                <p className="text-xs font-medium text-[#5B5B6B]">Miembros</p>
                <p className="text-lg sm:text-xl font-bold tabular-nums text-[#2E2E3A]">{totalParticipantes}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#FAF9F6] border border-[#DAD5E4] p-3 rounded-xl">
            <div className="flex items-center space-x-2">
              <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${activeCycleId ? 'text-[#2C7B64]' : 'text-[#5B5B6B]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs font-medium text-[#5B5B6B]">Ciclo</p>
                <p className={`text-lg sm:text-xl font-bold ${activeCycleId ? 'text-[#2C7B64]' : 'text-[#5B5B6B]'}`}>
                  {activeCycleId ? 'Activo' : 'Sin ciclo'}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-[#FAF9F6] border border-[#DAD5E4] p-3 rounded-xl">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#2C7B64]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13a4 4 0 014-4h10a4 4 0 110 8H7a4 4 0 01-4-4z" />
              </svg>
              <div className="flex-1">
                <p className="text-xs font-medium text-[#5B5B6B]">Participación</p>
                {activeCycleId ? (
                  <p className="text-lg sm:text-xl font-bold tabular-nums text-[#2E2E3A]">{participationPct}%</p>
                ) : (
                  <p className="text-lg sm:text-xl font-bold text-[#5B5B6B]">—</p>
                )}
              </div>
            </div>
            {activeCycleId && (
              <div className="mt-2">
                <div className="w-full h-1.5 sm:h-2 bg-[#DAD5E4]/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${participationPct}%`,
                      backgroundColor: participationPct >= 80 ? '#4AA690' : participationPct >= 50 ? '#55C2A2' : '#9D83C6'
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-[#5B5B6B] font-medium">{respondedCount} / {totalParticipantes}</p>
              </div>
            )}
          </div>
          <div className="bg-[#FAF9F6] border border-[#DAD5E4] p-3 rounded-xl">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#8160B6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .843-3 1.882v4.236C9 15.157 10.343 16 12 16s3-.843 3-1.882V9.882C15 8.843 13.657 8 12 8z" />
              </svg>
              <div className="flex-1">
                <p className="text-xs font-medium text-[#5B5B6B]">Bienestar</p>
                {activeCycleId ? (
                  <p className="text-lg sm:text-xl font-bold tabular-nums text-[#8160B6]">
                    {wellbeingMetric && wellbeingMetric.avg != null ? `${wellbeingMetric.avg}` : '—'}
                    <span className="text-xs font-medium text-[#5B5B6B] ml-1">/100</span>
                  </p>
                ) : (
                  <p className="text-lg sm:text-xl font-bold text-[#5B5B6B]">—</p>
                )}
              </div>
            </div>
            {activeCycleId && wellbeingMetric && wellbeingMetric.avg != null && (
              <div className="mt-2">
                <div className="w-full h-1.5 sm:h-2 bg-[#DAD5E4]/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${wellbeingMetric.avg}%`,
                      backgroundColor: '#9D83C6'
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-[#5B5B6B] font-medium">{wellbeingMetric.count} resp.</p>
              </div>
            )}
          </div>
        </div>

        {/* Código de invitación */}
        <div className="bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border border-[#55C2A2]/30 p-3 sm:p-4 rounded-xl mb-4">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-[#2E2E3A] font-medium flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-[#55C2A2] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span className="flex-1">Código de invitación</span>
                <button
                  onClick={() => setShowInvite(v => !v)}
                  className="text-xs px-2 py-0.5 rounded-lg border border-[#55C2A2]/50 text-[#2C7B64] hover:bg-[#55C2A2]/20 transition-all duration-200 flex-shrink-0"
                >{showInvite ? 'Ocultar' : 'Mostrar'}</button>
              </p>
              <p className="text-sm sm:text-lg font-mono font-bold text-[#2E2E3A] select-all break-all bg-[#FAF9F6] px-2 sm:px-3 py-2 rounded-lg border border-[#DAD5E4]">
                {team.team_invite_codes?.length > 0 ? (
                  showInvite ? team.team_invite_codes[0].code : '••••••••'
                ) : 'Sin código'}
              </p>
              {team.team_invite_codes?.length > 0 && team.team_invite_codes[0].expires_at && (
                new Date(team.team_invite_codes[0].expires_at) <= new Date() ? (
                  <span className="text-xs text-red-600 font-medium">Expirado — genera uno nuevo</span>
                ) : (
                  <span className="text-xs text-[#5B5B6B]">
                    Expira el {new Date(team.team_invite_codes[0].expires_at).toLocaleDateString()}
                  </span>
                )
              )}
              {copied && <span className="text-xs text-green-700 font-medium block">Copiado</span>}
            </div>
            <div className="flex flex-col gap-1.5 flex-shrink-0 mt-6 sm:mt-0">
              <button
                onClick={async () => {
                  if (team.team_invite_codes?.length > 0) {
                    try { await navigator.clipboard.writeText(team.team_invite_codes[0].code); setCopied(true); setTimeout(()=>setCopied(false), 2000);} catch(e){}
                  }
                }}
                className="bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#4AB393] hover:to-[#8B6FB8] text-white px-3 py-1.5 sm:py-1 rounded-lg text-xs sm:text-sm transition-all duration-300 ease-out transform hover:scale-105 shadow-md hover:shadow-lg"
              >
                Copiar
              </button>
              <button
                onClick={() => onRegenerateCode && onRegenerateCode(team.id)}
                className="border border-[#9D83C6]/50 text-[#8160B6] px-3 py-1.5 sm:py-1 rounded-lg text-xs sm:text-sm hover:bg-[#9D83C6]/10 transition-all duration-200"
              >
                Regenerar
              </button>
            </div>
          </div>
        </div>

        {/* Miembros expandidos */}
        {isExpanded && (
          <div className="border-t border-[#DAD5E4] pt-4">
            <h4 className="text-sm sm:text-base font-semibold text-[#2E2E3A] mb-3">Miembros del equipo</h4>
            {membersLoading ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="small" />
              </div>
            ) : allMembersForLeader?.length > 0 ? (
              <div className="space-y-2">
                {allMembersForLeader.map((member) => {
                  const hasResponded = !!(respondedMembers && respondedMembers.has(member.user_id));
                  const isLeaderMember = member.isLeader;
                  return (
                    <div key={member.user_id} className="flex items-center space-x-3 p-2 bg-[#FAF9F6] border border-[#DAD5E4] rounded-xl">
                      <div className={`w-8 h-8 ${isLeaderMember ? 'bg-gradient-to-r from-[#55C2A2] to-[#9D83C6]' : 'bg-[#DAD5E4]'} rounded-full flex items-center justify-center`}>
                        <span className={`text-sm font-medium ${isLeaderMember ? 'text-white' : 'text-[#2E2E3A]'}`}>
                          {member.profiles?.first_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#2E2E3A]">
                          {member.profiles?.first_name && member.profiles?.last_name
                            ? `${member.profiles.first_name} ${member.profiles.last_name}`
                            : 'Usuario sin nombre'
                          }
                        </p>
                        <p className="text-xs text-[#5B5B6B]">
                          {isLeaderMember ? 'Líder del equipo' : 'Miembro del equipo'}
                        </p>
                      </div>
                      {activeCycleId ? (
                        hasResponded ? (
                          <span className="bg-[#55C2A2]/15 text-[#2C7B64] text-xs font-medium px-2 py-1 rounded-full">Respondió</span>
                        ) : (
                          <span className="bg-[#9D83C6]/15 text-[#8160B6] text-xs font-medium px-2 py-1 rounded-full">Pendiente</span>
                        )
                      ) : (
                        <span className="bg-[#DAD5E4]/50 text-[#5B5B6B] text-xs font-medium px-2 py-1 rounded-full">Sin ciclo</span>
                      )}
                      {!isLeaderMember && (
                        <button
                          onClick={() => onKickMember && onKickMember(team.id, member.user_id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                          aria-label="Expulsar miembro"
                          title="Expulsar del equipo"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[#5B5B6B] italic">Sin miembros aún</p>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-4 border-t border-[#DAD5E4]">
          {activeCycleId ? (
            <button
              className="w-full sm:flex-1 bg-red-600 text-white py-2.5 sm:py-2 px-4 rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 text-sm"
              onClick={() => onEndCycle && onEndCycle(team.id)}
              disabled={ending}
            >
              {ending ? 'Terminando...' : 'Terminar ciclo'}
            </button>
          ) : (
            <button
              className="w-full sm:flex-1 bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#4AB393] hover:to-[#8B6FB8] disabled:from-[#55C2A2]/50 disabled:to-[#9D83C6]/50 text-white py-2.5 sm:py-2 px-4 rounded-xl font-medium transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none text-sm"
              onClick={() => onLaunch && onLaunch(team)}
              disabled={launching}
              aria-expanded={isLaunchingThisTeam}
            >
              {launching ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Lanzando...
                </span>
              ) : (
                'Lanzar MBI'
              )}
            </button>
          )}
          {activeCycleId && (
            <div className="hidden sm:block sm:flex-1">
              {participationPct === 100 ? (
                <div className="w-full flex items-center justify-center px-4 py-2 rounded-xl bg-[#55C2A2]/10 text-[#2C7B64] text-xs font-medium border border-[#55C2A2]/30">
                  Todos respondieron
                </div>
              ) : (
                <div className="w-full flex items-center justify-center px-4 py-2 rounded-xl bg-[#55C2A2]/10 text-[#2C7B64] text-xs font-medium border border-[#55C2A2]/30">
                  Ciclo activo
                </div>
              )}
            </div>
          )}
          <button
            className="w-full sm:flex-1 border border-[#DAD5E4] text-[#2E2E3A] py-2.5 sm:py-2 px-4 rounded-xl font-medium hover:bg-[#DAD5E4]/20 transition-colors text-sm"
            onClick={() => navigate(`/reportes?team=${team.id}`)}
          >
            Generar Reporte
          </button>
        </div>

        {/* Panel de lanzamiento de ciclo MBI en línea — reemplaza al LaunchMBIModal flotante */}
        {isLaunchingThisTeam && (
          <LaunchMBIPanel
            isOpen={isLaunchingThisTeam}
            context={launchContext}
            launching={launching}
            onClose={onCloseLaunchPanel}
            onConfirm={onConfirmLaunch}
          />
        )}
      </div>
    </div>
  );
}

// Tarjeta de equipo para usuarios miembros - Vista de participación
function UserTeamCard({ team, members, membersLoading, currentUserId, activeCycleId, respondedCycles, respondedMembers }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
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

  // Funciones para manejar las opciones del menú
  const handleUpdatePrivacy = async (privacySettings) => {
    try {
      setLoading(true);
      
      console.log('Actualizando preferencias individuales:', {
        team_id: team.id,
        user_id: currentUserId,
        share_results: privacySettings.share_results_with_leader
      });
      
      // Actualizar solo la preferencia individual del usuario
      const { error, data } = await supabase
        .from('team_members')
        .update({
          share_results_with_leader: privacySettings.share_results_with_leader
        })
        .eq('team_id', team.id)
        .eq('user_id', currentUserId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Update successful:', data);
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
    <div className="bg-[#FAF9F6] rounded-2xl shadow-teamzen border border-[#DAD5E4] hover:shadow-teamzen-strong hover:border-[#55C2A2] transition-all duration-300">
      <div className="p-6">
        {/* Header del equipo */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#55C2A2] to-[#9D83C6] rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">
                {team.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-[#2E2E3A]">{team.name}</h3>
              <p className="text-xs sm:text-sm text-[#5B5B6B]">
                Miembro desde que te uniste al equipo
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-[#55C2A2]/15 text-[#2C7B64] text-xs font-medium px-2.5 py-0.5 rounded-full">
              Miembro
            </span>

            {/* Menú de opciones */}
            <div className="relative options-menu">
              <button
                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                aria-label="Opciones del equipo"
                aria-expanded={showOptionsMenu}
                className="p-2 hover:bg-[#DAD5E4]/30 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-[#5B5B6B]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>

              {showOptionsMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-[#FAF9F6] rounded-xl shadow-teamzen-strong border border-[#DAD5E4] z-10">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowPrivacyModal(true);
                        setShowOptionsMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-[#2E2E3A] hover:bg-[#DAD5E4]/30"
                    >
                      <svg className="w-4 h-4 mr-3 text-[#5B5B6B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Configurar privacidad
                    </button>
                    <button
                      onClick={() => {
                        setShowLeaveModal(true);
                        setShowOptionsMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <svg className="w-4 h-4 mr-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Salir del equipo
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Ocultar miembros del equipo' : 'Mostrar miembros del equipo'}
              className="p-2 hover:bg-[#DAD5E4]/30 rounded-lg transition-colors"
            >
              <svg
                className={`w-5 h-5 text-[#5B5B6B] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Información del equipo */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
          <div className="bg-[#FAF9F6] border border-[#DAD5E4] p-3 rounded-xl">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#5B5B6B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <div>
                <p className="text-xs font-medium text-[#5B5B6B]">Miembros</p>
                <p className="text-lg sm:text-xl font-bold tabular-nums text-[#2E2E3A]">{totalParticipantes}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#FAF9F6] border border-[#DAD5E4] p-3 rounded-xl">
            <div className="flex items-center space-x-2">
              <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${activeCycleId ? 'text-[#2C7B64]' : 'text-[#5B5B6B]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs font-medium text-[#5B5B6B]">Ciclo</p>
                <p className={`text-lg sm:text-xl font-bold ${activeCycleId ? 'text-[#2C7B64]' : 'text-[#5B5B6B]'}`}>
                  {activeCycleId ? 'Activo' : 'Sin ciclo'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Estado de tu evaluación en el ciclo activo (derivado de datos reales, no un valor fijo) */}
        {activeCycleId && (
          <div className={`p-3 rounded-xl mb-4 ${respondedCycles[activeCycleId] ? 'bg-[#55C2A2]/10 border border-[#55C2A2]/30' : 'bg-[#9D83C6]/10 border border-[#9D83C6]/30'}`}>
            <div className="flex items-center space-x-2">
              <svg className={`w-5 h-5 flex-shrink-0 ${respondedCycles[activeCycleId] ? 'text-[#2C7B64]' : 'text-[#8160B6]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className={`text-sm font-medium ${respondedCycles[activeCycleId] ? 'text-[#2C7B64]' : 'text-[#8160B6]'}`}>
                  {respondedCycles[activeCycleId] ? 'Ya respondiste este ciclo' : 'Evaluación pendiente'}
                </p>
                {!respondedCycles[activeCycleId] && (
                  <p className="text-xs text-[#5B5B6B]">Responde el MBI antes de que cierre el ciclo</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Miembros expandidos */}
        {isExpanded && (
          <div className="border-t border-[#DAD5E4] pt-4">
            <h4 className="text-sm sm:text-base font-semibold text-[#2E2E3A] mb-3">Miembros del equipo</h4>
            {membersLoading ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="small" />
              </div>
            ) : visibleMembers?.length > 0 ? (
              <div className="space-y-2">
                {visibleMembers.map((member) => {
                  const hasResponded = !!(respondedMembers && respondedMembers.has(member.user_id));
                  const isCurrentUser = member.user_id === currentUserId;
                  const isLeader = member.is_leader || member.user_id === team.leader_id;
                  
                  return (
                    <div key={member.user_id} className="flex items-center space-x-3 p-2 bg-[#FAF9F6] border border-[#DAD5E4] rounded-xl">
                      <div className={`w-8 h-8 ${
                        isCurrentUser || isLeader ? 'bg-gradient-to-br from-[#55C2A2] to-[#9D83C6]' :
                        'bg-[#DAD5E4]'
                      } rounded-full flex items-center justify-center`}>
                        <span className={`text-sm font-medium ${
                          isCurrentUser || isLeader ? 'text-white' : 'text-[#2E2E3A]'
                        }`}>
                          {member.profiles?.first_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#2E2E3A]">
                          {member.profiles?.first_name && member.profiles?.last_name
                            ? `${member.profiles.first_name} ${member.profiles.last_name}`
                            : 'Usuario sin nombre'
                          }
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-[#2C7B64] font-semibold">(Tú)</span>
                          )}
                          {isLeader && (
                            <span className="ml-2 text-xs text-[#2C7B64] font-semibold">(Líder)</span>
                          )}
                        </p>
                        <p className="text-xs text-[#5B5B6B]">
                          {isCurrentUser ? 'Tu participación' :
                           isLeader ? 'Líder del equipo' :
                           'Miembro del equipo'}
                        </p>
                      </div>
                      {activeCycleId && canSeeResponses ? (
                        // Mostrar estado de respuesta solo si está permitido
                        hasResponded ? (
                          <span className="bg-[#55C2A2]/15 text-[#2C7B64] text-xs font-medium px-2 py-1 rounded-full">Respondió</span>
                        ) : (
                          <span className="bg-[#9D83C6]/15 text-[#8160B6] text-xs font-medium px-2 py-1 rounded-full">Pendiente</span>
                        )
                      ) : activeCycleId && !canSeeResponses && isCurrentUser ? (
                        // Para el usuario actual, siempre mostrar su estado
                        hasResponded ? (
                          <span className="bg-[#55C2A2]/15 text-[#2C7B64] text-xs font-medium px-2 py-1 rounded-full">Respondiste</span>
                        ) : (
                          <span className="bg-[#9D83C6]/15 text-[#8160B6] text-xs font-medium px-2 py-1 rounded-full">Pendiente</span>
                        )
                      ) : activeCycleId ? (
                        <span className="bg-[#DAD5E4]/50 text-[#5B5B6B] text-xs font-medium px-2 py-1 rounded-full">Privado</span>
                      ) : (
                        <span className="bg-[#DAD5E4]/50 text-[#5B5B6B] text-xs font-medium px-2 py-1 rounded-full">Sin ciclo</span>
                      )}
                    </div>
                  );
                })}
                {!canSeeOthers && visibleMembers.length === 1 && (
                  <div className="p-3 bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border border-[#55C2A2]/30 rounded-xl">
                    <p className="text-sm text-[#2E2E3A] flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#55C2A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Configuración de privacidad: Solo puedes verte a ti mismo
                    </p>
                  </div>
                )}
                {canSeeOthers && visibleMembers.filter(m => m.user_id !== currentUserId).length === 0 && (
                  <p className="text-sm text-[#5B5B6B] italic">Eres el único miembro del equipo</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#5B5B6B] italic">Sin otros miembros</p>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-4 border-t border-[#DAD5E4]">
          {!activeCycleId ? (
            <div className="w-full sm:flex-1 flex items-center justify-center px-4 py-2.5 sm:py-2 rounded-xl bg-[#DAD5E4]/30 text-[#5B5B6B] text-sm font-medium border border-[#DAD5E4]">Sin ciclo activo</div>
          ) : respondedCycles[activeCycleId] ? (
            <div className="w-full sm:flex-1 flex items-center justify-center px-4 py-2.5 sm:py-2 rounded-xl bg-[#55C2A2]/10 text-[#2C7B64] text-sm font-medium border border-[#55C2A2]/30">Respondido</div>
          ) : (
            <button
              className="w-full sm:flex-1 bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] hover:from-[#4AB393] hover:to-[#8B6FB8] text-white py-2.5 sm:py-2 px-4 rounded-xl font-medium transition-all duration-300 ease-out transform hover:scale-[1.02] hover:shadow-teamzen-glow text-sm"
              onClick={() => navigate(`/mbi?team=${team.id}`)}
            >
              Completar MBI
            </button>
          )}
          <button className="w-full sm:flex-1 border border-[#DAD5E4] text-[#2E2E3A] py-2.5 sm:py-2 px-4 rounded-xl font-medium hover:bg-[#DAD5E4]/20 transition-colors text-sm">
            Ver Historial
          </button>
        </div>
      </div>

      {/* Modal de configuración de privacidad */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto bg-[#9D83C6]/10 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-[#9D83C6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-[#2E2E3A] mb-2">Configuración de Privacidad</h2>
                <p className="text-sm text-[#5B5B6B]">
                  Configura qué información quieres compartir en el equipo "{team.name}"
                </p>
              </div>

              <PrivacySettingsForm
                currentSettings={currentMember}
                teamSettings={team}
                onSave={handleUpdatePrivacy}
                onCancel={() => setShowPrivacyModal(false)}
                loading={loading}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de salir del equipo */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-[#2E2E3A] mb-2">Salir del Equipo</h2>
                <p className="text-sm text-[#5B5B6B] mb-4">
                  ¿Estás seguro de que quieres salir del equipo "{team.name}"?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-red-800">
                    <strong>Advertencia:</strong> Al salir del equipo perderás acceso a todos los datos y evaluaciones. Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLeaveTeam}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? "Saliendo..." : "Salir del equipo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para configurar las preferencias de privacidad
function PrivacySettingsForm({ currentSettings, onSave, onCancel, loading, teamSettings }) {
  const [settings, setSettings] = useState({
    share_results_with_leader: currentSettings?.share_results_with_leader ?? false
  });

  const handleSave = () => {
    onSave(settings);
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <div className="flex gap-2">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs text-blue-800 font-medium">Configuración personal</p>
            <p className="text-xs text-blue-700 mt-1">
              Solo tú puedes decidir si compartir tus resultados individuales con el líder del equipo.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="border border-[#DAD5E4] rounded-lg p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="shareResults"
              checked={settings.share_results_with_leader}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                share_results_with_leader: e.target.checked
              }))}
              className="mt-1 w-4 h-4 text-[#9D83C6] border-gray-300 rounded focus:ring-[#9D83C6]"
            />
            <div className="flex-1">
              <label htmlFor="shareResults" className="text-sm font-medium text-[#2E2E3A] cursor-pointer">
                Compartir mis resultados de evaluación con el líder
              </label>
              <p className="text-xs text-[#5B5B6B] mt-1">
                Permite que el líder del equipo pueda ver tus resultados individuales de las evaluaciones MBI para brindar mejor apoyo personalizado
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Información sobre configuraciones del equipo (solo lectura) */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-medium text-gray-800 mb-3">Configuraciones del equipo (controladas por el líder):</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${teamSettings?.members_can_see_others ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-600">
              {teamSettings?.members_can_see_others ? 'Los miembros pueden ver a otros miembros' : 'Los miembros no pueden ver a otros miembros'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${teamSettings?.members_can_see_responses ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-600">
              {teamSettings?.members_can_see_responses ? 'El líder puede ver si los miembros han respondido' : 'El líder no puede ver si los miembros han respondido'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
        <div className="flex gap-2">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs text-green-800 font-medium">¿Por qué es importante?</p>
            <p className="text-xs text-green-700 mt-1">
              Compartir tus resultados permite al líder identificar mejor las necesidades del equipo y brindarte apoyo personalizado, pero siempre es tu decisión.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={loading}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-[#9D83C6] text-white rounded-lg hover:bg-[#8B6FB8] transition-colors disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Guardando..." : "Guardar preferencia"}
        </button>
      </div>
    </div>
  );
}
