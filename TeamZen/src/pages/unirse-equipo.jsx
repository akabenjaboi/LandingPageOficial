import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function UnirseEquipo() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  // Obtener usuario autenticado
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
      else navigate("/LandingPageOficial/login");
    });
  }, [navigate]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      // 1. Buscar código
      const { data: invites, error: inviteError } = await supabase
        .from("team_invite_codes")
        .select("team_id")
        .eq("code", code.toUpperCase());

      if (inviteError || !invites || invites.length === 0) {
        throw new Error("Código inválido o no encontrado.");
      }

      const invite = invites[0];

      // 2. Verificar que el equipo permita unirse
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .select("join_policy")
        .eq("id", invite.team_id)
        .single();

      if (teamError || !team) {
        throw new Error("No se encontró el equipo.");
      }

      if (team.join_policy !== "code") {
        throw new Error("Este equipo no permite unirse directamente.");
      }

      // 3. Verificar si ya es miembro
      const { data: existing, error: existingError } = await supabase
        .from("team_members")
        .select("id")
        .eq("team_id", invite.team_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingError) {
        throw new Error("Error verificando membresía previa.");
      }

      if (existing) {
        throw new Error("Ya eres miembro de este equipo.");
      }

      // 4. Insertar en team_members
      const { error: insertError } = await supabase
        .from("team_members")
        .insert([{ team_id: invite.team_id, user_id: userId }]);
        console.log("Insertando en team_members:", {
          team_id: invite.team_id,
          user_id: userId,
        });


      if (insertError) {
        throw new Error("No se pudo unir al equipo.");
        
      }

      setSuccess("¡Te uniste al equipo correctamente!");
      setCode("");
    } catch (err) {
      console.error("Error al unirse al equipo:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF9F6] p-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 border border-[#DAD5E4] w-full max-w-md">
        <h1 className="text-2xl font-bold text-[#2E2E3A] mb-6">Unirse a un equipo</h1>
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <input
            type="text"
            required
            placeholder="Código de invitación"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="border border-[#DAD5E4] rounded-lg px-4 py-2 uppercase tracking-wider"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-[#55C2A2] hover:bg-[#9D83C6] text-white font-semibold px-6 py-2 rounded-full transition-colors"
          >
            {loading ? "Uniéndose..." : "Unirse al equipo"}
          </button>
        </form>

        {success && (
          <div className="mt-4 p-4 bg-[#F0FFF4] border border-[#C6F6D5] rounded-lg text-[#2F855A]">
            {success}
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-[#FFF5F5] border border-[#FED7D7] rounded-lg text-[#C53030]">
            {error}
          </div>
        )}

        <button
          onClick={() => navigate("/dashboard")}
          className="mt-6 text-[#9D83C6] underline"
        >
          Volver al dashboard
        </button>
      </div>
    </div>
  );
}
