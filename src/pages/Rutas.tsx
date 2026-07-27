import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Marker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Clock,
  MapPin,
  Route as RouteIcon,
  Sparkles,
  Trash2,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Select from "../components/ui/Select";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";
import SearchInput from "../components/ui/SearchInput";

/** supabase-js no expone el cuerpo JSON de un error de Edge Function; hay que leerlo del Response crudo. */
async function mensajeErrorFuncion(error: unknown): Promise<string> {
  const contexto = (error as { context?: Response } | null)?.context;
  if (contexto instanceof Response) {
    try {
      const cuerpo = await contexto.clone().json();
      if (typeof cuerpo?.error === "string") return cuerpo.error;
    } catch {
      // el cuerpo no era JSON, seguimos al mensaje genérico
    }
  }
  return error instanceof Error ? error.message : "Error desconocido";
}

type Camioneta = { id: string; patente: string; tipo: string | null; capacidad_carga: number; autonomia_km: number | null };

type PedidoPendiente = {
  id: string;
  cantidad: number;
  urgencia: string;
  insumos: { nombre: string } | null;
  equipos: { id: string; identificador: string; contratos: { codigo: string } | null } | null;
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
    equipos: { identificador: string; contratos: { codigo: string } | null } | null;
  } | null;
};

type Ruta = {
  id: string;
  fecha: string;
  estado: string;
  camionetas: { patente: string } | null;
  paradas: ParadaRuta[];
};

const CENTRO_POR_DEFECTO: [number, number] = [-38.3, -73.2];

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

function CapturadorClicks({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecentradorMapa({ centro }: { centro: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(centro, 13);
  }, [centro, map]);
  return null;
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
  const [sugerencias, setSugerencias] = useState<PuntoInicio[]>([]);
  const [puntoInicio, setPuntoInicio] = useState<PuntoInicio | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [creando, setCreando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [busquedaRutas, setBusquedaRutas] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function cargarTodo() {
    setCargando(true);
    const [camRes, pedRes, posRes, rutRes] = await Promise.all([
      supabase.from("camionetas").select("id, patente, tipo, capacidad_carga, autonomia_km").eq("estado", "disponible").order("patente"),
      supabase
        .from("pedidos")
        .select("id, cantidad, urgencia, insumos(nombre), equipos(id, identificador, contratos(codigo))")
        .eq("estado", "pendiente")
        .not("equipo_id", "is", null),
      supabase.from("equipos_mapa").select("equipo_id, lat, lon"),
      supabase
        .from("rutas")
        .select(
          "id, fecha, estado, camionetas(patente), paradas(id, orden, entregas(id), pedidos(cantidad, insumos(nombre), equipos(identificador, contratos(codigo))))"
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

  function onCambioDireccion(texto: string) {
    setDireccionInicio(texto);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (texto.trim().length < 3) {
      setSugerencias([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase.functions.invoke("ors-proxy", {
        body: { accion: "autocompletar", texto },
      });
      if (!error && data?.candidatos) {
        setSugerencias(data.candidatos);
      }
    }, 400);
  }

  function elegirSugerencia(s: PuntoInicio) {
    setPuntoInicio(s);
    setDireccionInicio(s.etiqueta);
    setSugerencias([]);
  }

  function onClickMapa(lat: number, lon: number) {
    setPuntoInicio({ lat, lon, etiqueta: "Punto marcado en el mapa" });
    setDireccionInicio("");
    setSugerencias([]);
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
        return pos
          ? { id: p.id, lat: pos.lat, lon: pos.lon, cantidad: Number(p.cantidad), etiqueta: p.equipos?.identificador }
          : null;
      })
      .filter(
        (p): p is { id: string; lat: number; lon: number; cantidad: number; etiqueta: string | undefined } =>
          p !== null
      );

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
      setError(errOpt ? await mensajeErrorFuncion(errOpt) : (opt?.error ?? "No se pudo optimizar la ruta"));
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
        tramos_directos: opt.tramosDirectos,
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

  async function eliminarRuta(id: string) {
    if (!window.confirm("¿Eliminar esta ruta? Sus pedidos vuelven a quedar pendientes.")) return;
    setEliminandoId(id);
    const { error } = await supabase.rpc("eliminar_ruta", { p_ruta_id: id });
    setEliminandoId(null);
    if (error) {
      setError(error.message);
      return;
    }
    cargarTodo();
  }

  const rutasFiltradas = useMemo(() => {
    const texto = busquedaRutas.trim().toLowerCase();
    if (!texto) return rutas;
    return rutas.filter(
      (r) => (r.camionetas?.patente ?? "").toLowerCase().includes(texto) || r.estado.toLowerCase().includes(texto)
    );
  }, [rutas, busquedaRutas]);

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<RouteIcon className="size-5" />}
        title="Rutas de reparto"
        description="Arma una ruta eligiendo un punto de inicio, una camioneta y los pedidos pendientes a repartir. El orden de las paradas y los tiempos se calculan con la ruta real por caminos (OpenRouteService), no en línea recta."
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <section>
        <h2 className="text-lg font-medium text-neutral-900">Nueva ruta</h2>
        <Card className="mt-3 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm font-medium text-neutral-700">
              Punto de inicio
              <div className="relative mt-1.5">
                <Input
                  type="text"
                  placeholder="Escribe una dirección o lugar…"
                  icon={<MapPin className="size-4" />}
                  value={direccionInicio}
                  onChange={(e) => onCambioDireccion(e.target.value)}
                  className="w-64"
                />
                {sugerencias.length > 0 && (
                  <ul className="absolute z-[1000] mt-1 w-64 rounded-lg border border-neutral-200 bg-white text-sm shadow-lg">
                    {sugerencias.map((s, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => elegirSugerencia(s)}
                          className="block w-full px-3 py-2 text-left hover:bg-neutral-50"
                        >
                          {s.etiqueta}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </label>
            <label className="text-sm font-medium text-neutral-700">
              Camioneta
              <Select
                value={camionetaId}
                onChange={(e) => setCamionetaId(e.target.value)}
                icon={<Truck className="size-4" />}
                className="mt-1.5 w-56"
              >
                <option value="">Selecciona…</option>
                {camionetas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.patente} ({c.tipo ?? "s/tipo"}) · cap. {c.capacidad_carga}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm font-medium text-neutral-700">
              Hora de salida
              <Input
                type="datetime-local"
                icon={<Clock className="size-4" />}
                value={horaSalida}
                onChange={(e) => setHoraSalida(e.target.value)}
                className="mt-1.5"
              />
            </label>
          </div>

          <div className="mt-4">
            <p className="text-xs text-neutral-500">
              {puntoInicio
                ? `${puntoInicio.etiqueta} — arrastra el pin para ajustar`
                : "No aparece tu lugar en la búsqueda (típico con nombres de fundos)? Haz clic directo en el mapa para marcarlo."}
            </p>
            <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200" style={{ height: 260 }}>
              <MapContainer center={CENTRO_POR_DEFECTO} zoom={8} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <CapturadorClicks onClick={onClickMapa} />
                {puntoInicio && (
                  <>
                    <RecentradorMapa centro={[puntoInicio.lat, puntoInicio.lon]} />
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
                  </>
                )}
              </MapContainer>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            {camionetaElegida && (
              <p className="text-sm text-neutral-500">
                Capacidad {camionetaElegida.capacidad_carga} — la respeta el optimizador automáticamente.
              </p>
            )}
            <Button
              onClick={crearRuta}
              loading={creando}
              disabled={!camionetaId || !puntoInicio || pedidosSeleccionados.length === 0}
              icon={<Sparkles className="size-4" />}
              className="ml-auto"
            >
              Crear ruta con {pedidosSeleccionados.length} pedidos
            </Button>
          </div>
        </Card>

        <Card className="mt-4 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-3 py-2 font-medium"></th>
                <th className="px-3 py-2 font-medium">Equipo</th>
                <th className="px-3 py-2 font-medium">Contrato</th>
                <th className="px-3 py-2 font-medium">Insumo</th>
                <th className="px-3 py-2 font-medium">Cantidad</th>
                <th className="px-3 py-2 font-medium">Urgencia</th>
                <th className="px-3 py-2 font-medium">Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6">
                    <Spinner />
                  </td>
                </tr>
              ) : pedidos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-neutral-500">
                    No hay pedidos pendientes vinculados a un equipo. Créalos en Pedidos.
                  </td>
                </tr>
              ) : (
                pedidos.map((p) => {
                  const tienePosicion = p.equipos ? posiciones.some((x) => x.equipo_id === p.equipos!.id) : false;
                  return (
                    <tr key={p.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={seleccionados.has(p.id)}
                          onChange={() => toggleSeleccionado(p.id)}
                          className="size-4 rounded border-neutral-300 text-pine-700 focus:ring-pine-500"
                        />
                      </td>
                      <td className="px-3 py-1.5 font-medium text-neutral-800">{p.equipos?.identificador ?? "—"}</td>
                      <td className="px-3 py-1.5">
                        {p.equipos?.contratos?.codigo ? (
                          <Badge tone="neutral">{p.equipos.contratos.codigo}</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-1.5">{p.insumos?.nombre ?? "—"}</td>
                      <td className="px-3 py-1.5 tabular-nums">{p.cantidad}</td>
                      <td className="px-3 py-1.5">{p.urgencia}</td>
                      <td className="px-3 py-1.5">
                        {tienePosicion ? <Badge tone="success">conocida</Badge> : <Badge tone="warning">sin GPS reciente</Badge>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-neutral-900">Rutas creadas</h2>
          {rutas.length > 0 && (
            <SearchInput value={busquedaRutas} onChange={setBusquedaRutas} placeholder="Buscar por patente o estado…" className="w-64" />
          )}
        </div>
        {rutasFiltradas.length === 0 ? (
          <EmptyState icon={<RouteIcon className="size-8" />}>
            {rutas.length === 0 ? "Todavía no hay rutas creadas." : "Ninguna ruta coincide con la búsqueda."}
          </EmptyState>
        ) : (
          <div className="mt-3 space-y-4">
            {rutasFiltradas.map((r) => {
              const entregadas = r.paradas.filter((p) => p.entregas.length > 0).length;
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-neutral-900">
                      <Truck className="size-4 text-pine-700" />
                      {r.camionetas?.patente ?? "sin camioneta"}
                    </span>
                    <span className="text-neutral-500">{r.fecha}</span>
                    <Badge tone={r.estado === "completada" ? "success" : r.estado === "en_curso" ? "info" : "neutral"}>
                      {r.estado}
                    </Badge>
                    <span className="text-xs text-neutral-500">
                      {entregadas} de {r.paradas.length} entregadas
                    </span>
                    <Link to={`/rutas/${r.id}`} className="ml-auto text-xs font-medium text-pine-700 underline">
                      Ver ficha →
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => eliminarRuta(r.id)}
                      loading={eliminandoId === r.id}
                      icon={<Trash2 className="size-3.5" />}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      Eliminar
                    </Button>
                  </div>
                  <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-neutral-700">
                    {r.paradas
                      .slice()
                      .sort((a, b) => a.orden - b.orden)
                      .map((parada) => (
                        <li key={parada.id}>
                          {parada.pedidos?.equipos?.identificador ?? "—"}
                          {parada.pedidos?.equipos?.contratos?.codigo && (
                            <Badge tone="neutral" className="ml-1.5">
                              {parada.pedidos.equipos.contratos.codigo}
                            </Badge>
                          )}{" "}
                          · {parada.pedidos?.insumos?.nombre ?? "—"} ({parada.pedidos?.cantidad ?? "—"})
                          {parada.entregas.length > 0 && (
                            <span className="ml-2 text-pine-700">✓ entregado</span>
                          )}
                        </li>
                      ))}
                  </ol>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
