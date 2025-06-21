import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profile, setProfile] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState({});
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user;
      if (!currentUser) return navigate("/LandingPageOficial/login");
      setUser(currentUser);

      // Cargar perfil
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setFirstName(profileData.first_name || "");
        setLastName(profileData.last_name || "");
        setRole(profileData.role || "");

        // Si es líder, cargar equipos creados, códigos y miembros
        if (profileData.role === "leader") {
          setTeamsLoading(true);
          const { data: teamsData } = await supabase
            .from("teams")
            .select("*, team_invite_codes(code)")
            .eq("leader_id", currentUser.id);
          setTeams(teamsData || []);
          setTeamsLoading(false);

          // Cargar miembros de cada equipo
          if (teamsData && teamsData.length > 0) {
            setMembersLoading(true);
            const membersObj = {};
            for (const team of teamsData) {
              const { data: team_members, error } = await supabase
                .from("team_members")
                .select("user_id, profiles(first_name, last_name)")
                .eq("team_id", team.id);

              if (error) {
                console.error(`Error cargando miembros para equipo ${team.id}:`, error);
              }
              membersObj[team.id] = team_members || [];
            }
            setTeamMembers(membersObj);
            setMembersLoading(false);
          }
        }

        // Si es usuario, cargar el equipo al que pertenece y sus miembros
        if (profileData.role === "user") {
          // Buscar el team_membership del usuario
          const { data: membership } = await supabase
            .from("team_members")
            .select("team_id")
            .eq("user_id", currentUser.id)
            .single();

          if (membership?.team_id) {
            // Cargar info del equipo
            const { data: teamData } = await supabase
              .from("teams")
              .select("*")
              .eq("id", membership.team_id)
              .single();
            setTeams(teamData ? [teamData] : []);

            // Cargar miembros del equipo
            setMembersLoading(true);
            const { data: team_members, error } = await supabase
              .from("team_members")
              .select("user_id, profiles(first_name, last_name)")
              .eq("team_id", membership.team_id);

            if (error) {
              console.error(`Error cargando miembros para equipo ${membership.team_id}:`, error);
            }
            setTeamMembers({ [membership.team_id]: team_members || [] });
            setMembersLoading(false);
          } else {
            setTeams([]);
          }
        }
      }
      setLoading(false);
    };
    init();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/LandingPageOficial/login");
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setProfileMsg("");

    // Verifica si el perfil existe
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    let error;
    if (existingProfile) {
      // Si existe, actualiza
      ({ error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          role: role,
        })
        .eq("id", user.id));
    } else {
      // Si no existe, inserta
      ({ error } = await supabase
        .from("profiles")
        .insert([
          {
            id: user.id,
            first_name: firstName,
            last_name: lastName,
            role: role,
          },
        ]));
    }

    setSaving(false);
    if (error) {
      setProfileMsg("Error al actualizar/crear perfil.");
    } else {
      setProfileMsg("Perfil actualizado correctamente.");
      setShowProfileForm(false);
      setProfile({ ...profile, first_name: firstName, last_name: lastName, role });
    }
  };

  if (loading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#FAF9F6]">
      <div className="bg-white rounded-2xl shadow-lg p-10 border border-[#DAD5E4] w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4 text-[#2E2E3A]">
          ¡Bienvenido!
        </h1>
        <p className="text-lg text-[#2E2E3A] mb-8">
          Has iniciado sesión como{" "}
          <span className="font-semibold">{user?.email}</span>
        </p>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-full font-semibold transition-colors mb-4"
        >
          Cerrar sesión
        </button>
        <button
          onClick={() => setShowProfileForm((v) => !v)}
          className="bg-[#55C2A2] hover:bg-[#9D83C6] text-white px-6 py-2 rounded-full font-semibold transition-colors"
        >
          {!profile?.first_name && !profile?.last_name
            ? "Completar perfil"
            : showProfileForm
            ? "Cancelar"
            : "Actualizar perfil"}
        </button>

        {/* Mostrar botón para crear equipo solo si el rol es 'leader' */}
        {profile?.role === "leader" && (
          <>
            <button
              onClick={() => navigate("/LandingPageOficial/crear-equipo")}
              className="mt-4 bg-[#2E2E3A] hover:bg-[#55C2A2] text-white px-6 py-2 rounded-full font-semibold transition-colors"
            >
              Crear equipo
            </button>
            <div className="mt-8 text-left">
              <h2 className="text-xl font-bold mb-2 text-[#2E2E3A]">Tus equipos creados</h2>
              {teamsLoading ? (
                <div className="text-[#2E2E3A]">Cargando equipos...</div>
              ) : teams.length === 0 ? (
                <div className="text-[#2E2E3A]">No has creado equipos aún.</div>
              ) : (
                <ul className="space-y-6">
                  {teams.map((team) => (
                    <li
                      key={team.id}
                      className="bg-[#F3F0F9] border border-[#DAD5E4] rounded-lg px-4 py-2"
                    >
                      <div className="font-semibold">{team.name}</div>
                      {/* Mostrar código de invitación */}
                      {team.team_invite_codes?.length > 0 && (
                        <div className="text-sm text-[#2E2E3A] mt-1">
                          <span className="font-bold">Código de invitación:</span>{" "}
                          <span className="bg-[#E0E7FF] px-2 py-1 rounded font-mono">
                            {team.team_invite_codes[0].code}
                          </span>
                        </div>
                      )}
                      <div className="mt-2">
                        <span className="font-bold text-[#2E2E3A]">Miembros:</span>
                        {membersLoading ? (
                          <div className="text-[#2E2E3A]">Cargando miembros...</div>
                        ) : (
                          <ul className="ml-4 mt-1 list-disc">
                            {(teamMembers[team.id] || []).length === 0 ? (
                              <li className="text-[#9D83C6] text-sm">No hay miembros en este equipo.</li>
                            ) : (
                              teamMembers[team.id].map((member) => (
                                <li key={member.user_id} className="text-[#1F1F1F]">
                                  {member.profiles?.first_name} {member.profiles?.last_name}
                                </li>
                              ))
                            )}
                          </ul>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {profile?.role === "user" && teams.length > 0 && (
          <div className="mt-8 text-left w-full">
            <h2 className="text-xl font-bold mb-2 text-[#2E2E3A]">Tu equipo</h2>
            <div className="bg-[#F3F0F9] border border-[#DAD5E4] rounded-lg px-4 py-2">
              <div className="font-semibold">{teams[0].name}</div>
              <div className="mt-2">
                <span className="font-bold text-[#2E2E3A]">Miembros:</span>
                {membersLoading ? (
                  <div className="text-[#2E2E3A]">Cargando miembros...</div>
                ) : (
                  <ul className="ml-4 mt-1 list-disc">
                    {(teamMembers[teams[0].id] || []).length === 0 ? (
                      <li className="text-[#9D83C6] text-sm">No hay miembros en este equipo.</li>
                    ) : (
                      teamMembers[teams[0].id].map((member) => (
                        <li key={member.user_id} className="text-[#1F1F1F]">
                          {member.profiles?.first_name} {member.profiles?.last_name}
                          {member.user_id === user?.id && (
                            <span className="ml-2 text-[#55C2A2] font-semibold">(tú)</span>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {showProfileForm && (
          <form
            onSubmit={handleProfileUpdate}
            className="mt-6 flex flex-col gap-4 text-left"
          >
            <label className="font-semibold text-[#2E2E3A]">
              Nombre
              <input
                type="text"
                className="w-full border border-[#DAD5E4] rounded-lg px-3 py-2 mt-1"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </label>
            <label className="font-semibold text-[#2E2E3A]">
              Apellido
              <input
                type="text"
                className="w-full border border-[#DAD5E4] rounded-lg px-3 py-2 mt-1"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </label>
            {/* Solo mostrar la selección de rol si el usuario NO tiene perfil */}
            {!profile?.first_name && !profile?.last_name && (
              <label className="font-semibold text-[#2E2E3A]">
                Rol
                <select
                  className="w-full border border-[#DAD5E4] rounded-lg px-3 py-2 mt-1"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                >
                  <option value="">Selecciona un rol</option>
                  <option value="user">Usuario</option>
                  <option value="leader">Líder</option>
                </select>
              </label>
            )}
            <button
              type="submit"
              disabled={saving}
              className="bg-[#55C2A2] hover:bg-[#9D83C6] text-white px-6 py-2 rounded-full font-semibold transition-colors"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            {profileMsg && (
              <div className="text-center text-sm mt-2 text-[#2E2E3A]">{profileMsg}</div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
