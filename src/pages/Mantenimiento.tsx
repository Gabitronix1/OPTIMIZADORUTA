import { useEffect, useMemo, useState } from "react";
import { Tractor, TriangleAlert, Wrench } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import SearchInput from "../components/ui/SearchInput";
import Select from "../components/ui/Select";
import Spinner from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";

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

function badgeUrgencia(horas: number) {
  if (horas <= 0) return <Badge tone="danger">Vencido ({Math.abs(horas)} hrs)</Badge>;
  if (horas <= 50) return <Badge tone="warning">{horas} hrs</Badge>;
  return <Badge tone="neutral">{horas} hrs</Badge>;
}

export default function Mantenimiento() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [equipoId, setEquipoId] = useState("");
  const [items, setItems] = useState<PlanItem[]>([]);
  const [proximas, setProximas] = useState<ProximaMantencion[]>([]);
  const [cargandoItems, setCargandoItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

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

  const proximasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return proximas;
    return proximas.filter(
      (p) => p.identificador.toLowerCase().includes(texto) || p.descripcion.toLowerCase().includes(texto)
    );
  }, [proximas, busqueda]);

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<Wrench className="size-5" />}
        title="Plan de mantenimiento"
        description="Plan preventivo por equipo y qué mantenciones están próximas según el último horómetro registrado."
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-neutral-900">Próximas mantenciones</h2>
          {proximas.length > 0 && (
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Filtrar por equipo o componente…" className="w-72" />
          )}
        </div>
        {proximas.length === 0 ? (
          <EmptyState icon={<Wrench className="size-8" />}>
            Aún no hay lecturas de horómetro cargadas. Sube el archivo de ubicaciones del dealer en{" "}
            <a href="/ubicaciones" className="font-medium text-pine-700 underline">
              Ubicaciones
            </a>{" "}
            para poder calcular qué mantenciones están próximas.
          </EmptyState>
        ) : (
          <Card className="mt-3 max-h-96 overflow-auto">
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
                {proximasFiltradas.map((p) => (
                  <tr key={p.plan_item_id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                    <td className="px-3 py-1.5 font-medium text-neutral-800">{p.identificador}</td>
                    <td className="px-3 py-1.5">{p.accion}</td>
                    <td className="px-3 py-1.5">{p.descripcion}</td>
                    <td className="px-3 py-1.5 tabular-nums">{p.horometro_actual}</td>
                    <td className="px-3 py-1.5 tabular-nums">{p.proxima_hora}</td>
                    <td className="px-3 py-1.5">{badgeUrgencia(p.horas_restantes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium text-neutral-900">Plan completo por equipo</h2>
        <Select
          value={equipoId}
          onChange={(e) => setEquipoId(e.target.value)}
          icon={<Tractor className="size-4" />}
          className="mt-3 max-w-xs"
        >
          <option value="">Selecciona un equipo…</option>
          {equipos.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.identificador}
            </option>
          ))}
        </Select>

        {cargandoItems && <Spinner />}

        {!cargandoItems && equipoId && (
          <Card className="mt-3 max-h-96 overflow-auto">
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
                  <tr key={it.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                    <td className="px-3 py-1.5">{it.accion}</td>
                    <td className="px-3 py-1.5">{it.descripcion}</td>
                    <td className="px-3 py-1.5">{it.insumos?.codigo_pieza ?? "—"}</td>
                    <td className="px-3 py-1.5">{it.cantidad_texto ?? "—"}</td>
                    <td className="px-3 py-1.5 tabular-nums">{it.frecuencia_horas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
