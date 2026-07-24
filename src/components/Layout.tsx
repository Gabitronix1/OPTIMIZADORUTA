import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ClipboardList,
  Factory,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Route,
  Tractor,
  Truck,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/useAuth";
import BrandMark from "./BrandMark";

const NAV_ITEMS = [
  { to: "/", label: "Inicio", end: true, icon: LayoutDashboard },
  { to: "/ubicaciones", label: "Ubicaciones", icon: MapIcon },
  { to: "/mapa", label: "Mapa", icon: MapIcon },
  { to: "/produccion", label: "Producción", icon: Factory },
  { to: "/mantenimiento", label: "Mantención", icon: Wrench },
  { to: "/flota", label: "Flota", icon: Truck },
  { to: "/equipos", label: "Equipos", icon: Tractor },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/rutas", label: "Rutas", icon: Route },
  { to: "/bodega", label: "Bodega", icon: Warehouse },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-brand-500 text-pine-900 shadow-sm"
                : "text-pine-100/80 hover:bg-pine-700/60 hover:text-white"
            }`
          }
        >
          <item.icon className="size-4.5 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const { session } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const location = useLocation();
  const paginaActual = NAV_ITEMS.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)));

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 lg:flex">
      {/* Sidebar de escritorio */}
      <aside className="hidden w-64 shrink-0 flex-col bg-pine-900 lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <BrandMark wordmarkClassName="text-sm text-white" withWordmark />
        </div>
        <NavItems />
        {session && (
          <div className="border-t border-pine-700/60 p-3">
            <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-pine-200">
              <span className="truncate">{session.user.email}</span>
            </div>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-pine-100 hover:bg-pine-700/60 hover:text-white"
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </div>
        )}
      </aside>

      {/* Sidebar móvil */}
      {menuAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAbierto(false)} />
          <aside className="relative flex h-full w-72 flex-col bg-pine-900 shadow-xl">
            <div className="flex items-center justify-between px-5 py-5">
              <BrandMark wordmarkClassName="text-sm text-white" withWordmark />
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                className="rounded-md p-1 text-pine-200 hover:bg-pine-700/60 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            <NavItems onNavigate={() => setMenuAbierto(false)} />
            {session && (
              <div className="border-t border-pine-700/60 p-3">
                <button
                  type="button"
                  onClick={() => supabase.auth.signOut()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-pine-100 hover:bg-pine-700/60 hover:text-white"
                >
                  <LogOut className="size-4" />
                  Cerrar sesión
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 lg:px-8">
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <BrandMark />
          </div>
          <span className="hidden text-sm font-medium text-neutral-500 lg:inline">
            {paginaActual?.label ?? "Optimizador de Rutas"}
          </span>
          {session && (
            <span className="ml-auto truncate text-xs text-neutral-500 lg:hidden">{session.user.email}</span>
          )}
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
