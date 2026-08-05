// ===================================================================
// PANEL DE CREACIÓN DE EQUIPO (en línea, no modal)
// ===================================================================
// Convertido desde CreateTeamModal.jsx: crear un equipo es un flujo de
// configuración rutinario, no una decisión destructiva/confirmatoria,
// así que se expande dentro de la página en vez de interrumpir con un
// overlay. Misma lógica de Supabase, mismo lenguaje visual (rounded-2xl,
// shadow-teamzen, cream/lavender), distinto contenedor.
// ===================================================================
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import InlinePanel from './InlinePanel';
import { Input, Alert } from './UIComponents';

export default function CreateTeamPanel({ isOpen, onClose, onTeamCreated }) {
  const descriptionId = React.useId();
  const [userId, setUserId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [includeLeader, setIncludeLeader] = useState(true);
  const [membersCanSeeOthers, setMembersCanSeeOthers] = useState(true);
  const [membersCanSeeResponses, setMembersCanSeeResponses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);

  useEffect(() => {
    if (isOpen) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setUserId(user.id);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTeamName("");
      setDescription("");
      setIncludeLeader(true);
      setMembersCanSeeOthers(true);
      setMembersCanSeeResponses(true);
      setLoading(false);
      setError(null);
      setSuccess(false);
      setInviteCode(null);
    }
  }, [isOpen]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
        .insert([{
          name: teamName,
          description: description,
          leader_id: userId,
          join_policy: "code",
          include_leader_in_metrics: includeLeader,
          members_can_see_others: membersCanSeeOthers,
          members_can_see_responses: membersCanSeeResponses
        }])
        .select()
        .single();

      if (teamError || !newTeam?.id) {
        throw new Error("Error al crear el equipo.");
      }

      const { data: codeResult, error: codeError } = await supabase
        .rpc("regenerate_team_invite_code", { p_team_id: newTeam.id })
        .single();

      if (codeError || !codeResult?.code) {
        throw new Error("Equipo creado, pero ocurrió un error al generar el código.");
      }

      setInviteCode(codeResult.code);
      setSuccess(true);

      if (onTeamCreated) {
        onTeamCreated(newTeam, codeResult.code);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) onClose();
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
    } catch (err) {
      console.error('Error copiando al portapapeles:', err);
    }
  };

  return (
    <InlinePanel
      isOpen={isOpen}
      onClose={loading ? undefined : handleClose}
      title={success ? "¡Equipo creado!" : "Crear un nuevo equipo"}
      description={success ? undefined : "Un espacio colaborativo para monitorear el bienestar de tu equipo"}
      tone="mint"
    >
      {!success ? (
        <form onSubmit={handleCreateTeam} className="space-y-5">
          <Input
            label="Nombre del equipo"
            type="text"
            required
            placeholder="Ej: Equipo de Desarrollo, Marketing Team..."
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            disabled={loading}
          />

          <div className="space-y-2">
            <label htmlFor={descriptionId} className="font-semibold text-[#2E2E3A] text-sm">
              Descripción del equipo
            </label>
            <textarea
              id={descriptionId}
              placeholder="Describe brevemente el área, departamento o función del equipo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#DAD5E4] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#55C2A2] focus:border-transparent focus:bg-white focus:shadow-lg resize-none disabled:opacity-50 text-[#2E2E3A] placeholder-[#5B5B6B]"
              rows={3}
              maxLength={200}
            />
            <p className="text-xs text-[#5B5B6B]">
              {description.length}/200 caracteres — esta información ayuda a la IA a generar análisis más precisos
            </p>
          </div>

          <div className="space-y-2">
            <label className="font-semibold text-[#2E2E3A] text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeLeader}
                onChange={(e) => setIncludeLeader(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 text-[#55C2A2] focus:ring-[#55C2A2] rounded"
              />
              Incluir al líder en métricas (participación y bienestar)
            </label>
            <p className="text-xs text-[#5B5B6B] ml-6">
              Si lo desmarcas, las métricas excluirán las respuestas del líder para evitar sesgos.
            </p>
          </div>

          <div className="border border-[#DAD5E4] rounded-xl p-4 bg-[#FAF9F6] space-y-3">
            <h4 className="font-semibold text-[#2E2E3A] text-sm">Configuración de privacidad</h4>

            <div className="space-y-2">
              <label className="font-medium text-[#2E2E3A] text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={membersCanSeeOthers}
                  onChange={(e) => setMembersCanSeeOthers(e.target.checked)}
                  disabled={loading}
                  className="w-4 h-4 text-[#55C2A2] focus:ring-[#55C2A2] rounded"
                />
                Los miembros pueden ver a otros integrantes
              </label>
              <p className="text-xs text-[#5B5B6B] ml-6">
                Si lo desmarcas, cada miembro solo podrá verse a sí mismo en el equipo.
              </p>
            </div>

            <div className="space-y-2">
              <label className="font-medium text-[#2E2E3A] text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={membersCanSeeResponses}
                  onChange={(e) => setMembersCanSeeResponses(e.target.checked)}
                  disabled={loading}
                  className="w-4 h-4 text-[#55C2A2] focus:ring-[#55C2A2] rounded"
                />
                Los miembros pueden ver si otros ya respondieron
              </label>
              <p className="text-xs text-[#5B5B6B] ml-6">
                Si lo desmarcas, cada miembro solo verá su propio estado de respuesta.
              </p>
            </div>
          </div>

          <p className="text-xs text-[#5B5B6B]">
            Los miembros se unirán con un código de invitación que se genera automáticamente al crear el equipo.
          </p>

          {error && (
            <Alert type="error" title="Error al crear equipo">
              {error}
            </Alert>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-[#5B5B6B] hover:text-[#2E2E3A] hover:bg-[#DAD5E4]/30 disabled:opacity-50 rounded-xl transition-all duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !teamName.trim()}
              className="flex-1 bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] text-white px-6 py-2 rounded-xl font-medium hover:from-[#4AA690] hover:to-[#8B6FB8] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Creando equipo...
                </span>
              ) : "Crear equipo"}
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center space-y-5">
          <div>
            <h4 className="text-lg font-bold text-[#2E2E3A] mb-1">¡Equipo "{teamName}" creado!</h4>
            <p className="text-sm text-[#5B5B6B]">Tu equipo ha sido creado exitosamente</p>
          </div>

          <div className="bg-gradient-to-r from-[#55C2A2]/10 to-[#9D83C6]/10 border border-[#55C2A2]/30 rounded-xl p-5">
            <h4 className="font-semibold text-[#2E2E3A] mb-3 text-sm">Código de invitación</h4>
            <div className="bg-white border-2 border-dashed border-[#55C2A2] rounded-xl p-4 mb-3">
              <div className="text-xl sm:text-2xl font-bold text-[#2E2E3A] font-mono tracking-wider text-center tabular-nums">
                {inviteCode}
              </div>
            </div>
            <p className="text-xs sm:text-sm text-[#5B5B6B] text-center">
              Comparte este código con los miembros de tu equipo para que puedan unirse
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              onClick={copyToClipboard}
              className="flex-1 border-2 border-[#55C2A2] text-[#2C7B64] px-4 py-2 rounded-xl font-medium hover:bg-[#55C2A2] hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copiar código
            </button>
            <button
              onClick={handleClose}
              className="flex-1 bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] text-white px-4 py-2 rounded-xl font-medium hover:from-[#4AA690] hover:to-[#8B6FB8] transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Continuar
            </button>
          </div>
        </div>
      )}
    </InlinePanel>
  );
}
