import { useEffect, useState } from "react";
import {
  Building2,
  ClipboardList,
  Factory,
  LayoutDashboard,
  MapPin,
  PackageSearch,
  Route,
  Tractor,
  Warehouse,
  Wrench,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Spinner from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";

type Contadores = {
  equipos: number | null;
  pedidosPendientes: number | null;
  rutasActivas: number | null;
  stockBajo: number | null;
  mantencionesVencidas: number | null;
};

type ResumenContrato = {
  contrato_id: string | null;
  contrato_codigo: string;
  total_equipos: number;
  equipos_operativos: number;
  equipos_en_mantencion: number;
  equipos_en_traslado: number;
  equipos_detenidos: number;
  mantenciones_vencidas: number;
  mantenciones_proximas: number;
  pedidos_en_ruta: number;
  pedidos_pendientes: number;
};

const ACCESOS_RAPIDOS = [
  { to: "/ubicaciones", label: "Ubicaciones", desc: "Sube el GPS de los equipos", icon: MapPin },
  { to: "/produccion", label: "Producción", desc: "Carga horómetro por turno", icon: Factory },
  { to: "/pedidos", label: "Pedidos", desc: "Solicita insumos", icon: ClipboardList },
  { to: "/rutas", label: "Rutas", desc: "Arma repartos optimizados", icon: Route },
];

export default function Home() {
  const [contadores, setContadores] = useState<Contadores>({
    equipos: null,
    pedidosPendientes: null,
    rutasActivas: null,
    stockBajo: null,
    mantencionesVencidas: null,
  });
  const [resumenContratos, setResumenContratos] = useState<ResumenContrato[]>([]);
  const [cargandoResumen, setCargandoResumen] = useState(true);

  useEffect(() => {
    async function cargar() {
      const [equipos, pedidosPendientes, rutasActivas, stockBajo, mantenciones] = await Promise.all([
        supabase.from("equipos").select("id", { count: "exact", head: true }),
        supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
        supabase.from("rutas").select("id", { count: "exact", head: true }).neq("estado", "completada"),
        supabase.from("insumos_stock_bajo").select("insumo_id", { count: "exact", head: true }),
        supabase
          .from("proximas_mantenciones")
          .select("plan_item_id", { count: "exact", head: true })
          .lte("horas_restantes", 0),
      ]);
      setContadores({
        equipos: equipos.count,
        pedidosPendientes: pedidosPendientes.count,
        rutasActivas: rutasActivas.count,
        stockBajo: stockBajo.count,
        mantencionesVencidas: mantenciones.count,
      });
    }
    cargar();

    supabase
      .from("resumen_contrato")
      .select("*")
      .then(({ data }) => {
        setCargandoResumen(false);
        setResumenContratos((data ?? []) as ResumenContrato[]);
      });
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<LayoutDashboard className="size-5" />}
        title="Panorama general"
        description="Vista rápida del estado de la flota, los pedidos y las rutas de reparto."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Tractor className="size-5" />}
          label="Equipos en flota"
          value={contadores.equipos ?? "—"}
          to="/equipos"
          tone="pine"
        />
        <StatCard
          icon={<ClipboardList className="size-5" />}
          label="Pedidos pendientes"
          value={contadores.pedidosPendientes ?? "—"}
          to="/pedidos"
          tone="brand"
        />
        <StatCard
          icon={<Route className="size-5" />}
          label="Rutas activas"
          value={contadores.rutasActivas ?? "—"}
          to="/rutas"
          tone="pine"
        />
        <StatCard
          icon={<Wrench className="size-5" />}
          label="Mantenciones vencidas"
          value={contadores.mantencionesVencidas ?? "—"}
          to="/mantenimiento"
          tone={contadores.mantencionesVencidas ? "red" : "brand"}
        />
      </div>

      {contadores.stockBajo !== null && contadores.stockBajo > 0 && (
        <Card className="flex items-center gap-3 border-amber-200 bg-amber-50 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <PackageSearch className="size-5" />
          </span>
          <p className="text-sm text-amber-800">
            Hay <span className="font-semibold">{contadores.stockBajo}</span> insumo(s) bajo el mínimo de stock.{" "}
            <a href="/pedidos" className="underline">
              Revisar sugeridos en Pedidos
            </a>
            .
          </p>
        </Card>
      )}

      <section>
        <h2 className="flex items-center gap-2 text-lg font-medium text-neutral-900">
          <Building2 className="size-4.5 text-pine-700" />
          Resumen por contrato
        </h2>
        {cargandoResumen ? (
          <Spinner />
        ) : resumenContratos.length === 0 ? (
          <EmptyState icon={<Building2 className="size-8" />}>Aún no hay contratos ni equipos registrados.</EmptyState>
        ) : (
          <Card className="mt-3 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Contrato</th>
                  <th className="px-3 py-2 font-medium">Equipos</th>
                  <th className="px-3 py-2 font-medium">Mantenciones</th>
                  <th className="px-3 py-2 font-medium">Pedidos en ruta</th>
                </tr>
              </thead>
              <tbody>
                {resumenContratos.map((r) => (
                  <tr key={r.contrato_id ?? "sin-contrato"} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                    <td className="px-3 py-1.5 font-medium text-neutral-800">{r.contrato_codigo}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="tabular-nums text-neutral-700">{r.total_equipos}</span>
                        {r.equipos_en_mantencion > 0 && <Badge tone="warning">{r.equipos_en_mantencion} en mantención</Badge>}
                        {r.equipos_en_traslado > 0 && <Badge tone="info">{r.equipos_en_traslado} en traslado</Badge>}
                        {r.equipos_detenidos > 0 && <Badge tone="danger">{r.equipos_detenidos} detenido(s)</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.mantenciones_vencidas > 0 && <Badge tone="danger">{r.mantenciones_vencidas} vencidas</Badge>}
                        {r.mantenciones_proximas > 0 && <Badge tone="warning">{r.mantenciones_proximas} próximas</Badge>}
                        {r.mantenciones_vencidas === 0 && r.mantenciones_proximas === 0 && <Badge tone="success">Al día</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="tabular-nums text-neutral-700">{r.pedidos_en_ruta}</span>
                        {r.pedidos_pendientes > 0 && <Badge tone="info">{r.pedidos_pendientes} pendiente(s)</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <div>
        <h2 className="text-lg font-medium text-neutral-900">Accesos rápidos</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ACCESOS_RAPIDOS.map((a) => (
            <a
              key={a.to}
              href={a.to}
              className="group flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-pine-800 text-white transition-colors group-hover:bg-brand-500 group-hover:text-pine-900">
                <a.icon className="size-5" />
              </span>
              <div>
                <p className="font-medium text-neutral-900">{a.label}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{a.desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      <Card className="flex items-center gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pine-100 text-pine-800">
          <Warehouse className="size-5" />
        </span>
        <p className="text-sm text-neutral-600">
          ¿Recién llegó una planilla de stock de bodega? Súbela en{" "}
          <a href="/bodega" className="font-medium text-pine-700 underline">
            Bodega
          </a>{" "}
          para mantener los inventarios al día.
        </p>
      </Card>
    </div>
  );
}
