import React from 'react';

export default function LoadingSpinner({ size = "default", message = "Cargando..." }) {
  const sizeClasses = {
    small: "w-4 h-4",
    default: "w-8 h-8", 
    large: "w-12 h-12"
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className={`${sizeClasses[size]} animate-spin`}>
        <div className="w-full h-full border-4 border-[#DAD5E4] border-t-[#55C2A2] rounded-full"></div>
      </div>
      <p className="mt-3 text-[#2E2E3A] font-medium">{message}</p>
    </div>
  );
}
