import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Equipo = { id: string; identificador: string };

type PlanItem = {
  id: string;
  accion: string;
  descripcion: string;
  cantidad_texto: string | null;
  frecuencia_horas: number;
  insumos: { nombre: string; codigo_pieza: string | null } | null;
};

type ProximaMantencion = {
  plan_item_id: string;
  identificador: string;
  accion: string;
  descripcion: string;
  frecuencia_horas: number;
  horometro_actual: number;
  proxima_hora: number;
  horas_restantes: number;
  cantidad_texto: string | null;
};

export default function Mantenimiento() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [equipoId, setEquipoId] = useState("");
  const [items, setItems] = useState<PlanItem[]>([]);
  const [proximas, setProximas] = useState<ProximaMantencion[]>([]);
  const [cargandoItems, setCargandoItems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("equipos")
      .select("id, identificador")
      .order("identificador")
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
          return;
        }
        setEquipos(data ?? []);
      });

    supabase
      .from("proximas_mantenciones")
      .select("*")
      .order("horas_restantes", { ascending: true })
      .limit(30)
      .then(({ data, error }) => {
        if (!error) setProximas(data ?? []);
      });
  }, []);

  useEffect(() => {
    if (!equipoId) {
      setItems([]);
      return;
    }
    setCargandoItems(true);
    supabase
      .from("plan_mantenimiento_items")
      .select("id, accion, descripcion, cantidad_texto, frecuencia_horas, insumos(nombre, codigo_pieza)")
      .eq("equipo_id", equipoId)
      .order("frecuencia_horas")
      .then(({ data, error }) => {
        setCargandoItems(false);
        if (error) {
          setError(error.message);
          return;
        }
        setItems((data ?? []) as unknown as PlanItem[]);
      });
  }, [equipoId]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Plan de mantenimiento</h1>
      <p className="mt-2 text-neutral-600">
        Plan preventivo por equipo y qué mantenciones están próximas según el último horómetro registrado.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-medium">Próximas mantenciones</h2>
        {proximas.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Aún no hay lecturas de horómetro cargadas. Sube el archivo de ubicaciones del dealer en{" "}
            <a href="/ubicaciones" className="text-blue-600 underline">
              Ubicaciones
            </a>{" "}
            para poder calcular qué mantenciones están próximas.
          </p>
        ) : (
          <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Equipo</th>
                  <th className="px-3 py-2 font-medium">Acción</th>
                  <th className="px-3 py-2 font-medium">Componente</th>
                  <th className="px-3 py-2 font-medium">Horómetro actual</th>
                  <th className="px-3 py-2 font-medium">Próxima hora</th>
                  <th className="px-3 py-2 font-medium">Horas restantes</th>
                </tr>
              </thead>
              <tbody>
                {proximas.map((p) => (
                  <tr key={p.plan_item_id} className="border-t border-neutral-100">
                    <td className="px-3 py-1.5">{p.identificador}</td>
                    <td className="px-3 py-1.5">{p.accion}</td>
                    <td className="px-3 py-1.5">{p.descripcion}</td>
                    <td className="px-3 py-1.5">{p.horometro_actual}</td>
                    <td className="px-3 py-1.5">{p.proxima_hora}</td>
                    <td
                      className={`px-3 py-1.5 font-medium ${
                        p.horas_restantes <= 0
                          ? "text-red-700"
                          : p.horas_restantes <= 50
                            ? "text-amber-700"
                            : "text-neutral-700"
                      }`}
                    >
                      {p.horas_restantes <= 0 ? `Vencido (${Math.abs(p.horas_restantes)} hrs)` : `${p.horas_restantes} hrs`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Plan completo por equipo</h2>
        <select
          value={equipoId}
          onChange={(e) => setEquipoId(e.target.value)}
          className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Selecciona un equipo…</option>
          {equipos.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.identificador}
            </option>
          ))}
        </select>

        {cargandoItems && <p className="mt-3 text-sm text-neutral-500">Cargando…</p>}

        {!cargandoItems && equipoId && (
          <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Acción</th>
                  <th className="px-3 py-2 font-medium">Componente</th>
                  <th className="px-3 py-2 font-medium">Código repuesto</th>
                  <th className="px-3 py-2 font-medium">Cantidad</th>
                  <th className="px-3 py-2 font-medium">Frecuencia (hrs)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-neutral-100">
                    <td className="px-3 py-1.5">{it.accion}</td>
                    <td className="px-3 py-1.5">{it.descripcion}</td>
                    <td className="px-3 py-1.5">{it.insumos?.codigo_pieza ?? "—"}</td>
                    <td className="px-3 py-1.5">{it.cantidad_texto ?? "—"}</td>
                    <td className="px-3 py-1.5">{it.frecuencia_horas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
