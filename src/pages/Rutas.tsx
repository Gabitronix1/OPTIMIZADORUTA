import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ordenarPorVecinoMasCercano, type Punto } from "../lib/rutas";

type Camioneta = { id: string; patente: string; tipo: string | null; capacidad_carga: number; autonomia_km: number | null };

type PedidoPendiente = {
  id: string;
  cantidad: number;
  urgencia: string;
  insumos: { nombre: string } | null;
  equipos: { id: string; identificador: string } | null;
};

type PosicionEquipo = { equipo_id: string; lat: number; lon: number };

type ParadaRuta = {
  id: string;
  orden: number;
  pedidos: {
    cantidad: number;
    insumos: { nombre: string } | null;
    equipos: { identificador: string } | null;
  } | null;
};

type Ruta = {
  id: string;
  fecha: string;
  estado: string;
  camionetas: { patente: string } | null;
  paradas: ParadaRuta[];
};

export default function Rutas() {
  const [camionetas, setCamionetas] = useState<Camioneta[]>([]);
  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
  const [posiciones, setPosiciones] = useState<PosicionEquipo[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [camionetaId, setCamionetaId] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [creando, setCreando] = useState(false);

  async function cargarTodo() {
    setCargando(true);
    const [camRes, pedRes, posRes, rutRes] = await Promise.all([
      supabase.from("camionetas").select("id, patente, tipo, capacidad_carga, autonomia_km").eq("estado", "disponible").order("patente"),
      supabase
        .from("pedidos")
        .select("id, cantidad, urgencia, insumos(nombre), equipos(id, identificador)")
        .eq("estado", "pendiente")
        .not("equipo_id", "is", null),
      supabase.from("equipos_mapa").select("equipo_id, lat, lon"),
      supabase
        .from("rutas")
        .select("id, fecha, estado, camionetas(patente), paradas(id, orden, pedidos(cantidad, insumos(nombre), equipos(identificador)))")
        .order("fecha", { ascending: false })
        .order("orden", { foreignTable: "paradas", ascending: true })
        .limit(30),
    ]);
    setCargando(false);

    const err = camRes.error || pedRes.error || posRes.error || rutRes.error;
    if (err) {
      setError(err.message);
      return;
    }
    setCamionetas(camRes.data ?? []);
    setPedidos((pedRes.data ?? []) as unknown as PedidoPendiente[]);
    setPosiciones(posRes.data ?? []);
    setRutas((rutRes.data ?? []) as unknown as Ruta[]);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  function toggleSeleccionado(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pedidosSeleccionados = pedidos.filter((p) => seleccionados.has(p.id));
  const cantidadTotal = pedidosSeleccionados.reduce((s, p) => s + Number(p.cantidad), 0);
  const camionetaElegida = camionetas.find((c) => c.id === camionetaId) ?? null;

  async function crearRuta() {
    if (!camionetaId || pedidosSeleccionados.length === 0) return;
    setCreando(true);
    setError(null);

    const conPosicion: (PedidoPendiente & Punto)[] = [];
    const sinPosicion: PedidoPendiente[] = [];
    pedidosSeleccionados.forEach((p) => {
      const pos = p.equipos ? posiciones.find((x) => x.equipo_id === p.equipos!.id) : undefined;
      if (pos) conPosicion.push({ ...p, lat: pos.lat, lon: pos.lon });
      else sinPosicion.push(p);
    });

    const ordenados = [...ordenarPorVecinoMasCercano(conPosicion), ...sinPosicion];

    const { data: ruta, error: errRuta } = await supabase
      .from("rutas")
      .insert({ camioneta_id: camionetaId, fecha })
      .select("id")
      .single();
    if (errRuta || !ruta) {
      setCreando(false);
      setError(errRuta?.message ?? "No se pudo crear la ruta");
      return;
    }

    for (let i = 0; i < ordenados.length; i++) {
      const { error: errParada } = await supabase
        .from("paradas")
        .insert({ ruta_id: ruta.id, pedido_id: ordenados[i].id, orden: i + 1 });
      if (errParada) {
        setError(errParada.message);
        continue;
      }
      await supabase.from("pedidos").update({ estado: "planificado" }).eq("id", ordenados[i].id);
    }

    setCreando(false);
    setSeleccionados(new Set());
    setCamionetaId("");
    cargarTodo();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Rutas de reparto</h1>
      <p className="mt-2 text-neutral-600">
        Arma una ruta eligiendo una camioneta y los pedidos pendientes a repartir. El orden de las paradas se
        calcula con una heurística simple de vecino más cercano según la última ubicación del equipo — no es
        un optimizador completo de rutas, pero da un orden razonable para partir.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-medium">Nueva ruta</h2>
        <div className="mt-3 flex flex-wrap items-end gap-4 rounded-lg border border-neutral-200 bg-white p-4">
          <label className="text-sm text-neutral-700">
            Camioneta
            <select
              value={camionetaId}
              onChange={(e) => setCamionetaId(e.target.value)}
              className="mt-1 block rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">Selecciona…</option>
              {camionetas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.patente} ({c.tipo ?? "s/tipo"})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-neutral-700">
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-1 block rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          {camionetaElegida && (
            <p className="text-sm text-neutral-600">
              Carga seleccionada: {cantidadTotal} / capacidad {camionetaElegida.capacidad_carga}
              {cantidadTotal > camionetaElegida.capacidad_carga && (
                <span className="ml-1 text-amber-700">(supera la capacidad — revisa las unidades)</span>
              )}
            </p>
          )}
          <button
            type="button"
            onClick={crearRuta}
            disabled={creando || !camionetaId || pedidosSeleccionados.length === 0}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {creando ? "Creando…" : `Crear ruta con ${pedidosSeleccionados.length} pedidos`}
          </button>
        </div>

        <div className="mt-4 overflow-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-3 py-2 font-medium"></th>
                <th className="px-3 py-2 font-medium">Equipo</th>
                <th className="px-3 py-2 font-medium">Insumo</th>
                <th className="px-3 py-2 font-medium">Cantidad</th>
                <th className="px-3 py-2 font-medium">Urgencia</th>
                <th className="px-3 py-2 font-medium">Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-neutral-500">
                    Cargando…
                  </td>
                </tr>
              ) : pedidos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-neutral-500">
                    No hay pedidos pendientes vinculados a un equipo. Créalos en Pedidos.
                  </td>
                </tr>
              ) : (
                pedidos.map((p) => {
                  const tienePosicion = p.equipos ? posiciones.some((x) => x.equipo_id === p.equipos!.id) : false;
                  return (
                    <tr key={p.id} className="border-t border-neutral-100">
                      <td className="px-3 py-1.5">
                        <input type="checkbox" checked={seleccionados.has(p.id)} onChange={() => toggleSeleccionado(p.id)} />
                      </td>
                      <td className="px-3 py-1.5">{p.equipos?.identificador ?? "—"}</td>
                      <td className="px-3 py-1.5">{p.insumos?.nombre ?? "—"}</td>
                      <td className="px-3 py-1.5">{p.cantidad}</td>
                      <td className="px-3 py-1.5">{p.urgencia}</td>
                      <td className="px-3 py-1.5">
                        {tienePosicion ? (
                          <span className="text-green-700">conocida</span>
                        ) : (
                          <span className="text-amber-700">sin GPS reciente</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Rutas creadas</h2>
        {rutas.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Todavía no hay rutas creadas.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {rutas.map((r) => (
              <div key={r.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">{r.camionetas?.patente ?? "sin camioneta"}</span>
                  <span className="text-neutral-500">{r.fecha}</span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{r.estado}</span>
                </div>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                  {r.paradas
                    .slice()
                    .sort((a, b) => a.orden - b.orden)
                    .map((parada) => (
                      <li key={parada.id}>
                        {parada.pedidos?.equipos?.identificador ?? "—"} · {parada.pedidos?.insumos?.nombre ?? "—"} (
                        {parada.pedidos?.cantidad ?? "—"})
                      </li>
                    ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
