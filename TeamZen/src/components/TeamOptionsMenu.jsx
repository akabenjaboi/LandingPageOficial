import { useState, useRef, useEffect } from 'react';

export default function TeamOptionsMenu({ team, onEdit, onDelete, onTransferLeadership }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleEdit = () => {
    setIsOpen(false);
    onEdit(team);
  };

  const handleDelete = () => {
    setIsOpen(false);
    if (window.confirm(`¿Estás seguro de que quieres eliminar el equipo "${team.name}"?\n\nEsta acción no se puede deshacer y se eliminarán todos los datos asociados.`)) {
      onDelete(team.id);
    }
  };

  const handleTransfer = () => {
    setIsOpen(false);
    onTransferLeadership(team);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-xl border border-[#DAD5E4] bg-[#FAF9F6] p-2 text-[#5B5B6B] transition-colors hover:border-[#9D83C6] hover:text-[#2E2E3A]"
        aria-label="Opciones del equipo"
        aria-expanded={isOpen}
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-10 flex w-52 flex-col gap-1 rounded-2xl border border-[#DAD5E4] bg-white p-2 shadow-teamzen-strong">
          <button
            type="button"
            onClick={handleEdit}
            className="rounded-xl px-3 py-2 text-left font-['Poppins',_Arial,_sans-serif] text-sm font-medium text-[#2E2E3A] transition-colors hover:bg-[#DAD5E4]/40"
          >
            Editar equipo
          </button>
          <button
            type="button"
            onClick={handleTransfer}
            className="rounded-xl px-3 py-2 text-left font-['Poppins',_Arial,_sans-serif] text-sm font-medium text-[#2E2E3A] transition-colors hover:bg-[#DAD5E4]/40"
          >
            Transferir liderazgo
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-xl px-3 py-2 text-left font-['Poppins',_Arial,_sans-serif] text-sm font-medium text-[#c0392b] transition-colors hover:bg-[rgba(192,57,43,.08)]"
          >
            Eliminar equipo
          </button>
        </div>
      )}
    </div>
  );
}
