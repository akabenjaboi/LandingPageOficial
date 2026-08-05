import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

// Nav de app compartida por todas las páginas internas (dashboard, evaluaciones,
// reportes, mbi). onProfileEdit/onLogout son opcionales: páginas que no tienen
// su propio modal de perfil o flujo de logout (evaluaciones, reportes, mbi)
// obtienen un fallback razonable (ir a /dashboard, cerrar sesión y volver a
// /login) en vez de tener que reimplementarlo cada una.
const MOBILE_NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: 'M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z',
  },
  {
    to: '/evaluaciones',
    label: 'Evaluaciones',
    icon: 'M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z',
    clipRule: 'evenodd',
    fillRule: 'evenodd',
  },
  {
    to: '/reportes',
    label: 'Reportes',
    icon: 'M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z',
  },
];

export default function AppNavbar({ user, profile, onProfileEdit, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleProfileEditClick = () => {
    if (onProfileEdit) {
      onProfileEdit();
    } else {
      navigate('/dashboard');
    }
    setShowProfileMenu(false);
  };

  const handleLogoutClick = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await supabase.auth.signOut();
      navigate('/login');
    }
    setShowProfileMenu(false);
  };

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
    <>
    <nav className="bg-[#FAF9F6] border-b border-[#DAD5E4] sticky top-0 z-40
                    backdrop-blur-md bg-[#FAF9F6]/95 shadow-teamzen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo y marca */}
          <div className="flex items-center min-w-0 space-x-2 lg:space-x-4">
            <div className="flex-shrink-0 flex items-center group cursor-pointer"
                 onClick={() => navigate('/dashboard')}>
              <img
                className="h-8 w-auto transition-transform duration-300 group-hover:scale-110"
                src="/img/pandalogo.png"
                alt="TeamZen"
              />
              <span className="ml-3 text-xl font-bold text-[#2E2E3A] group-hover:text-[#9D83C6]
                               transition-all duration-300">
                TeamZen
              </span>
            </div>

            {/* Enlaces de navegación */}
            <div className="hidden md:flex items-center space-x-1 ml-2 lg:ml-8">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}
                className={`px-2.5 lg:px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                  location.pathname === '/dashboard'
                    ? 'bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] text-white shadow-lg'
                    : 'text-[#5B5B6B] hover:text-[#2E2E3A] hover:bg-[#DAD5E4]/30'
                }`}
              >
                Dashboard
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigate('/evaluaciones'); }}
                className={`px-2.5 lg:px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                  location.pathname === '/evaluaciones'
                    ? 'bg-gradient-to-r from-[#55C2A2] to-[#9D83C6] text-white shadow-lg'
                    : 'text-[#5B5B6B] hover:text-[#2E2E3A] hover:bg-[#DAD5E4]/30'
                }`}
              >
                Evaluaciones
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigate('/reportes'); }}
                className={`px-2.5 lg:px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 ${
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
          <div className="flex items-center min-w-0 space-x-2 lg:space-x-4">
            <div className="text-right hidden sm:block min-w-0">
              <p className="text-sm text-[#5B5B6B]">Bienvenido,</p>
              <p
                className="font-medium text-[#2E2E3A] truncate max-w-[90px] md:max-w-[110px] lg:max-w-none"
                title={profile?.first_name && profile?.last_name
                  ? `${profile.first_name} ${profile.last_name}`
                  : user?.email}
              >
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
                aria-label="Menú de perfil"
                aria-expanded={showProfileMenu}
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
                    onClick={handleProfileEditClick}
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
                    onClick={handleLogoutClick}
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

    {/* Navegación móvil inferior: la única forma de cambiar de sección por
        debajo de md:, ya que los enlaces de arriba se ocultan ahí. Vive
        fuera de <nav> porque backdrop-blur-md en el nav convierte al nav
        en el contenedor de posicionamiento de sus hijos fixed (igual que
        transform), lo que pegaría esta barra al fondo del nav en vez de
        al fondo real del viewport. */}
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FAF9F6] border-t border-[#DAD5E4] shadow-teamzen-strong z-40">
        <div className="flex justify-around py-3">
          {MOBILE_NAV_ITEMS.map((item) => {
            const active = location.pathname === item.to;
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className="flex flex-col items-center space-y-1 px-3 py-1"
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <svg
                    className={`w-5 h-5 ${active ? 'text-[#55C2A2]' : 'text-[#2E2E3A]'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule={item.fillRule}
                      clipRule={item.clipRule}
                      d={item.icon}
                    />
                  </svg>
                </div>
                <span className={`text-xs font-medium ${active ? 'text-[#2C7B64]' : 'text-[#2E2E3A]'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
