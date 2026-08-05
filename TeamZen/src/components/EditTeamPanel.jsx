// ===================================================================
// PANEL DE EDICIÓN DE EQUIPO (en línea, no modal)
// ===================================================================
// Convertido desde EditTeamModal.jsx: editar la configuración de un
// equipo ya existente es un flujo rutinario, no una decisión
// destructiva — se expande dentro de la propia tarjeta del equipo en
// vez de flotar por encima de la página.
// ===================================================================
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import InlinePanel from './InlinePanel';
import { Input, Alert } from './UIComponents';

export default function EditTeamPanel({ isOpen, onClose, team, onTeamUpdated }) {
  const descriptionId = React.useId();
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [includeLeader, setIncludeLeader] = useState(true);
  const [membersCanSeeOthers, setMembersCanSeeOthers] = useState(true);
  const [membersCanSeeResponses, setMembersCanSeeResponses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && team) {
      setTeamName(team.name || "");
      setDescription(team.description || "");
      setIncludeLeader(team.include_leader_in_metrics ?? true);
      setMembersCanSeeOthers(team.members_can_see_others ?? true);
      setMembersCanSeeResponses(team.members_can_see_responses ?? true);
      setError(null);
    }
  }, [isOpen, team]);

  const handleUpdateTeam = async (e) => {
    e.preventDefault();
    if (!team) return;

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("teams")
        .update({
          name: teamName,
          description: description,
          include_leader_in_metrics: includeLeader,
          members_can_see_others: membersCanSeeOthers,
          members_can_see_responses: membersCanSeeResponses,
          updated_at: new Date().toISOString()
        })
        .eq("id", team.id);

      if (updateError) {
        throw new Error("Error al actualizar el equipo.");
      }

      if (onTeamUpdated) {
        onTeamUpdated({
          ...team,
          name: teamName,
          description: description,
          include_leader_in_metrics: includeLeader,
          members_can_see_others: membersCanSeeOthers,
          members_can_see_responses: membersCanSeeResponses
        });
      }

      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) onClose();
  };

  return (
    <InlinePanel
      isOpen={isOpen}
      onClose={loading ? undefined : handleClose}
      title="Editar equipo"
      description="Actualiza la información y privacidad de tu equipo"
      tone="purple"
    >
      <form onSubmit={handleUpdateTeam} className="space-y-5">
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
            Cambiar esta configuración afecta los cálculos de métricas futuras y reportes.
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

        {error && (
          <Alert type="error" title="Error al actualizar equipo">
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
            {loading ? "Actualizando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </InlinePanel>
  );
}
