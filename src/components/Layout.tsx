import { NavLink, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/useAuth";

const NAV_ITEMS = [
  { to: "/", label: "Inicio", end: true },
  { to: "/ubicaciones", label: "Ubicaciones" },
  { to: "/mapa", label: "Mapa" },
  { to: "/produccion", label: "Producción" },
  { to: "/mantenimiento", label: "Mantención" },
  { to: "/flota", label: "Flota" },
  { to: "/equipos", label: "Equipos" },
  { to: "/pedidos", label: "Pedidos" },
  { to: "/rutas", label: "Rutas" },
  { to: "/bodega", label: "Bodega" },
];

export default function Layout() {
  const { session } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="font-semibold">Optimizador de Rutas</span>
          <nav className="flex flex-1 gap-4 text-sm">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive
                    ? "font-medium text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-900"
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {session && (
            <div className="flex items-center gap-3 text-sm text-neutral-500">
              <span>{session.user.email}</span>
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="rounded-md border border-neutral-300 px-3 py-1 hover:bg-neutral-50"
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
