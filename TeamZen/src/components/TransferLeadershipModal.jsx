import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Modal from './Modal';
import { Alert } from './UIComponents';

export default function TransferLeadershipModal({ isOpen, onClose, team, members, onTransferred }) {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTransfer = async () => {
    if (!selectedUserId || !team) return;

    if (!confirm("¿Seguro que quieres transferir el liderazgo? Pasarás a ser un miembro normal de este equipo.")) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: transferError } = await supabase.rpc("transfer_team_leadership", {
        p_team_id: team.id,
        p_new_leader_id: selectedUserId
      });

      if (transferError) throw transferError;

      onTransferred();
    } catch (err) {
      setError(err.message || "No se pudo transferir el liderazgo.");
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSelectedUserId(null);
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Transferir liderazgo"
      maxWidth="max-w-lg"
      preventCloseOnOutsideClick={loading}
    >
      <div className="space-y-4">
        <p className="text-sm text-[#5B5B6B]">
          Elige qué miembro será el nuevo líder de "{team?.name}". Tú pasarás a ser un miembro normal del equipo.
        </p>

        {!members || members.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Este equipo no tiene otros miembros todavía.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {members.map((member) => (
              <label
                key={member.user_id}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${
                  selectedUserId === member.user_id ? 'border-[#55C2A2] bg-[#55C2A2]/10' : 'border-[#DAD5E4]'
                }`}
              >
                <span className="text-sm font-medium text-[#2E2E3A]">
                  {member.profiles?.first_name && member.profiles?.last_name
                    ? `${member.profiles.first_name} ${member.profiles.last_name}`
                    : 'Usuario sin nombre'}
                </span>
                <input
                  type="radio"
                  name="newLeader"
                  checked={selectedUserId === member.user_id}
                  onChange={() => setSelectedUserId(member.user_id)}
                  disabled={loading}
                  className="w-4 h-4 text-[#55C2A2] focus:ring-[#55C2A2]"
                />
              </label>
            ))}
          </div>
        )}

        {error && (
          <Alert type="error" title="Error al transferir liderazgo">
            {error}
          </Alert>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleTransfer}
            disabled={loading || !selectedUserId}
            className="flex-1 bg-[#55C2A2] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#4AA690] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Transfiriendo..." : "Transferir liderazgo"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
