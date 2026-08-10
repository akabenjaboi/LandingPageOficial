import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import Modal from './Modal';
import { Alert, Btn } from './app-ui';

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
    <Modal isOpen={isOpen} onClose={handleClose} title="Transferir liderazgo" maxWidth="max-w-lg" preventCloseOnOutsideClick={loading}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[#5B5B6B]">
          Elige qué miembro será el nuevo líder de "{team?.name}". Tú pasarás a ser un miembro normal del equipo.
        </p>

        {!members || members.length === 0 ? (
          <p className="text-sm italic text-[#5B5B6B]">Este equipo no tiene otros miembros todavía.</p>
        ) : (
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {members.map((member) => (
              <label
                key={member.user_id}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors ${
                  selectedUserId === member.user_id ? 'border-[#55C2A2] bg-[rgba(85,194,162,.1)]' : 'border-[#DAD5E4] hover:border-[#9D83C6]'
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
                  className="h-4 w-4 accent-[#55C2A2]"
                />
              </label>
            ))}
          </div>
        )}

        {error && <Alert title="Error al transferir liderazgo">{error}</Alert>}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
          <Btn type="button" variant="ghost" onClick={handleClose} disabled={loading} className="flex-1 justify-center">
            Cancelar
          </Btn>
          <Btn type="button" onClick={handleTransfer} disabled={loading || !selectedUserId} className="flex-1 justify-center">
            {loading ? "Transfiriendo..." : "Transferir liderazgo"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
