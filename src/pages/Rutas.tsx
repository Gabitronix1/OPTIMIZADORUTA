import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Marker, MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "../lib/supabaseClient";

type Camioneta = { id: string; patente: string; tipo: string | null; capacidad_carga: number; autonomia_km: number | null };

type PedidoPendiente = {
  id: string;
  cantidad: number;
  urgencia: string;
  insumos: { nombre: string } | null;
  equipos: { id: string; identificador: string } | null;
};

type PosicionEquipo = { equipo_id: string; lat: number; lon: number };

type PuntoInicio = { lat: number; lon: number; etiqueta: string };

type ParadaRuta = {
  id: string;
  orden: number;
  entregas: { id: string }[];
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

const ICONO_INICIO = L.divIcon({
  className: "",
  html: '<div style="background:#16a34a;color:white;border-radius:9999px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)">S</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function horaLocalPorDefecto() {
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  return ahora.toISOString().slice(0, 16);
}

export default function Rutas() {
  const [camionetas, setCamionetas] = useState<Camioneta[]>([]);
  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
  const [posiciones, setPosiciones] = useState<PosicionEquipo[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [camionetaId, setCamionetaId] = useState("");
  const [horaSalida, setHoraSalida] = useState(horaLocalPorDefecto);
  const [direccionInicio, setDireccionInicio] = useState("");
  const [puntoInicio, setPuntoInicio] = useState<PuntoInicio | null>(null);
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);
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
        .select(
          "id, fecha, estado, camionetas(patente), paradas(id, orden, entregas(id), pedidos(cantidad, insumos(nombre), equipos(identificador)))"
        )
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

  async function buscarDireccion() {
    if (!direccionInicio.trim()) return;
    setBuscandoDireccion(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("ors-proxy", {
      body: { accion: "geocodificar", texto: direccionInicio },
    });
    setBuscandoDireccion(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data?.resultado) {
      setError("No se encontró esa dirección, prueba con otra redacción.");
      return;
    }
    setPuntoInicio(data.resultado);
  }

  const pedidosSeleccionados = pedidos.filter((p) => seleccionados.has(p.id));
  const camionetaElegida = camionetas.find((c) => c.id === camionetaId) ?? null;

  async function crearRuta() {
    if (!camionetaId || !puntoInicio || pedidosSeleccionados.length === 0) return;
    setCreando(true);
    setError(null);

    const paradasEntrada = pedidosSeleccionados
      .map((p) => {
        const pos = p.equipos ? posiciones.find((x) => x.equipo_id === p.equipos!.id) : undefined;
        return pos ? { id: p.id, lat: pos.lat, lon: pos.lon, cantidad: Number(p.cantidad) } : null;
      })
      .filter((p): p is { id: string; lat: number; lon: number; cantidad: number } => p !== null);

    if (paradasEntrada.length === 0) {
      setCreando(false);
      setError("Ninguno de los pedidos seleccionados tiene una ubicación GPS conocida.");
      return;
    }

    const { data: opt, error: errOpt } = await supabase.functions.invoke("ors-proxy", {
      body: {
        accion: "optimizar",
        inicio: { lat: puntoInicio.lat, lon: puntoInicio.lon },
        capacidad: camionetaElegida?.capacidad_carga ?? 0,
        paradas: paradasEntrada,
      },
    });
    if (errOpt || opt?.error) {
      setCreando(false);
      setError(errOpt?.message ?? opt?.error ?? "No se pudo optimizar la ruta");
      return;
    }

    const salida = new Date(horaSalida);

    const { data: rutaCreada, error: errRuta } = await supabase
      .from("rutas")
      .insert({
        camioneta_id: camionetaId,
        fecha: horaSalida.slice(0, 10),
        punto_inicio_lat: puntoInicio.lat,
        punto_inicio_lon: puntoInicio.lon,
        punto_inicio_direccion: puntoInicio.etiqueta,
        hora_salida: salida.toISOString(),
        distancia_total_km: opt.distanciaTotalKm,
        duracion_total_min: opt.duracionTotalMin,
        geometria: opt.geometria,
      })
      .select("id")
      .single();
    if (errRuta || !rutaCreada) {
      setCreando(false);
      setError(errRuta?.message ?? "No se pudo crear la ruta");
      return;
    }

    for (let i = 0; i < opt.ordenPedidoIds.length; i++) {
      const pedidoId = opt.ordenPedidoIds[i];
      const paso = opt.pasos[i];
      const horaEstimada = new Date(salida.getTime() + paso.duracionAcumuladaMin * 60000);
      const { error: errParada } = await supabase
        .from("paradas")
        .insert({ ruta_id: rutaCreada.id, pedido_id: pedidoId, orden: i + 1, hora_estimada: horaEstimada.toISOString() });
      if (!errParada) {
        await supabase.from("pedidos").update({ estado: "planificado" }).eq("id", pedidoId);
      }
    }

    setCreando(false);
    if (opt.sinAsignar?.length > 0) {
      setError(
        `${opt.sinAsignar.length} pedido(s) no se pudieron incluir en la ruta (superan la capacidad de la camioneta o son inalcanzables).`
      );
    }
    setSeleccionados(new Set());
    setCamionetaId("");
    setPuntoInicio(null);
    setDireccionInicio("");
    cargarTodo();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Rutas de reparto</h1>
      <p className="mt-2 text-neutral-600">
        Arma una ruta eligiendo un punto de inicio, una camioneta y los pedidos pendientes a repartir. El
        orden de las paradas y los tiempos se calculan con la ruta real por caminos (OpenRouteService), no
        en línea recta.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-medium">Nueva ruta</h2>
        <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm text-neutral-700">
              Punto de inicio
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  placeholder="Dirección o lugar de partida"
                  value={direccionInicio}
                  onChange={(e) => setDireccionInicio(e.target.value)}
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={buscarDireccion}
                  disabled={buscandoDireccion}
                  className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
                >
                  {buscandoDireccion ? "Buscando…" : "Buscar"}
                </button>
              </div>
            </label>
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
                    {c.patente} ({c.tipo ?? "s/tipo"}) · cap. {c.capacidad_carga}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-neutral-700">
              Hora de salida
              <input
                type="datetime-local"
                value={horaSalida}
                onChange={(e) => setHoraSalida(e.target.value)}
                className="mt-1 block rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {puntoInicio && (
            <div className="mt-4">
              <p className="text-xs text-neutral-500">{puntoInicio.etiqueta} — arrastra el pin si no está exacto</p>
              <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200" style={{ height: 240 }}>
                <MapContainer center={[puntoInicio.lat, puntoInicio.lon]} zoom={13} style={{ height: "100%", width: "100%" }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker
                    position={[puntoInicio.lat, puntoInicio.lon]}
                    icon={ICONO_INICIO}
                    draggable
                    eventHandlers={{
                      dragend: (e) => {
                        const { lat, lng } = e.target.getLatLng();
                        setPuntoInicio((prev) => (prev ? { ...prev, lat, lon: lng } : prev));
                      },
                    }}
                  />
                </MapContainer>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            {camionetaElegida && (
              <p className="text-sm text-neutral-500">
                Capacidad {camionetaElegida.capacidad_carga} — la respeta el optimizador automáticamente.
              </p>
            )}
            <button
              type="button"
              onClick={crearRuta}
              disabled={creando || !camionetaId || !puntoInicio || pedidosSeleccionados.length === 0}
              className="ml-auto rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {creando ? "Optimizando…" : `Crear ruta con ${pedidosSeleccionados.length} pedidos`}
            </button>
          </div>
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
            {rutas.map((r) => {
              const entregadas = r.paradas.filter((p) => p.entregas.length > 0).length;
              return (
                <Link
                  key={r.id}
                  to={`/rutas/${r.id}`}
                  className="block rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-300 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-medium">{r.camionetas?.patente ?? "sin camioneta"}</span>
                    <span className="text-neutral-500">{r.fecha}</span>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{r.estado}</span>
                    <span className="text-xs text-neutral-500">
                      {entregadas} de {r.paradas.length} entregadas
                    </span>
                    <span className="ml-auto text-xs text-blue-600">Ver ficha →</span>
                  </div>
                  <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                    {r.paradas
                      .slice()
                      .sort((a, b) => a.orden - b.orden)
                      .map((parada) => (
                        <li key={parada.id}>
                          {parada.pedidos?.equipos?.identificador ?? "—"} · {parada.pedidos?.insumos?.nombre ?? "—"} (
                          {parada.pedidos?.cantidad ?? "—"})
                          {parada.entregas.length > 0 && <span className="ml-2 text-green-700">✓ entregado</span>}
                        </li>
                      ))}
                  </ol>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
