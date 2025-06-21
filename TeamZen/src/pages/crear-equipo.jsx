import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from '../../supabaseClient';

export default function CrearEquipo() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [joinPolicy, setJoinPolicy] = useState("code");
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const generateCode = (length = 6) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInviteCode(null);

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profileError || profile?.role !== "leader") {
        throw new Error("No tienes permisos para crear un equipo.");
      }

      const { data: newTeam, error: teamError } = await supabase
        .from("teams")
        .insert([{ name: teamName, leader_id: userId, join_policy: joinPolicy }])
        .select()
        .single();

      if (teamError || !newTeam?.id) {
        throw new Error("Error al crear el equipo.");
      }

      const code = generateCode();
      const { error: codeError } = await supabase
        .from("team_invite_codes")
        .insert([{ code, team_id: newTeam.id }]);

      if (codeError) {
        throw new Error("Equipo creado, pero ocurrió un error al generar el código.");
      }

      setInviteCode(code);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF9F6] p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 border border-[#DAD5E4] w-full max-w-lg">
        <h1 className="text-2xl font-bold text-[#2E2E3A] mb-6">Crear nuevo equipo</h1>

        <form onSubmit={handleCreateTeam} className="flex flex-col gap-4">
          <input
            type="text"
            required
            placeholder="Nombre del equipo"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="border border-[#DAD5E4] rounded-lg px-4 py-2"
          />

          <label className="text-[#2E2E3A] font-semibold">¿Cómo se unirán los usuarios?</label>
          <select
            value={joinPolicy}
            onChange={(e) => setJoinPolicy(e.target.value)}
            className="border border-[#DAD5E4] rounded-lg px-4 py-2"
          >
            <option value="code">Con código (automático)</option>
            {/*<option value="request">Solicitud al líder</option> */}
          </select>

          <button
            type="submit"
            disabled={loading}
            className="bg-[#55C2A2] hover:bg-[#9D83C6] text-white font-semibold px-6 py-2 rounded-full transition-colors"
          >
            {loading ? "Creando..." : "Crear equipo"}
          </button>
        </form>

        {inviteCode && (
          <div className="mt-6 text-center text-[#2E2E3A] font-semibold">
            Código de invitación: <span className="text-[#9D83C6] font-mono">{inviteCode}</span>
          </div>
        )}

        {error && (
          <p className="mt-4 text-red-600 font-medium text-center">{error}</p>
        )}

        <button
          onClick={() => navigate("/LandingPageOficial/dashboard")}
          className="mt-6 text-[#9D83C6] underline"
        >
          Volver al dashboard
        </button>
      </div>
    </div>
  );
}
