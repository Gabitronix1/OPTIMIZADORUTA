import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "../lib/supabaseClient";

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

type RutaDetalleType = {
  id: string;
  fecha: string;
  estado: string;
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

export default function RutaDetalle() {
  const { id } = useParams<{ id: string }>();
  const [ruta, setRuta] = useState<RutaDetalleType | null>(null);
  const [posiciones, setPosiciones] = useState<Posicion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    setCargando(true);
    const [rutaRes, posRes] = await Promise.all([
      supabase
        .from("rutas")
        .select(
          "id, fecha, estado, camionetas(patente, tipo, capacidad_carga, autonomia_km), paradas(id, orden, hora_estimada, entregas(id, momento_real, cantidad_entregada), pedidos(id, cantidad, urgencia, estado, insumos(nombre, unidad_medida, codigo_pieza), equipos(id, identificador, tipo, horometro_actual), faenas(nombre)))"
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

  if (cargando) return <p className="text-sm text-neutral-500">Cargando…</p>;
  if (error)
    return <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!ruta) return <p className="text-sm text-neutral-500">No se encontró la ruta.</p>;

  const centro: [number, number] =
    conMapa.length > 0
      ? [
          conMapa.reduce((s, p) => s + p.lat, 0) / conMapa.length,
          conMapa.reduce((s, p) => s + p.lon, 0) / conMapa.length,
        ]
      : CENTRO_POR_DEFECTO;

  return (
    <div>
      <Link to="/rutas" className="text-sm text-blue-600 underline">
        ← Volver a Rutas
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Ruta {ruta.camionetas?.patente ?? "sin camioneta"} · {ruta.fecha}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {entregadas} de {totalParadas} paradas entregadas
          </p>
        </div>
        <label className="text-sm text-neutral-700">
          Estado de la ruta{" "}
          <select
            value={ruta.estado}
            onChange={(e) => cambiarEstadoRuta(e.target.value)}
            className="ml-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          >
            {ESTADOS_RUTA.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
      </div>

      {ruta.camionetas && (
        <p className="mt-2 text-sm text-neutral-500">
          {ruta.camionetas.tipo ?? "vehículo"} · capacidad {ruta.camionetas.capacidad_carga} kg · autonomía{" "}
          {ruta.camionetas.autonomia_km ?? "—"} km
        </p>
      )}

      {conMapa.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200" style={{ height: 420 }}>
          <MapContainer center={centro} zoom={9} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Polyline
              positions={conMapa.map((p) => [p.lat, p.lon])}
              pathOptions={{ color: "#2563eb", weight: 3, dashArray: "6 6" }}
            />
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
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">
          Ninguna parada tiene una ubicación GPS reciente todavía, así que no hay mapa que mostrar.
        </p>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-medium">Detalle de paradas</h2>
        <div className="mt-3 space-y-3">
          {paradasOrdenadas.map((parada) => {
            const entregada = parada.entregas.length > 0;
            return (
              <div key={parada.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
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
                  </div>
                  <div className="text-right">
                    {entregada ? (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                        Entregado
                        {parada.entregas[0].momento_real &&
                          ` · ${new Date(parada.entregas[0].momento_real).toLocaleString("es-CL")}`}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => confirmarEntrega(parada)}
                        disabled={confirmando === parada.id}
                        className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        {confirmando === parada.id ? "Confirmando…" : "Confirmar entrega"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
