import { useEffect, useMemo, useState } from "react";
import { Filter, Tractor, TriangleAlert, Wrench } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import SearchInput from "../components/ui/SearchInput";
import Select from "../components/ui/Select";
import Spinner from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";

type Contrato = { id: string; codigo: string };

type Equipo = {
  id: string;
  identificador: string;
  contrato_id: string | null;
  contratos: { codigo: string } | null;
  maquina_base: { identificador: string } | null;
};

type ResumenEquipo = {
  equipo_id: string;
  horometro_actual: number | null;
  total_items: number;
  vencidas: number;
  proximas: number;
};

type ProximaMantencion = {
  plan_item_id: string;
  equipo_id: string;
  horas_restantes: number;
};

type PlanItem = {
  id: string;
  accion: string;
  descripcion: string;
  cantidad_texto: string | null;
  frecuencia_horas: number;
  insumos: { nombre: string; codigo_pieza: string | null } | null;
};

function badgeUrgencia(horas: number | null) {
  if (horas === null) return <Badge tone="neutral">Sin datos</Badge>;
  if (horas <= 0) return <Badge tone="danger">Vencido ({Math.abs(horas)} hrs)</Badge>;
  if (horas <= 50) return <Badge tone="warning">{horas} hrs</Badge>;
  return <Badge tone="neutral">{horas} hrs</Badge>;
}

export default function Mantenimiento() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [resumenes, setResumenes] = useState<ResumenEquipo[]>([]);
  const [proximasEquipo, setProximasEquipo] = useState<ProximaMantencion[]>([]);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState("");
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contratoFiltro, setContratoFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const [equiposRes, contratosRes, resumenRes] = await Promise.all([
        supabase
          .from("equipos")
          .select("id, identificador, contrato_id, contratos(codigo), maquina_base:equipos!maquina_base_id(identificador)")
          .order("identificador"),
        supabase.from("contratos").select("id, codigo").order("codigo"),
        supabase.from("mantenciones_resumen_equipo").select("equipo_id, horometro_actual, total_items, vencidas, proximas"),
      ]);
      setCargando(false);
      if (equiposRes.error) {
        setError(equiposRes.error.message);
        return;
      }
      setEquipos((equiposRes.data ?? []) as unknown as Equipo[]);
      setContratos(contratosRes.data ?? []);
      setResumenes((resumenRes.data ?? []) as ResumenEquipo[]);
    }
    cargar();
  }, []);

  useEffect(() => {
    if (!equipoSeleccionado) {
      setItems([]);
      setProximasEquipo([]);
      return;
    }
    setCargandoDetalle(true);
    Promise.all([
      supabase
        .from("plan_mantenimiento_items")
        .select("id, accion, descripcion, cantidad_texto, frecuencia_horas, insumos(nombre, codigo_pieza)")
        .eq("equipo_id", equipoSeleccionado)
        .order("frecuencia_horas"),
      supabase
        .from("proximas_mantenciones")
        .select("plan_item_id, equipo_id, horas_restantes")
        .eq("equipo_id", equipoSeleccionado),
    ]).then(([itemsRes, proximasRes]) => {
      setCargandoDetalle(false);
      if (itemsRes.error) {
        setError(itemsRes.error.message);
        return;
      }
      setItems((itemsRes.data ?? []) as unknown as PlanItem[]);
      setProximasEquipo((proximasRes.data ?? []) as ProximaMantencion[]);
    });
  }, [equipoSeleccionado]);

  const resumenPorEquipo = useMemo(() => {
    const mapa = new Map<string, ResumenEquipo>();
    for (const r of resumenes) mapa.set(r.equipo_id, r);
    return mapa;
  }, [resumenes]);

  const grupos = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const filtrados = equipos.filter((eq) => {
      const coincideTexto = !texto || eq.identificador.toLowerCase().includes(texto);
      const coincideContrato = !contratoFiltro || eq.contrato_id === contratoFiltro;
      return coincideTexto && coincideContrato;
    });

    const mapa = new Map<string, { contratoId: string | null; codigo: string; equipos: Equipo[] }>();
    for (const eq of filtrados) {
      const key = eq.contrato_id ?? "sin-contrato";
      const codigo = eq.contratos?.codigo ?? "Sin contrato";
      if (!mapa.has(key)) mapa.set(key, { contratoId: eq.contrato_id, codigo, equipos: [] });
      mapa.get(key)!.equipos.push(eq);
    }

    return Array.from(mapa.values())
      .map((g) => ({
        ...g,
        equipos: g.equipos.sort((a, b) => {
          const ra = resumenPorEquipo.get(a.id);
          const rb = resumenPorEquipo.get(b.id);
          const va = ra?.vencidas ?? 0;
          const vb = rb?.vencidas ?? 0;
          if (va !== vb) return vb - va;
          const pa = ra?.proximas ?? 0;
          const pb = rb?.proximas ?? 0;
          if (pa !== pb) return pb - pa;
          return a.identificador.localeCompare(b.identificador);
        }),
      }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [equipos, busqueda, contratoFiltro, resumenPorEquipo]);

  const totales = useMemo(
    () =>
      resumenes.reduce(
        (acc, r) => ({
          vencidas: acc.vencidas + r.vencidas,
          proximas: acc.proximas + r.proximas,
        }),
        { vencidas: 0, proximas: 0 }
      ),
    [resumenes]
  );

  const equipoActivo = equipos.find((eq) => eq.id === equipoSeleccionado) ?? null;

  const itemsConUrgencia = useMemo(() => {
    const mapaUrgencia = new Map(proximasEquipo.map((p) => [p.plan_item_id, p.horas_restantes]));
    return items
      .map((it) => ({ item: it, horasRestantes: mapaUrgencia.get(it.id) ?? null }))
      .sort((a, b) => {
        const ha = a.horasRestantes ?? Infinity;
        const hb = b.horasRestantes ?? Infinity;
        return ha - hb;
      });
  }, [items, proximasEquipo]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Wrench className="size-5" />}
        title="Plan de mantenimiento"
        description="Mantenciones agrupadas por contrato y equipo. Selecciona un equipo para ver su plan preventivo completo con la urgencia de cada componente."
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {contratos.length > 0 && (
            <Select
              value={contratoFiltro}
              onChange={(e) => setContratoFiltro(e.target.value)}
              icon={<Filter className="size-4" />}
              className="w-52"
            >
              <option value="">Todos los contratos</option>
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo}
                </option>
              ))}
            </Select>
          )}
          {equipos.length > 0 && (
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar equipo…" className="w-64" />
          )}
        </div>
        {!cargando && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Badge tone="danger">{totales.vencidas} vencidas</Badge>
            <Badge tone="warning">{totales.proximas} próximas</Badge>
          </div>
        )}
      </div>

      {cargando ? (
        <Spinner />
      ) : grupos.length === 0 ? (
        <EmptyState icon={<Wrench className="size-8" />}>Ningún equipo coincide con el filtro.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr] lg:items-start">
          <div className="space-y-4">
            {grupos.map((g) => (
              <Card key={g.contratoId ?? "sin-contrato"} className="overflow-hidden">
                <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-2">
                  <h3 className="text-sm font-semibold text-neutral-800">{g.codigo}</h3>
                  <p className="text-xs text-neutral-500">
                    {g.equipos.length} equipo{g.equipos.length === 1 ? "" : "s"}
                  </p>
                </div>
                <ul>
                  {g.equipos.map((eq) => {
                    const r = resumenPorEquipo.get(eq.id);
                    const activo = eq.id === equipoSeleccionado;
                    return (
                      <li key={eq.id} className="border-t border-neutral-100 first:border-t-0">
                        <button
                          type="button"
                          onClick={() => setEquipoSeleccionado(eq.id)}
                          className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                            activo ? "bg-pine-50" : "hover:bg-neutral-50"
                          }`}
                        >
                          <span>
                            <span className="font-medium text-neutral-800">{eq.identificador}</span>
                            <span className="block text-xs text-neutral-400">
                              {eq.maquina_base
                                ? `cabezal de ${eq.maquina_base.identificador} · ${r?.total_items ?? 0} ítems`
                                : r?.horometro_actual !== null && r?.horometro_actual !== undefined
                                  ? `${r.horometro_actual} hrs · ${r.total_items} ítems`
                                  : "sin horómetro"}
                            </span>
                          </span>
                          <span className="flex shrink-0 gap-1.5">
                            {r && r.vencidas > 0 && <Badge tone="danger">{r.vencidas}</Badge>}
                            {r && r.proximas > 0 && <Badge tone="warning">{r.proximas}</Badge>}
                            {r && r.vencidas === 0 && r.proximas === 0 && <Badge tone="success">Al día</Badge>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>

          <div>
            {!equipoSeleccionado ? (
              <EmptyState icon={<Tractor className="size-8" />}>
                Selecciona un equipo de la izquierda para ver su plan de mantenimiento completo.
              </EmptyState>
            ) : cargandoDetalle ? (
              <Spinner />
            ) : (
              <Card>
                <div className="border-b border-neutral-100 px-4 py-3">
                  <h3 className="font-medium text-neutral-900">{equipoActivo?.identificador}</h3>
                  <p className="text-xs text-neutral-500">
                    {equipoActivo?.contratos?.codigo ?? "Sin contrato"} · horómetro{" "}
                    {resumenPorEquipo.get(equipoSeleccionado)?.horometro_actual ?? "—"}
                  </p>
                  {equipoActivo?.maquina_base && (
                    <p className="mt-1 text-xs text-pine-700">
                      Cabezal montado en {equipoActivo.maquina_base.identificador} — usa su horómetro, pero mantiene su propio
                      plan de mantenimiento e insumos.
                    </p>
                  )}
                </div>
                {itemsConUrgencia.length === 0 ? (
                  <EmptyState icon={<Wrench className="size-8" />}>Este equipo no tiene plan de mantenimiento cargado.</EmptyState>
                ) : (
                  <div className="max-h-[36rem] overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
                        <tr>
                          <th className="px-3 py-2 font-medium">Acción</th>
                          <th className="px-3 py-2 font-medium">Componente</th>
                          <th className="px-3 py-2 font-medium">Código repuesto</th>
                          <th className="px-3 py-2 font-medium">Cantidad</th>
                          <th className="px-3 py-2 font-medium">Frecuencia (hrs)</th>
                          <th className="px-3 py-2 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsConUrgencia.map(({ item, horasRestantes }) => (
                          <tr key={item.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                            <td className="px-3 py-1.5">{item.accion}</td>
                            <td className="px-3 py-1.5">{item.descripcion}</td>
                            <td className="px-3 py-1.5">{item.insumos?.codigo_pieza ?? "—"}</td>
                            <td className="px-3 py-1.5">{item.cantidad_texto ?? "—"}</td>
                            <td className="px-3 py-1.5 tabular-nums">{item.frecuencia_horas}</td>
                            <td className="px-3 py-1.5">{badgeUrgencia(horasRestantes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
