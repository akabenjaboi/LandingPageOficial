import React from 'react';

// Reusable modal for launching / creating a new MBI cycle.
// Props:
//  open: boolean
//  context: { teamId, teamName, activeCycleId, pendingMembers:[], totalMembers }
//  launching: boolean
//  onClose: fn()
//  onConfirm: fn(teamId)
export default function LaunchMBIModal({ open, context, launching, onClose, onConfirm }) {
  if (!open || !context) return null;
  const { teamId, teamName, activeCycleId, pendingMembers = [], totalMembers = 0 } = context;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {activeCycleId ? 'Iniciar nuevo ciclo MBI' : 'Lanzar MBI'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cerrar modal"
            disabled={launching}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Equipo: <span className="font-medium text-gray-900">{teamName}</span>
        </p>
        {activeCycleId && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-700">
            Ya existe un ciclo activo. Crear uno nuevo cerrará el ciclo actual y permitirá que todos respondan nuevamente.
          </div>
        )}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-800 flex items-center gap-2">
            Participación actual
          </h4>
          {totalMembers === 0 ? (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-700">
                ⚠️ Este equipo no tiene miembros aún. Puedes lanzar el MBI de todas formas, pero recuerda invitar miembros para que participen.
              </p>
            </div>
          ) : pendingMembers.length === 0 ? (
            <p className="text-xs text-green-600 mt-1">Todos los miembros han respondido el ciclo actual.</p>
          ) : (
            <div className="mt-2 max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
              <p className="text-xs text-gray-600 mb-1">Miembros que aún no han respondido ({pendingMembers.length} / {totalMembers}):</p>
              <ul className="space-y-1">
                {pendingMembers.map(m => (
                  <li key={m.user_id} className="text-xs text-gray-700 flex items-center gap-2">
                    <span className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center text-[10px] font-medium">
                      {m.profiles?.first_name?.charAt(0) || 'U'}
                    </span>
                    <span>{m.profiles?.first_name && m.profiles?.last_name ? `${m.profiles.first_name} ${m.profiles.last_name}` : 'Usuario sin nombre'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
            disabled={launching}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(teamId)}
            disabled={launching}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {launching ? 'Lanzando...' : (activeCycleId ? 'Crear nuevo ciclo' : 'Lanzar ahora')}
          </button>
        </div>
      </div>
    </div>
  );
}
