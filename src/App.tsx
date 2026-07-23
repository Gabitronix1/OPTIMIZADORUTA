import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Ubicaciones from "./pages/Ubicaciones";
import Placeholder from "./pages/Placeholder";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="ubicaciones" element={<Ubicaciones />} />
          <Route path="equipos" element={<Placeholder titulo="Equipos" />} />
          <Route path="pedidos" element={<Placeholder titulo="Pedidos" />} />
          <Route path="bodega" element={<Placeholder titulo="Bodega" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
