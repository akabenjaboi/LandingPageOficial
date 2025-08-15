import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import Modal from './Modal';
import { Input, Alert } from './UIComponents';

export default function EditTeamModal({ isOpen, onClose, team, onTeamUpdated }) {
  const [teamName, setTeamName] = useState("");
  const [description, setDescription] = useState("");
  const [includeLeader, setIncludeLeader] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar datos del equipo cuando se abre el modal
  useEffect(() => {
    if (isOpen && team) {
      setTeamName(team.name || "");
      setDescription(team.description || "");
      setIncludeLeader(team.include_leader_in_metrics ?? true);
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
          updated_at: new Date().toISOString()
        })
        .eq("id", team.id);

      if (updateError) {
        throw new Error("Error al actualizar el equipo.");
      }

      // Notificar al componente padre que se actualizó el equipo
      if (onTeamUpdated) {
        onTeamUpdated({
          ...team,
          name: teamName,
          description: description,
          include_leader_in_metrics: includeLeader
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
    if (!loading) {
      onClose();
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="Editar Equipo"
      maxWidth="max-w-xl"
      preventCloseOnOutsideClick={loading}
    >
      <form onSubmit={handleUpdateTeam} className="space-y-6">
        <div className="text-center mb-6">
          <img 
            src={`${import.meta.env.BASE_URL}/img/pandapintando.png`} 
            alt="Panda editando" 
            className="w-20 h-20 mx-auto mb-4"
          />
          <p className="text-[#5B5B6B]">
            Actualiza la información de tu equipo
          </p>
        </div>

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
          <label className="font-semibold text-[#2E2E3A] text-sm">
            Descripción del equipo
          </label>
          <textarea
            placeholder="Describe brevemente el área, departamento o función del equipo..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-3 border border-[#DAD5E4] rounded-lg focus:ring-2 focus:ring-[#55C2A2] focus:border-[#55C2A2] resize-none disabled:opacity-50"
            rows={3}
            maxLength={200}
          />
          <p className="text-xs text-[#5B5B6B]">
            {description.length}/200 caracteres - Esta información ayuda a la IA a generar análisis más precisos
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
          <div className="ml-6 mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
            ⚠️ Cambiar esta configuración afectará los cálculos de métricas futuras y reportes.
          </div>
        </div>

        {error && (
          <Alert type="error" title="Error al actualizar equipo">
            {error}
          </Alert>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !teamName.trim()}
            className="flex-1 bg-[#55C2A2] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#4AA690] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Actualizando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
