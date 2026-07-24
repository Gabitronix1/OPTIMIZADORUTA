import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "../lib/supabaseClient";

type EquipoMapa = {
  equipo_id: string;
  identificador: string;
  tipo: string | null;
  estado: string;
  horometro_actual: number | null;
  contrato_codigo: string | null;
  momento: string | null;
  lat: number;
  lon: number;
};

const PALETA = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777"];
const COLOR_SIN_CONTRATO = "#6b7280";
const CENTRO_POR_DEFECTO: LatLngExpression = [-38.3, -73.2];

function colorPorContrato(codigo: string | null, codigos: string[]): string {
  if (!codigo) return COLOR_SIN_CONTRATO;
  const idx = codigos.indexOf(codigo);
  return PALETA[idx % PALETA.length];
}

export default function Mapa() {
  const [equipos, setEquipos] = useState<EquipoMapa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contratoFiltro, setContratoFiltro] = useState("");

  useEffect(() => {
    supabase
      .from("equipos_mapa")
      .select("*")
      .then(({ data, error }) => {
        setCargando(false);
        if (error) {
          setError(error.message);
          return;
        }
        setEquipos((data ?? []) as EquipoMapa[]);
      });
  }, []);

  const contratos = useMemo(
    () => Array.from(new Set(equipos.map((e) => e.contrato_codigo).filter((c): c is string => !!c))).sort(),
    [equipos]
  );

  const filtrados = contratoFiltro ? equipos.filter((e) => e.contrato_codigo === contratoFiltro) : equipos;

  const centro: LatLngExpression =
    filtrados.length > 0
      ? [
          filtrados.reduce((s, e) => s + e.lat, 0) / filtrados.length,
          filtrados.reduce((s, e) => s + e.lon, 0) / filtrados.length,
        ]
      : CENTRO_POR_DEFECTO;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Mapa de equipos</h1>
      <p className="mt-2 text-neutral-600">
        Última ubicación conocida de cada equipo, según lo cargado en Ubicaciones.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-neutral-700">
          Filtrar por contrato{" "}
          <select
            value={contratoFiltro}
            onChange={(e) => setContratoFiltro(e.target.value)}
            className="ml-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {contratos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <span className="text-sm text-neutral-500">{filtrados.length} equipos con ubicación</span>
      </div>

      {!cargando && equipos.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          Todavía no hay ubicaciones cargadas. Sube el archivo en{" "}
          <a href="/ubicaciones" className="text-blue-600 underline">
            Ubicaciones
          </a>
          .
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200" style={{ height: 520 }}>
          <MapContainer center={centro} zoom={9} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtrados.map((e) => (
              <CircleMarker
                key={e.equipo_id}
                center={[e.lat, e.lon]}
                radius={8}
                pathOptions={{
                  color: colorPorContrato(e.contrato_codigo, contratos),
                  fillColor: colorPorContrato(e.contrato_codigo, contratos),
                  fillOpacity: 0.85,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-medium">{e.identificador}</p>
                    <p>
                      {e.tipo ?? "sin tipo"} · {e.estado}
                    </p>
                    <p>Contrato: {e.contrato_codigo ?? "—"}</p>
                    <p>Horómetro: {e.horometro_actual ?? "—"}</p>
                    <p>Última lectura: {e.momento ? new Date(e.momento).toLocaleString("es-CL") : "—"}</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}

      {contratos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-neutral-600">
          {contratos.map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colorPorContrato(c, contratos) }}
              />
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
