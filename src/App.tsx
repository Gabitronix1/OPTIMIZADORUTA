import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Ubicaciones from "./pages/Ubicaciones";
import Mantenimiento from "./pages/Mantenimiento";
import Produccion from "./pages/Produccion";
import Stock from "./pages/Stock";
import Placeholder from "./pages/Placeholder";
import { useAuth } from "./lib/useAuth";

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, cargando } = useAuth();
  if (cargando) return <div className="p-6 text-sm text-neutral-500">Cargando…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Home />} />
          <Route path="ubicaciones" element={<Ubicaciones />} />
          <Route path="produccion" element={<Produccion />} />
          <Route path="mantenimiento" element={<Mantenimiento />} />
          <Route path="equipos" element={<Placeholder titulo="Equipos" />} />
          <Route path="pedidos" element={<Placeholder titulo="Pedidos" />} />
          <Route path="bodega" element={<Stock />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
