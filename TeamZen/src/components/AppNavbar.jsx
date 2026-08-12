import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Dot } from './app-ui';

// Nav de app compartida por todas las páginas internas (dashboard, evaluaciones,
// reportes, mbi). onProfileEdit/onLogout son opcionales: páginas que no tienen
// su propio modal de perfil o flujo de logout (evaluaciones, reportes, mbi)
// obtienen un fallback razonable (ir a /dashboard, cerrar sesión y volver a
// /login) en vez de tener que reimplementarlo cada una.
const NAV_ITEMS = [
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

export default function AppNavbar({ user, profile, onProfileEdit, onLogout, attentionItems = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const name = profile?.first_name && profile?.last_name ? `${profile.first_name} ${profile.last_name}` : user?.email;
  const initial = (profile?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase();

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

  // Cerrar menú de perfil al hacer clic afuera o con Esc
  useEffect(() => {
    if (!showProfileMenu) return;
    const handleClickOutside = (event) => {
      if (!event.target.closest('.profile-menu-container')) setShowProfileMenu(false);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showProfileMenu]);

  // Cerrar menú de notificaciones al hacer clic afuera o con Esc
  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (event) => {
      if (!event.target.closest('.notif-menu-container')) setShowNotifications(false);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showNotifications]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#DAD5E4] bg-[#FAF9F6]/90 backdrop-blur-[12px]">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-7">
            <button type="button" onClick={() => navigate('/dashboard')} className="flex shrink-0 items-center gap-2.5 text-[#2E2E3A]">
              <img src="/img/pandazen_favicon.png" alt="" className="h-[34px] w-[34px] rounded-[11px] object-cover" />
              <span className="hidden font-['Poppins',_Arial,_sans-serif] text-lg font-bold tracking-[-.02em] sm:inline">TeamZen</span>
            </button>

            <nav className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <a
                    key={item.to}
                    href={item.to}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(item.to);
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`whitespace-nowrap rounded-xl px-3.5 py-2 font-['Poppins',_Arial,_sans-serif] text-sm transition-colors ${
                      active
                        ? 'bg-[rgba(85,194,162,.14)] font-semibold text-[#2E2E3A]'
                        : 'font-medium text-[#5B5B6B] hover:bg-[#DAD5E4]/40 hover:text-[#8B6FB8]'
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-3.5">
            <span className="hidden text-sm text-[#5B5B6B] sm:inline">
              Bienvenido, <strong className="font-bold text-[#2E2E3A]">{name}</strong>
            </span>
            {attentionItems !== null && (
              <div className="relative notif-menu-container">
                <button
                  type="button"
                  onClick={() => setShowNotifications((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={showNotifications}
                  aria-label={attentionItems.length > 0 ? `Notificaciones — ${attentionItems.length} ${attentionItems.length === 1 ? 'asunto' : 'asuntos'} requieren tu atención` : 'Notificaciones'}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#DAD5E4] bg-[#FAF9F6] text-[#5B5B6B] transition-colors hover:border-[#9D83C6] hover:text-[#2E2E3A]"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a2.5 2.5 0 002.45-2h-4.9A2.5 2.5 0 0010 18z" />
                  </svg>
                  {attentionItems.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#9D83C6] px-1 font-['Poppins',_Arial,_sans-serif] text-[11px] font-bold text-white">
                      {attentionItems.length}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div
                    role="menu"
                    className="animate-modal-enter fixed inset-x-4 top-[72px] flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-2xl border border-[#DAD5E4] bg-white p-4 shadow-teamzen-strong sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-[360px]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-['Poppins',_Arial,_sans-serif] text-[15px] font-semibold text-[#2E2E3A]">Requiere tu atención</h3>
                      {attentionItems.length > 0 && (
                        <span className="text-[13px] text-[#5B5B6B]">{attentionItems.length} {attentionItems.length === 1 ? 'asunto' : 'asuntos'}</span>
                      )}
                    </div>

                    {attentionItems.length === 0 ? (
                      <div className="flex items-center gap-3 rounded-xl border border-[#DAD5E4] bg-[#FAF9F6] p-3.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(85,194,162,.16)] text-sm text-[#3d8a74]">✓</span>
                        <p className="text-sm text-[#2E2E3A]">
                          <span className="font-semibold">Todo al día.</span> No hay evaluaciones pendientes ni alertas.
                        </p>
                      </div>
                    ) : (
                      attentionItems.map((item) => {
                        const isPurple = item.tone === 'purple';
                        return (
                          <div key={item.id} className="flex flex-col gap-2.5 rounded-xl border border-[#DAD5E4] bg-[#FAF9F6] p-3.5">
                            <div className="flex items-start gap-2.5">
                              <Dot tone={isPurple ? 'purple' : 'mint'} size={9} className="mt-[5px]" />
                              <span className="flex-1 text-sm leading-snug text-[#2E2E3A]">{item.message}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setShowNotifications(false); item.onClick?.(); }}
                              className={`self-start rounded-lg px-3 py-1.5 font-['Poppins',_Arial,_sans-serif] text-[13px] font-semibold transition-colors ${
                                isPurple
                                  ? 'bg-[rgba(157,131,198,.18)] text-[#6f56a0] hover:bg-[rgba(157,131,198,.28)]'
                                  : 'bg-[rgba(85,194,162,.16)] text-[#3d8a74] hover:bg-[rgba(85,194,162,.26)]'
                              }`}
                            >
                              {item.ctaLabel}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="relative profile-menu-container">
              <button
                type="button"
                onClick={() => setShowProfileMenu((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={showProfileMenu}
                aria-label="Menú de perfil"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#55C2A2,#9D83C6)] font-['Poppins',_Arial,_sans-serif] text-[15px] font-bold text-white shadow-[0_8px_18px_rgba(85,194,162,.22)] transition hover:scale-110"
              >
                {initial}
              </button>

              {showProfileMenu && (
                <div
                  role="menu"
                  className="animate-modal-enter absolute right-0 top-[calc(100%+10px)] flex w-[270px] flex-col gap-3 rounded-2xl border border-[#DAD5E4] bg-white p-4 shadow-teamzen-strong"
                >
                  <div className="flex flex-col">
                    <span className="font-['Poppins',_Arial,_sans-serif] text-[15px] font-semibold text-[#2E2E3A]">{name}</span>
                    <span className="text-[13px] text-[#5B5B6B]">{user?.email}</span>
                  </div>
                  {profile?.role && (
                    <span className="self-start rounded-full bg-[rgba(157,131,198,.18)] px-[11px] py-[5px] font-['Poppins',_Arial,_sans-serif] text-xs font-semibold text-[#6f56a0]">
                      {profile.role === 'leader' ? 'Líder de Equipo' : 'Miembro de Equipo'}
                    </span>
                  )}
                  <div className="h-px bg-[#DAD5E4]" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleProfileEditClick}
                    className="rounded-xl px-2.5 py-2 text-left font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#2E2E3A] transition-colors hover:bg-[#DAD5E4]/45"
                  >
                    Editar perfil
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogoutClick}
                    className="rounded-xl px-2.5 py-2 text-left font-['Poppins',_Arial,_sans-serif] text-sm font-semibold text-[#c0392b] transition-colors hover:bg-[rgba(192,57,43,.08)]"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navegación móvil inferior: la única forma de cambiar de sección por
          debajo de md:, ya que los enlaces de arriba se ocultan ahí. Vive
          fuera del <header> porque backdrop-filter en el header convierte al
          header en el contenedor de posicionamiento de sus hijos fixed (igual
          que transform), lo que pegaría esta barra al fondo del header en vez
          de al fondo real del viewport. */}
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#DAD5E4] bg-[#FAF9F6]/95 pb-[env(safe-area-inset-bottom)] shadow-teamzen-strong backdrop-blur-md md:hidden"
      >
        <div className="flex justify-around py-2.5">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.to;
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => navigate(item.to)}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center gap-1 rounded-xl px-3 py-1.5"
              >
                <svg
                  className={`h-5 w-5 ${active ? 'text-[#3d8a74]' : 'text-[#5B5B6B]'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path fillRule={item.fillRule} clipRule={item.clipRule} d={item.icon} />
                </svg>
                <span className={`font-['Poppins',_Arial,_sans-serif] text-[11px] font-semibold ${active ? 'text-[#3d8a74]' : 'text-[#5B5B6B]'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
