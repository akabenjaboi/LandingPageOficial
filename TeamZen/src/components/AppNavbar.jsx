import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function AppNavbar({ user, profile, onProfileEdit, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Cerrar menú de perfil al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileMenu && !event.target.closest('.profile-menu-container')) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  return (
    <nav className="bg-[#FAF9F6] border-b border-[#DAD5E4] sticky top-0 z-40 
                    backdrop-blur-md bg-[#FAF9F6]/95 shadow-teamzen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo y marca */}
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0 flex items-center group cursor-pointer" 
                 onClick={() => navigate('/dashboard')}>
              <img 
                className="h-8 w-auto transition-transform duration-300 group-hover:scale-110" 
                src="/img/pandalogo.png" 
                alt="TeamZen" 
              />
              <span className="ml-3 text-xl font-bold text-[#2E2E3A] group-hover:text-gradient 
                               transition-all duration-300">
                TeamZen
              </span>
            </div>
            
            {/* Enlaces de navegación */}
            <div className="hidden md:flex items-center space-x-1 ml-8">
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  location.pathname === '/dashboard'
                    ? 'bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] text-white shadow-lg'
                    : 'text-[#5B5B6B] hover:text-[#2E2E3A] hover:bg-[#DAD5E4]/30'
                }`}
              >
                Dashboard
              </a>
              {profile?.role === "leader" && (
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); navigate('/evaluaciones'); }}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                    location.pathname === '/evaluaciones'
                      ? 'bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] text-white shadow-lg'
                      : 'text-[#5B5B6B] hover:text-[#2E2E3A] hover:bg-[#DAD5E4]/30'
                  }`}
                >
                  Evaluaciones
                </a>
              )}
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); navigate('/reportes'); }}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  location.pathname === '/reportes'
                    ? 'bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] text-white shadow-lg'
                    : 'text-[#5B5B6B] hover:text-[#2E2E3A] hover:bg-[#DAD5E4]/30'
                }`}
              >
                Reportes
              </a>
            </div>
          </div>

          {/* Menú de usuario */}
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm text-[#5B5B6B]">Bienvenido,</p>
              <p className="font-medium text-[#2E2E3A]">
                {profile?.first_name && profile?.last_name 
                  ? `${profile.first_name} ${profile.last_name}`
                  : user?.email
                }
              </p>
            </div>
            <div className="relative profile-menu-container">
              <button 
                className="w-10 h-10 bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] 
                           rounded-full flex items-center justify-center text-white font-medium 
                           hover:from-[#4AA690] hover:to-[#8B6FB8] transition-all duration-300
                           hover:scale-110 hover:shadow-lg"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                {profile?.first_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
              </button>
              
              {/* Menú desplegable */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-[#FAF9F6] rounded-xl 
                                shadow-teamzen-strong border border-[#DAD5E4] py-1 z-50
                                animate-modal-enter">
                  <div className="px-4 py-3 border-b border-[#DAD5E4]">
                    <p className="text-sm font-medium text-[#2E2E3A]">
                      {profile?.first_name && profile?.last_name 
                        ? `${profile.first_name} ${profile.last_name}`
                        : 'Usuario'
                      }
                    </p>
                    <p className="text-xs text-[#5B5B6B]">{user?.email}</p>
                    {profile?.role && (
                      <span className="inline-block mt-2 bg-gradient-to-r from-[#55C2A2]/20 to-[#9D83C6]/20 
                                       text-[#2E2E3A] text-xs font-medium px-2 py-1 rounded-full 
                                       border border-[#55C2A2]/30">
                        {profile.role === "leader" ? "Líder de Equipo" : "Miembro de Equipo"}
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => {
                      onProfileEdit();
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-[#5B5B6B] 
                               hover:text-[#2E2E3A] hover:bg-[#DAD5E4]/30 
                               flex items-center space-x-3 transition-colors duration-200"
                  >
                    <svg className="w-4 h-4 text-[#55C2A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Editar perfil</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      onLogout();
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-red-600 
                               hover:text-red-700 hover:bg-red-50 
                               flex items-center space-x-3 transition-colors duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
