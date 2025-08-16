// ===================================================================
// COMPONENTE MODAL - Modal reutilizable con overlay y gestión de estado
// ===================================================================
// Modal base que maneja:
// - Overlay con fondo transparente y animaciones
// - Cierre con ESC o click fuera
// - Prevención de scroll del body
// - Animaciones de entrada/salida fluidas
// - Accesibilidad (ARIA)
// - Paleta de colores TeamZen
// ===================================================================

import React, { useEffect, useState } from 'react';

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = "max-w-lg",
  preventCloseOnOutsideClick = false 
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // ===================================================================
  // GESTIÓN DE EVENTOS Y ACCESIBILIDAD
  // ===================================================================
  
  // Gestionar animaciones de apertura/cierre
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setTimeout(() => setIsAnimating(true), 10);
      document.body.style.overflow = 'hidden';
    } else {
      setIsAnimating(false);
      setTimeout(() => setIsVisible(false), 200);
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Cerrar modal con ESC
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // No renderizar si el modal está cerrado
  if (!isVisible) return null;

  // ===================================================================
  // HANDLERS DE INTERACCIÓN
  // ===================================================================
  
  const handleBackdropClick = (e) => {
    // Cerrar solo si se hace click en el backdrop (no en el contenido)
    if (e.target === e.currentTarget && !preventCloseOnOutsideClick) {
      onClose();
    }
  };

  // ===================================================================
  // RENDERIZADO DEL MODAL
  // ===================================================================
  
  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ease-out
        ${isAnimating ? 'backdrop-blur-sm bg-white/10' : 'backdrop-blur-none bg-white/0'}`}
      role="dialog" 
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div className={`bg-[#FAF9F6] border border-[#DAD5E4] rounded-xl shadow-2xl ${maxWidth} w-full max-h-[90vh] overflow-y-auto transition-all duration-300 ease-out
        ${isAnimating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}>
        {/* Header del modal */}
        <div className="flex items-start justify-between p-6 border-b border-[#DAD5E4]">
          <h3 className="text-lg font-semibold text-[#2E2E3A]">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-[#5B5B6B] hover:text-[#2E2E3A] transition-colors duration-200 p-1 rounded-lg hover:bg-[#DAD5E4]/30"
            aria-label="Cerrar modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido del modal */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
