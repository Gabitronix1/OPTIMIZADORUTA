import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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

  return (
    <div>
      <h1 className="text-2xl font-semibold">Pedidos</h1>
      <p className="mt-2 text-neutral-600">
        Solicitudes de insumos para equipos o faenas. Desde acá se arman las rutas de reparto en la pestaña
        Rutas.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {stockBajo.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Sugeridos por stock bajo</h2>
          <div className="mt-3 overflow-auto rounded-lg border border-neutral-200">
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
                  <tr key={s.insumo_id} className="border-t border-neutral-100">
                    <td className="px-3 py-1.5">{s.nombre}</td>
                    <td className="px-3 py-1.5 text-amber-700">
                      {s.stock_total} {s.unidad_medida}
                    </td>
                    <td className="px-3 py-1.5">{s.stock_minimo}</td>
                    <td className="px-3 py-1.5 text-right">
                      <button type="button" onClick={() => crearDesdeStockBajo(s)} className="text-blue-600 underline">
                        Crear pedido
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {proximas.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Sugeridos por mantención próxima</h2>
          <div className="mt-3 overflow-auto rounded-lg border border-neutral-200">
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
                  <tr key={p.plan_item_id} className="border-t border-neutral-100">
                    <td className="px-3 py-1.5">{p.identificador}</td>
                    <td className="px-3 py-1.5">{p.descripcion}</td>
                    <td className={`px-3 py-1.5 ${p.horas_restantes <= 0 ? "text-red-700" : "text-amber-700"}`}>
                      {p.horas_restantes <= 0 ? `Vencido (${Math.abs(p.horas_restantes)} hrs)` : `${p.horas_restantes} hrs`}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {p.insumo_id ? (
                        <button type="button" onClick={() => crearDesdeMantencion(p)} className="text-blue-600 underline">
                          Crear pedido
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-400">sin insumo vinculado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium">Nuevo pedido</h2>
        <form
          onSubmit={onSubmit}
          className="mt-3 grid max-w-3xl grid-cols-2 gap-4 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-4"
        >
          <label className="text-sm text-neutral-700">
            Insumo
            <select
              required
              value={form.insumo_id}
              onChange={(e) => setForm({ ...form, insumo_id: e.target.value })}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">Selecciona…</option>
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-neutral-700">
            Destino
            <select
              value={form.destinoTipo}
              onChange={(e) => setForm({ ...form, destinoTipo: e.target.value as "equipo" | "faena" })}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="equipo">Equipo</option>
              <option value="faena">Faena</option>
            </select>
          </label>
          {form.destinoTipo === "equipo" ? (
            <label className="text-sm text-neutral-700">
              Equipo
              <select
                required
                value={form.equipo_id}
                onChange={(e) => setForm({ ...form, equipo_id: e.target.value })}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="">Selecciona…</option>
                {equipos.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.identificador}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-sm text-neutral-700">
              Faena
              <select
                required
                value={form.faena_id}
                onChange={(e) => setForm({ ...form, faena_id: e.target.value })}
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="">Selecciona…</option>
                {faenas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm text-neutral-700">
            Cantidad
            <input
              type="number"
              min="0"
              step="any"
              required
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-neutral-700">
            Urgencia
            <select
              value={form.urgencia}
              onChange={(e) => setForm({ ...form, urgencia: e.target.value as Urgencia })}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              {URGENCIAS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-2 flex items-end sm:col-span-4">
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Crear pedido"}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Todos los pedidos</h2>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoPedido | "")}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 overflow-auto rounded-lg border border-neutral-200">
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
              {cargando ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-neutral-500">
                    Cargando…
                  </td>
                </tr>
              ) : pedidos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-neutral-500">
                    No hay pedidos.
                  </td>
                </tr>
              ) : (
                pedidos.map((p) => (
                  <tr key={p.id} className="border-t border-neutral-100">
                    <td className="px-3 py-1.5">{p.insumos?.nombre ?? "—"}</td>
                    <td className="px-3 py-1.5">{p.equipos?.identificador ?? p.faenas?.nombre ?? "—"}</td>
                    <td className="px-3 py-1.5">{p.cantidad}</td>
                    <td className="px-3 py-1.5">{p.urgencia}</td>
                    <td className="px-3 py-1.5">{p.estado}</td>
                    <td className="px-3 py-1.5">{new Date(p.creado_at).toLocaleDateString("es-CL")}</td>
                    <td className="px-3 py-1.5 text-right">
                      {p.estado === "pendiente" && (
                        <button type="button" onClick={() => cambiarEstado(p.id, "cancelado")} className="text-red-600 underline">
                          Cancelar
                        </button>
                      )}
                      {p.estado === "planificado" && (
                        <button
                          type="button"
                          onClick={() => cambiarEstado(p.id, "entregado")}
                          className="text-green-700 underline"
                        >
                          Marcar entregado
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
