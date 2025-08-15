// ===================================================================
// COMPONENTES UI REUTILIZABLES - DESIGN SYSTEM DE TEAMZEN
// ===================================================================
// Este archivo contiene todos los componentes base de la interfaz:
// - Card: Contenedores con bordes redondeados y sombras
// - Button: Botones con variantes y estados
// - Alert: Notificaciones y mensajes
// - Badge: Etiquetas informativas
// - Input: Campos de entrada
// - LoadingSpinner: Indicadores de carga
// ===================================================================

import React from 'react';

// ===================================================================
// COMPONENTE CARD - Contenedor base con estilo unificado
// ===================================================================
export function Card({ children, className = "", padding = "p-6" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-[#DAD5E4] ${padding} ${className}`}>
      {children}
    </div>
  );
}

// ===================================================================
// COMPONENTE BUTTON - Botón reutilizable con múltiples variantes
// ===================================================================
export function Button({ 
  children, 
  variant = "primary", 
  size = "default", 
  disabled = false, 
  loading = false,
  className = "",
  ...props 
}) {
  // Variantes de color y estilo
  const variants = {
    primary: "bg-[#55C2A2] hover:bg-[#9D83C6] text-[#2E2E3A]",
    secondary: "bg-[#DAD5E4] hover:bg-[#9D83C6] text-[#2E2E3A] hover:text-white",
    danger: "bg-red-500 hover:bg-red-600 text-white",
    outline: "border-2 border-[#55C2A2] text-[#55C2A2] hover:bg-[#55C2A2] hover:text-[#2E2E3A]",
    ghost: "text-[#9D83C6] hover:text-[#55C2A2] hover:bg-[#DAD5E4]/30"
  };

  // Tamaños disponibles
  const sizes = {
    small: "px-4 py-2 text-sm",
    default: "px-6 py-3 text-base",
    large: "px-8 py-4 text-lg"
  };

  return (
    <button
      className={`
        ${variants[variant]} 
        ${sizes[size]} 
        rounded-full font-semibold transition-all duration-300 
        flex items-center justify-center gap-2
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'hover:transform hover:scale-105'}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
      )}
      {children}
    </button>
  );
}

// ===================================================================
// COMPONENTE INPUT - Campo de entrada con label y validación
// ===================================================================
export function Input({ 
  label, 
  error, 
  className = "", 
  required = false,
  ...props 
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="font-semibold text-[#2E2E3A] text-sm">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        className={`
          w-full border rounded-lg px-4 py-3 transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-[#55C2A2] focus:border-transparent
          ${error ? 'border-red-500' : 'border-[#DAD5E4]'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <span className="text-red-500 text-sm font-medium">{error}</span>
      )}
    </div>
  );
}

// ===================================================================
// COMPONENTE ALERT - Notificaciones con diferentes tipos
// ===================================================================
export function Alert({ type = "info", title, children, className = "" }) {
  // Estilos por tipo de alerta
  const types = {
    success: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-800",
      icon: "✓"
    },
    error: {
      bg: "bg-red-50", 
      border: "border-red-200",
      text: "text-red-800",
      icon: "✕"
    },
    warning: {
      bg: "bg-yellow-50",
      border: "border-yellow-200", 
      text: "text-yellow-800",
      icon: "⚠"
    },
    info: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-800", 
      icon: "ℹ"
    }
  };

  const typeStyles = types[type];

  return (
    <div className={`
      ${typeStyles.bg} ${typeStyles.border} ${typeStyles.text}
      border rounded-lg p-4 ${className}
    `}>
      <div className="flex items-start gap-3">
        <span className="text-lg font-bold">{typeStyles.icon}</span>
        <div className="flex-1">
          {title && <h4 className="font-semibold mb-1">{title}</h4>}
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// COMPONENTE BADGE - Etiquetas informativas con colores
// ===================================================================
export function Badge({ children, variant = "default", className = "" }) {
  // Variantes de color para badges
  const variants = {
    default: "bg-[#DAD5E4] text-[#2E2E3A]",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800"
  };

  return (
    <span className={`
      ${variants[variant]} 
      px-3 py-1 rounded-full text-sm font-medium
      ${className}
    `}>
      {children}
    </span>
  );
}
