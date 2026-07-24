import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Gauge,
  Navigation,
  Route as RouteIcon,
  Trash2,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";

type Entrega = { id: string; momento_real: string | null; cantidad_entregada: number | null };

type ParadaDetalle = {
  id: string;
  orden: number;
  hora_estimada: string | null;
  entregas: Entrega[];
  pedidos: {
    id: string;
    cantidad: number;
    urgencia: string;
    estado: string;
    insumos: { nombre: string; unidad_medida: string; codigo_pieza: string | null } | null;
    equipos: { id: string; identificador: string; tipo: string | null; horometro_actual: number | null } | null;
    faenas: { nombre: string } | null;
  } | null;
};

type TramoDirecto = { pedidoId: string; desde: [number, number]; hasta: [number, number]; tipo: string };

type RutaDetalleType = {
  id: string;
  fecha: string;
  estado: string;
  punto_inicio_lat: number | null;
  punto_inicio_lon: number | null;
  punto_inicio_direccion: string | null;
  hora_salida: string | null;
  distancia_total_km: number | null;
  duracion_total_min: number | null;
  geometria: [number, number][] | null;
  tramos_directos: TramoDirecto[] | null;
  camionetas: { patente: string; tipo: string | null; capacidad_carga: number; autonomia_km: number | null } | null;
  paradas: ParadaDetalle[];
};

type Posicion = { equipo_id: string; lat: number; lon: number };

const ESTADOS_RUTA = ["planificada", "en_curso", "completada"] as const;
const CENTRO_POR_DEFECTO: [number, number] = [-38.3, -73.2];

function iconoParada(numero: number, entregado: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${entregado ? "#16a34a" : "#2563eb"};color:white;border-radius:9999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)">${numero}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const ICONO_INICIO = L.divIcon({
  className: "",
  html: '<div style="background:#111827;color:white;border-radius:9999px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)">S</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function formatoDuracion(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function urlGoogleMapsPunto(lat: number, lon: number): string {
  const params = new URLSearchParams({ api: "1", destination: `${lat},${lon}`, travelmode: "driving" });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Ruta multi-parada de Google Maps: gratis, sin API key, abre navegación real en el teléfono. */
function urlGoogleMapsRuta(inicio: [number, number], paradas: [number, number][]): string {
  if (paradas.length === 0) return urlGoogleMapsPunto(inicio[0], inicio[1]);
  const destino = paradas[paradas.length - 1];
  const intermedias = paradas.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    origin: `${inicio[0]},${inicio[1]}`,
    destination: `${destino[0]},${destino[1]}`,
    travelmode: "driving",
  });
  if (intermedias.length > 0) {
    params.set("waypoints", intermedias.map(([lat, lon]) => `${lat},${lon}`).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

const TONO_ESTADO_RUTA: Record<string, "success" | "info" | "neutral"> = {
  completada: "success",
  en_curso: "info",
  planificada: "neutral",
};

export default function RutaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ruta, setRuta] = useState<RutaDetalleType | null>(null);
  const [posiciones, setPosiciones] = useState<Posicion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(async () => {
    if (!id) return;
    setCargando(true);
    const [rutaRes, posRes] = await Promise.all([
      supabase
        .from("rutas")
        .select(
          "id, fecha, estado, punto_inicio_lat, punto_inicio_lon, punto_inicio_direccion, hora_salida, distancia_total_km, duracion_total_min, geometria, tramos_directos, camionetas(patente, tipo, capacidad_carga, autonomia_km), paradas(id, orden, hora_estimada, entregas(id, momento_real, cantidad_entregada), pedidos(id, cantidad, urgencia, estado, insumos(nombre, unidad_medida, codigo_pieza), equipos(id, identificador, tipo, horometro_actual), faenas(nombre)))"
        )
        .eq("id", id)
        .order("orden", { foreignTable: "paradas", ascending: true })
        .single(),
      supabase.from("equipos_mapa").select("equipo_id, lat, lon"),
    ]);
    setCargando(false);
    if (rutaRes.error) {
      setError(rutaRes.error.message);
      return;
    }
    setRuta(rutaRes.data as unknown as RutaDetalleType);
    setPosiciones(posRes.data ?? []);
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarEstadoRuta(estado: string) {
    if (!id) return;
    const { error } = await supabase.from("rutas").update({ estado }).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    cargar();
  }

  async function eliminarRuta() {
    if (!id) return;
    if (!window.confirm("¿Eliminar esta ruta? Sus pedidos vuelven a quedar pendientes.")) return;
    setEliminando(true);
    const { error } = await supabase.rpc("eliminar_ruta", { p_ruta_id: id });
    setEliminando(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate("/rutas");
  }

  async function confirmarEntrega(parada: ParadaDetalle) {
    if (!parada.pedidos) return;
    setConfirmando(parada.id);
    const { error: errEntrega } = await supabase.from("entregas").insert({
      parada_id: parada.id,
      momento_real: new Date().toISOString(),
      cantidad_entregada: parada.pedidos.cantidad,
    });
    if (!errEntrega) {
      await supabase.from("pedidos").update({ estado: "entregado" }).eq("id", parada.pedidos.id);
    }
    setConfirmando(null);
    if (errEntrega) {
      setError(errEntrega.message);
      return;
    }
    cargar();
  }

  const paradasOrdenadas = useMemo(
    () => (ruta ? ruta.paradas.slice().sort((a, b) => a.orden - b.orden) : []),
    [ruta]
  );

  const paradasConPosicion = useMemo(
    () =>
      paradasOrdenadas.map((p) => {
        const equipoId = p.pedidos?.equipos?.id;
        const pos = equipoId ? posiciones.find((x) => x.equipo_id === equipoId) : undefined;
        return { parada: p, lat: pos?.lat ?? null, lon: pos?.lon ?? null };
      }),
    [paradasOrdenadas, posiciones]
  );

  const conMapa = paradasConPosicion.filter(
    (p): p is { parada: ParadaDetalle; lat: number; lon: number } => p.lat !== null && p.lon !== null
  );

  const entregadas = ruta?.paradas.filter((p) => p.entregas.length > 0).length ?? 0;
  const totalParadas = ruta?.paradas.length ?? 0;

  if (cargando) return <Spinner />;
  if (error)
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        {error}
      </div>
    );
  if (!ruta) return <p className="text-sm text-neutral-500">No se encontró la ruta.</p>;

  const tieneInicio = ruta.punto_inicio_lat !== null && ruta.punto_inicio_lon !== null;
  const puntosMapa: [number, number][] = [
    ...(tieneInicio ? [[ruta.punto_inicio_lat as number, ruta.punto_inicio_lon as number] as [number, number]] : []),
    ...conMapa.map((p): [number, number] => [p.lat, p.lon]),
  ];
  const geometriaRuta = ruta.geometria && ruta.geometria.length > 0 ? ruta.geometria : null;

  return (
    <div className="space-y-6">
      <Link to="/rutas" className="inline-flex items-center gap-1.5 text-sm font-medium text-pine-700 hover:underline">
        <ArrowLeft className="size-4" />
        Volver a Rutas
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-pine-800 text-white">
            <RouteIcon className="size-5" />
          </span>
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-neutral-900">
              Ruta {ruta.camionetas?.patente ?? "sin camioneta"} · {ruta.fecha}
              <Badge tone={TONO_ESTADO_RUTA[ruta.estado] ?? "neutral"}>{ruta.estado}</Badge>
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {entregadas} de {totalParadas} paradas entregadas
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tieneInicio && conMapa.length > 0 && (
            <Button
              icon={<Navigation className="size-4" />}
              onClick={() =>
                window.open(
                  urlGoogleMapsRuta(
                    [ruta.punto_inicio_lat as number, ruta.punto_inicio_lon as number],
                    conMapa.map((p): [number, number] => [p.lat, p.lon])
                  ),
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              Navegar ruta en Google Maps
            </Button>
          )}
          <Select value={ruta.estado} onChange={(e) => cambiarEstadoRuta(e.target.value)} className="w-40">
            {ESTADOS_RUTA.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
          <Button variant="danger" onClick={eliminarRuta} loading={eliminando} icon={<Trash2 className="size-4" />}>
            Eliminar ruta
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-600">
        {ruta.camionetas && (
          <span className="flex items-center gap-1.5">
            <Truck className="size-4 text-neutral-400" />
            {ruta.camionetas.tipo ?? "vehículo"} · capacidad {ruta.camionetas.capacidad_carga} kg
          </span>
        )}
        {ruta.punto_inicio_direccion && (
          <span className="flex items-center gap-1.5">
            <Navigation className="size-4 text-neutral-400" />
            Inicio: {ruta.punto_inicio_direccion}
          </span>
        )}
        {ruta.hora_salida && (
          <span className="flex items-center gap-1.5">
            <Clock3 className="size-4 text-neutral-400" />
            Salida: {new Date(ruta.hora_salida).toLocaleString("es-CL")}
          </span>
        )}
        {ruta.distancia_total_km !== null && (
          <span className="flex items-center gap-1.5">
            <Gauge className="size-4 text-neutral-400" />
            {ruta.distancia_total_km} km totales
          </span>
        )}
        {ruta.duracion_total_min !== null && <span>{formatoDuracion(ruta.duracion_total_min)} de trayecto</span>}
      </div>

      {puntosMapa.length > 0 ? (
        <Card className="overflow-hidden" style={{ height: 420 }}>
          <MapContainer
            bounds={puntosMapa}
            boundsOptions={{ padding: [30, 30] }}
            center={CENTRO_POR_DEFECTO}
            zoom={9}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {geometriaRuta ? (
              <Polyline positions={geometriaRuta} pathOptions={{ color: "#2563eb", weight: 4 }} />
            ) : (
              <Polyline
                positions={puntosMapa}
                pathOptions={{ color: "#2563eb", weight: 3, dashArray: "6 6" }}
              />
            )}
            {(ruta.tramos_directos ?? []).map((t, i) => (
              <Polyline
                key={i}
                positions={[t.desde, t.hasta]}
                pathOptions={{
                  color: t.tipo === "sin_camino_350m" ? "#dc2626" : "#d97706",
                  weight: 3,
                  dashArray: "2 8",
                }}
              />
            ))}
            {tieneInicio && (
              <Marker position={[ruta.punto_inicio_lat as number, ruta.punto_inicio_lon as number]} icon={ICONO_INICIO}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-medium">Inicio</p>
                    <p>{ruta.punto_inicio_direccion ?? "Punto de partida"}</p>
                  </div>
                </Popup>
              </Marker>
            )}
            {conMapa.map((p) => (
              <Marker
                key={p.parada.id}
                position={[p.lat, p.lon]}
                icon={iconoParada(p.parada.orden, p.parada.entregas.length > 0)}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-medium">
                      Parada {p.parada.orden}: {p.parada.pedidos?.equipos?.identificador ?? "—"}
                    </p>
                    <p>
                      {p.parada.pedidos?.insumos?.nombre} ({p.parada.pedidos?.cantidad}{" "}
                      {p.parada.pedidos?.insumos?.unidad_medida})
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </Card>
      ) : (
        <p className="text-sm text-neutral-500">
          Ninguna parada tiene una ubicación GPS reciente todavía, así que no hay mapa que mostrar.
        </p>
      )}

      {ruta.tramos_directos && ruta.tramos_directos.length > 0 && (
        <p className="text-xs text-neutral-500">
          Línea sólida azul: ruta real por camino. Línea punteada{" "}
          <span className="text-amber-600">naranja</span> o <span className="text-red-600">roja</span>: tramo
          estimado en línea recta porque no hay un camino mapeado hasta ese punto exacto (típico en caminos
          internos de fundos).
        </p>
      )}

      <section>
        <h2 className="text-lg font-medium text-neutral-900">Detalle de paradas</h2>
        <div className="mt-3 space-y-3">
          {paradasOrdenadas.map((parada) => {
            const entregada = parada.entregas.length > 0;
            return (
              <Card key={parada.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      Parada {parada.orden} ·{" "}
                      {parada.pedidos?.equipos?.identificador ?? parada.pedidos?.faenas?.nombre ?? "—"}
                    </p>
                    <p className="mt-1 text-sm text-neutral-600">
                      {parada.pedidos?.insumos?.nombre} — {parada.pedidos?.cantidad}{" "}
                      {parada.pedidos?.insumos?.unidad_medida}
                      {parada.pedidos?.insumos?.codigo_pieza && ` (${parada.pedidos.insumos.codigo_pieza})`}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Urgencia: {parada.pedidos?.urgencia} · Tipo de equipo: {parada.pedidos?.equipos?.tipo ?? "—"} ·
                      Horómetro: {parada.pedidos?.equipos?.horometro_actual ?? "—"}
                    </p>
                    {parada.hora_estimada && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
                        <Clock3 className="size-3.5" />
                        Llegada estimada: {new Date(parada.hora_estimada).toLocaleString("es-CL")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    {(() => {
                      const pos = conMapa.find((c) => c.parada.id === parada.id);
                      return pos ? (
                        <a
                          href={urlGoogleMapsPunto(pos.lat, pos.lon)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-pine-700 underline"
                        >
                          <Navigation className="size-3.5" />
                          Navegar hasta acá
                        </a>
                      ) : null;
                    })()}
                    {entregada ? (
                      <Badge tone="success" icon={<CheckCircle2 className="size-3.5" />}>
                        Entregado
                        {parada.entregas[0].momento_real &&
                          ` · ${new Date(parada.entregas[0].momento_real).toLocaleString("es-CL")}`}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => confirmarEntrega(parada)}
                        loading={confirmando === parada.id}
                        icon={<CheckCircle2 className="size-3.5" />}
                      >
                        Confirmar entrega
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
