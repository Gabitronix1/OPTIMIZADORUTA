import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MapPin, TriangleAlert, Upload } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  NOMBRE_FORMATO,
  parsearArchivoUbicaciones,
  type ResultadoParseo,
  type UbicacionParseada,
} from "../lib/ubicaciones";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import SearchInput from "../components/ui/SearchInput";
import Spinner from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";

type Equipo = { id: string; identificador: string };

type FilaConMatch = UbicacionParseada & {
  equipoId: string | null;
};

type EstadoCarga = "idle" | "cargando" | "listo" | "error";

type UbicacionCargada = {
  id: string;
  identificador: string;
  momento: string;
  lat: number;
  lon: number;
};

export default function Ubicaciones() {
  const [equipos, setEquipos] = useState<Equipo[] | null>(null);
  const [errorEquipos, setErrorEquipos] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoParseo | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("idle");
  const [mensajeCarga, setMensajeCarga] = useState<string | null>(null);
  const [cargadas, setCargadas] = useState<UbicacionCargada[]>([]);
  const [totalCargadas, setTotalCargadas] = useState(0);
  const [cargandoTabla, setCargandoTabla] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  async function cargarTablaUbicaciones() {
    setCargandoTabla(true);
    const { data, error, count } = await supabase
      .from("telemetria_equipos_detalle")
      .select("id, identificador, momento, lat, lon", { count: "exact" })
      .order("momento", { ascending: false })
      .limit(300);
    setCargandoTabla(false);
    if (error) {
      setErrorEquipos(error.message);
      return;
    }
    setCargadas(data ?? []);
    setTotalCargadas(count ?? 0);
  }

  useEffect(() => {
    supabase
      .from("equipos")
      .select("id, identificador")
      .then(({ data, error }) => {
        if (error) {
          setErrorEquipos(error.message);
          return;
        }
        setEquipos(data ?? []);
      });
    cargarTablaUbicaciones();
  }, []);

  const onArchivoSeleccionado = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      setNombreArchivo(archivo.name);
      setEstadoCarga("idle");
      setMensajeCarga(null);
      const parseado = await parsearArchivoUbicaciones(archivo);
      setResultado(parseado);
    },
    []
  );

  const filasConMatch: FilaConMatch[] = (resultado?.filas ?? []).map((fila) => {
    const equipo = equipos?.find(
      (eq) => eq.identificador.trim().toLowerCase() === fila.identificador.trim().toLowerCase()
    );
    return { ...fila, equipoId: equipo?.id ?? null };
  });

  const filasEmparejadas = filasConMatch.filter((f) => f.equipoId);
  const filasSinEquipo = filasConMatch.filter((f) => !f.equipoId);

  const cargadasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return cargadas;
    return cargadas.filter((u) => u.identificador.toLowerCase().includes(texto));
  }, [cargadas, busqueda]);

  async function cargarUbicaciones() {
    setEstadoCarga("cargando");
    setMensajeCarga(null);
    let exitosas = 0;
    const errores: string[] = [];

    for (const fila of filasEmparejadas) {
      if (!fila.momento) {
        errores.push(`${fila.identificador}: sin fecha/hora válida, se omitió`);
        continue;
      }
      const { error } = await supabase.rpc("registrar_ubicacion_equipo", {
        p_equipo_id: fila.equipoId,
        p_momento: fila.momento,
        p_lat: fila.lat,
        p_lon: fila.lon,
        p_horometro: fila.horometro,
      });
      if (error) {
        errores.push(`${fila.identificador}: ${error.message}`);
      } else {
        exitosas++;
      }
    }

    if (errores.length > 0) {
      setEstadoCarga("error");
      setMensajeCarga(
        `${exitosas} ubicaciones cargadas. ${errores.length} con error:\n${errores.slice(0, 5).join("\n")}` +
          (errores.length > 5 ? `\n… y ${errores.length - 5} más` : "")
      );
    } else {
      setEstadoCarga("listo");
      setMensajeCarga(`${exitosas} ubicaciones cargadas correctamente.`);
    }
    cargarTablaUbicaciones();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<MapPin className="size-5" />}
        title="Ubicaciones de equipos"
        description="Sube el archivo de ubicaciones exportado desde el sistema de telemetría de cada dealer (John Deere, Cat/Finning, Tigercat, Develon). Se detecta el formato automáticamente."
      />

      {errorEquipos && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          No se pudo cargar la lista de equipos desde Supabase: {errorEquipos}
        </div>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-neutral-900">Ubicaciones cargadas</h2>
          {cargadas.length > 0 && (
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Filtrar por equipo…" className="w-56" />
          )}
        </div>
        {cargandoTabla ? (
          <Spinner />
        ) : cargadas.length === 0 ? (
          <EmptyState icon={<MapPin className="size-8" />}>Todavía no hay ubicaciones cargadas.</EmptyState>
        ) : (
          <>
            <p className="mt-2 text-xs text-neutral-500">
              Mostrando {cargadasFiltradas.length} de las {cargadas.length} más recientes ({totalCargadas} en total).
            </p>
            <Card className="mt-3 max-h-96 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Equipo</th>
                    <th className="px-3 py-2 font-medium">Momento</th>
                    <th className="px-3 py-2 font-medium">Lat</th>
                    <th className="px-3 py-2 font-medium">Lon</th>
                  </tr>
                </thead>
                <tbody>
                  {cargadasFiltradas.map((u) => (
                    <tr key={u.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                      <td className="px-3 py-1.5 font-medium text-neutral-800">{u.identificador}</td>
                      <td className="px-3 py-1.5">{new Date(u.momento).toLocaleString("es-CL")}</td>
                      <td className="px-3 py-1.5 tabular-nums">{u.lat.toFixed(5)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{u.lon.toFixed(5)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium text-neutral-900">Subir nuevo archivo</h2>
        <div className="mt-3">
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm hover:border-pine-400 hover:bg-pine-50/40">
            <Upload className="size-4 text-pine-700" />
            <span>Seleccionar archivo (.csv o .xlsx)</span>
            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={onArchivoSeleccionado} />
          </label>
          {nombreArchivo && <p className="mt-1.5 text-xs text-neutral-500">{nombreArchivo}</p>}
        </div>

        {resultado && (
          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={resultado.formato ? "success" : "neutral"}>
                {resultado.formato ? NOMBRE_FORMATO[resultado.formato] : "Formato no reconocido"}
              </Badge>
              <Badge tone="brand" icon={<CheckCircle2 className="size-3.5" />}>
                {filasEmparejadas.length} con equipo encontrado
              </Badge>
              {filasSinEquipo.length > 0 && (
                <Badge tone="warning" icon={<TriangleAlert className="size-3.5" />}>
                  {filasSinEquipo.length} sin equipo encontrado
                </Badge>
              )}
              {resultado.filasConError.length > 0 && (
                <Badge tone="danger">{resultado.filasConError.length} filas con error de parseo</Badge>
              )}
            </div>

            {filasConMatch.length > 0 && (
              <Card className="mt-4 max-h-96 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Identificador</th>
                      <th className="px-3 py-2 font-medium">Equipo</th>
                      <th className="px-3 py-2 font-medium">Lat</th>
                      <th className="px-3 py-2 font-medium">Lon</th>
                      <th className="px-3 py-2 font-medium">Momento</th>
                      <th className="px-3 py-2 font-medium">Horómetro</th>
                      <th className="px-3 py-2 font-medium">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasConMatch.slice(0, 200).map((f, i) => (
                      <tr key={i} className="border-t border-neutral-100">
                        <td className="px-3 py-1.5">{f.identificador}</td>
                        <td className="px-3 py-1.5">
                          {f.equipoId ? (
                            <Badge tone="success">encontrado</Badge>
                          ) : (
                            <Badge tone="warning">no encontrado</Badge>
                          )}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums">{f.lat.toFixed(5)}</td>
                        <td className="px-3 py-1.5 tabular-nums">{f.lon.toFixed(5)}</td>
                        <td className="px-3 py-1.5">
                          {f.momento ? new Date(f.momento).toLocaleString("es-CL") : "sin fecha"}
                        </td>
                        <td className="px-3 py-1.5">{f.horometro ?? "—"}</td>
                        <td className="px-3 py-1.5 text-xs text-neutral-500">{f.advertencia ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filasConMatch.length > 200 && (
                  <p className="px-3 py-2 text-xs text-neutral-500">
                    Mostrando 200 de {filasConMatch.length} filas.
                  </p>
                )}
              </Card>
            )}

            {resultado.filasConError.length > 0 && (
              <details className="mt-3 text-sm text-red-700">
                <summary className="cursor-pointer">
                  Ver {resultado.filasConError.length} filas con error de parseo
                </summary>
                <ul className="mt-2 list-disc pl-5">
                  {resultado.filasConError.slice(0, 30).map((e, i) => (
                    <li key={i}>
                      Fila {e.fila}: {e.motivo}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {filasEmparejadas.length > 0 && (
              <Button
                onClick={cargarUbicaciones}
                loading={estadoCarga === "cargando"}
                icon={<Upload className="size-4" />}
                className="mt-4"
              >
                Cargar {filasEmparejadas.length} ubicaciones a Supabase
              </Button>
            )}

            {mensajeCarga && (
              <pre
                className={`mt-3 whitespace-pre-wrap rounded-lg px-4 py-3 text-sm ${
                  estadoCarga === "error" ? "border border-amber-200 bg-amber-50 text-amber-800" : "border border-pine-200 bg-pine-50 text-pine-800"
                }`}
              >
                {mensajeCarga}
              </pre>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
