import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  PackageSearch,
  Plus,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import SearchInput from "../components/ui/SearchInput";
import Select from "../components/ui/Select";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";

type Urgencia = "normal" | "alta" | "critica";
type EstadoPedido = "pendiente" | "planificado" | "entregado" | "cancelado";

type Insumo = { id: string; nombre: string; codigo_pieza: string | null; unidad_medida: string };
type Equipo = { id: string; identificador: string };
type Faena = { id: string; nombre: string };

type Pedido = {
  id: string;
  cantidad: number;
  urgencia: Urgencia;
  estado: EstadoPedido;
  creado_at: string;
  insumos: { nombre: string } | null;
  equipos: { identificador: string } | null;
  faenas: { nombre: string } | null;
};

type StockBajo = {
  insumo_id: string;
  nombre: string;
  codigo_pieza: string | null;
  unidad_medida: string;
  stock_minimo: number;
  stock_total: number;
};

type ProximaMantencion = {
  plan_item_id: string;
  equipo_id: string;
  identificador: string;
  accion: string;
  descripcion: string;
  horas_restantes: number;
  insumo_id: string | null;
  cantidad_texto: string | null;
};

const URGENCIAS: Urgencia[] = ["normal", "alta", "critica"];
const ESTADOS: EstadoPedido[] = ["pendiente", "planificado", "entregado", "cancelado"];

const TONO_URGENCIA: Record<Urgencia, "neutral" | "warning" | "danger"> = {
  normal: "neutral",
  alta: "warning",
  critica: "danger",
};

const TONO_ESTADO: Record<EstadoPedido, "info" | "brand" | "success" | "neutral"> = {
  pendiente: "info",
  planificado: "brand",
  entregado: "success",
  cancelado: "neutral",
};

const FORM_VACIO = {
  insumo_id: "",
  destinoTipo: "equipo" as "equipo" | "faena",
  equipo_id: "",
  faena_id: "",
  cantidad: "",
  urgencia: "normal" as Urgencia,
};

function parseCantidadTexto(texto: string | null): number {
  if (!texto) return 1;
  const n = parseFloat(texto.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default function Pedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [faenas, setFaenas] = useState<Faena[]>([]);
  const [stockBajo, setStockBajo] = useState<StockBajo[]>([]);
  const [proximas, setProximas] = useState<ProximaMantencion[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<EstadoPedido | "">("");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  async function cargarPedidos(estado: EstadoPedido | "") {
    setCargando(true);
    const query = supabase
      .from("pedidos")
      .select("id, cantidad, urgencia, estado, creado_at, insumos(nombre), equipos(identificador), faenas(nombre)")
      .order("creado_at", { ascending: false });
    const { data, error } = estado ? await query.eq("estado", estado) : await query;
    setCargando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPedidos((data ?? []) as unknown as Pedido[]);
  }

  useEffect(() => {
    cargarPedidos(filtroEstado);
  }, [filtroEstado]);

  useEffect(() => {
    supabase
      .from("insumos")
      .select("id, nombre, codigo_pieza, unidad_medida")
      .order("nombre")
      .then(({ data }) => setInsumos(data ?? []));
    supabase
      .from("equipos")
      .select("id, identificador")
      .order("identificador")
      .then(({ data }) => setEquipos(data ?? []));
    supabase
      .from("faenas")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setFaenas(data ?? []));
    supabase
      .from("insumos_stock_bajo")
      .select("*")
      .then(({ data }) => setStockBajo(data ?? []));
    supabase
      .from("proximas_mantenciones")
      .select("*")
      .lte("horas_restantes", 100)
      .order("horas_restantes", { ascending: true })
      .limit(30)
      .then(({ data }) => setProximas((data ?? []) as ProximaMantencion[]));
  }, []);

  async function crearPedido(payload: {
    insumo_id: string;
    equipo_id: string | null;
    faena_id: string | null;
    cantidad: number;
    urgencia: Urgencia;
  }) {
    setError(null);
    const { error } = await supabase.from("pedidos").insert(payload);
    if (error) {
      setError(error.message);
      return false;
    }
    cargarPedidos(filtroEstado);
    return true;
  }

  async function crearDesdeStockBajo(item: StockBajo) {
    await crearPedido({
      insumo_id: item.insumo_id,
      equipo_id: null,
      faena_id: null,
      cantidad: Math.max(item.stock_minimo - item.stock_total, 1),
      urgencia: item.stock_total <= 0 ? "critica" : "alta",
    });
  }

  async function crearDesdeMantencion(item: ProximaMantencion) {
    if (!item.insumo_id) return;
    await crearPedido({
      insumo_id: item.insumo_id,
      equipo_id: item.equipo_id,
      faena_id: null,
      cantidad: parseCantidadTexto(item.cantidad_texto),
      urgencia: item.horas_restantes <= 0 ? "critica" : item.horas_restantes <= 50 ? "alta" : "normal",
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const ok = await crearPedido({
      insumo_id: form.insumo_id,
      equipo_id: form.destinoTipo === "equipo" ? form.equipo_id || null : null,
      faena_id: form.destinoTipo === "faena" ? form.faena_id || null : null,
      cantidad: Number(form.cantidad),
      urgencia: form.urgencia,
    });
    setGuardando(false);
    if (ok) setForm(FORM_VACIO);
  }

  async function cambiarEstado(id: string, estado: EstadoPedido) {
    const { error } = await supabase.from("pedidos").update({ estado }).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    cargarPedidos(filtroEstado);
  }

  const pedidosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return pedidos;
    return pedidos.filter(
      (p) =>
        (p.insumos?.nombre ?? "").toLowerCase().includes(texto) ||
        (p.equipos?.identificador ?? "").toLowerCase().includes(texto) ||
        (p.faenas?.nombre ?? "").toLowerCase().includes(texto)
    );
  }, [pedidos, busqueda]);

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<ClipboardList className="size-5" />}
        title="Pedidos"
        description="Solicitudes de insumos para equipos o faenas. Desde acá se arman las rutas de reparto en la pestaña Rutas."
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      {stockBajo.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-lg font-medium text-neutral-900">
            <PackageSearch className="size-4.5 text-amber-600" />
            Sugeridos por stock bajo
          </h2>
          <Card className="mt-3 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Insumo</th>
                  <th className="px-3 py-2 font-medium">Stock actual</th>
                  <th className="px-3 py-2 font-medium">Mínimo</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {stockBajo.map((s) => (
                  <tr key={s.insumo_id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                    <td className="px-3 py-1.5 font-medium text-neutral-800">{s.nombre}</td>
                    <td className="px-3 py-1.5 text-amber-700">
                      {s.stock_total} {s.unidad_medida}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums">{s.stock_minimo}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Button variant="ghost" size="sm" icon={<Plus className="size-3.5" />} onClick={() => crearDesdeStockBajo(s)}>
                        Crear pedido
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      {proximas.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-lg font-medium text-neutral-900">
            <Wrench className="size-4.5 text-pine-700" />
            Sugeridos por mantención próxima
          </h2>
          <Card className="mt-3 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Equipo</th>
                  <th className="px-3 py-2 font-medium">Componente</th>
                  <th className="px-3 py-2 font-medium">Horas restantes</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {proximas.map((p) => (
                  <tr key={p.plan_item_id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                    <td className="px-3 py-1.5 font-medium text-neutral-800">{p.identificador}</td>
                    <td className="px-3 py-1.5">{p.descripcion}</td>
                    <td className="px-3 py-1.5">
                      <Badge tone={p.horas_restantes <= 0 ? "danger" : "warning"}>
                        {p.horas_restantes <= 0 ? `Vencido (${Math.abs(p.horas_restantes)} hrs)` : `${p.horas_restantes} hrs`}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {p.insumo_id ? (
                        <Button variant="ghost" size="sm" icon={<Plus className="size-3.5" />} onClick={() => crearDesdeMantencion(p)}>
                          Crear pedido
                        </Button>
                      ) : (
                        <span className="text-xs text-neutral-400">sin insumo vinculado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      <section>
        <h2 className="text-lg font-medium text-neutral-900">Nuevo pedido</h2>
        <Card className="mt-3 p-4">
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium text-neutral-700">
              Insumo
              <Select required value={form.insumo_id} onChange={(e) => setForm({ ...form, insumo_id: e.target.value })} className="mt-1.5">
                <option value="">Selecciona…</option>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm font-medium text-neutral-700">
              Destino
              <Select
                value={form.destinoTipo}
                onChange={(e) => setForm({ ...form, destinoTipo: e.target.value as "equipo" | "faena" })}
                className="mt-1.5"
              >
                <option value="equipo">Equipo</option>
                <option value="faena">Faena</option>
              </Select>
            </label>
            {form.destinoTipo === "equipo" ? (
              <label className="text-sm font-medium text-neutral-700">
                Equipo
                <Select required value={form.equipo_id} onChange={(e) => setForm({ ...form, equipo_id: e.target.value })} className="mt-1.5">
                  <option value="">Selecciona…</option>
                  {equipos.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.identificador}
                    </option>
                  ))}
                </Select>
              </label>
            ) : (
              <label className="text-sm font-medium text-neutral-700">
                Faena
                <Select required value={form.faena_id} onChange={(e) => setForm({ ...form, faena_id: e.target.value })} className="mt-1.5">
                  <option value="">Selecciona…</option>
                  {faenas.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <label className="text-sm font-medium text-neutral-700">
              Cantidad
              <Input
                type="number"
                min="0"
                step="any"
                required
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                className="mt-1.5"
              />
            </label>
            <label className="text-sm font-medium text-neutral-700">
              Urgencia
              <Select value={form.urgencia} onChange={(e) => setForm({ ...form, urgencia: e.target.value as Urgencia })} className="mt-1.5">
                {URGENCIAS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </label>
            <div className="col-span-full flex items-end">
              <Button type="submit" loading={guardando} icon={<Plus className="size-4" />}>
                Crear pedido
              </Button>
            </div>
          </form>
        </Card>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-neutral-900">Todos los pedidos</h2>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por insumo o destino…" className="w-64" />
            <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as EstadoPedido | "")} className="w-48">
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {cargando ? (
          <Spinner />
        ) : pedidosFiltrados.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-8" />}>No hay pedidos que coincidan.</EmptyState>
        ) : (
          <Card className="mt-3 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Insumo</th>
                  <th className="px-3 py-2 font-medium">Destino</th>
                  <th className="px-3 py-2 font-medium">Cantidad</th>
                  <th className="px-3 py-2 font-medium">Urgencia</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.map((p) => (
                  <tr key={p.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                    <td className="px-3 py-1.5 font-medium text-neutral-800">{p.insumos?.nombre ?? "—"}</td>
                    <td className="px-3 py-1.5">{p.equipos?.identificador ?? p.faenas?.nombre ?? "—"}</td>
                    <td className="px-3 py-1.5 tabular-nums">{p.cantidad}</td>
                    <td className="px-3 py-1.5">
                      <Badge tone={TONO_URGENCIA[p.urgencia]}>{p.urgencia}</Badge>
                    </td>
                    <td className="px-3 py-1.5">
                      <Badge tone={TONO_ESTADO[p.estado]}>{p.estado}</Badge>
                    </td>
                    <td className="px-3 py-1.5">{new Date(p.creado_at).toLocaleDateString("es-CL")}</td>
                    <td className="px-3 py-1.5 text-right">
                      {p.estado === "pendiente" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<X className="size-3.5" />}
                          onClick={() => cambiarEstado(p.id, "cancelado")}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          Cancelar
                        </Button>
                      )}
                      {p.estado === "planificado" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<CheckCircle2 className="size-3.5" />}
                          onClick={() => cambiarEstado(p.id, "entregado")}
                          className="text-pine-700 hover:bg-pine-50"
                        >
                          Marcar entregado
                        </Button>
                      )}
                    </td>
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
