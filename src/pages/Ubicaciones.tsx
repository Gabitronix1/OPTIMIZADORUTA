import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  NOMBRE_FORMATO,
  parsearArchivoUbicaciones,
  type ResultadoParseo,
  type UbicacionParseada,
} from "../lib/ubicaciones";

type Equipo = { id: string; identificador: string };

type FilaConMatch = UbicacionParseada & {
  equipoId: string | null;
};

type EstadoCarga = "idle" | "cargando" | "listo" | "error";

export default function Ubicaciones() {
  const [equipos, setEquipos] = useState<Equipo[] | null>(null);
  const [errorEquipos, setErrorEquipos] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoParseo | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("idle");
  const [mensajeCarga, setMensajeCarga] = useState<string | null>(null);

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
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Ubicaciones de equipos</h1>
      <p className="mt-2 text-neutral-600">
        Sube el archivo de ubicaciones exportado desde el sistema de telemetría de cada dealer
        (John Deere, Cat/Finning, Tigercat, Develon). Se detecta el formato automáticamente.
      </p>

      {errorEquipos && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          No se pudo cargar la lista de equipos desde Supabase: {errorEquipos}
        </div>
      )}

      <div className="mt-4">
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50">
          <span>Seleccionar archivo (.csv o .xlsx)</span>
          <input type="file" accept=".csv,.xlsx" className="hidden" onChange={onArchivoSeleccionado} />
        </label>
        {nombreArchivo && <p className="mt-1 text-xs text-neutral-500">{nombreArchivo}</p>}
      </div>

      {resultado && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-neutral-900 px-3 py-1 text-white">
              {resultado.formato ? NOMBRE_FORMATO[resultado.formato] : "Formato no reconocido"}
            </span>
            <span className="text-neutral-600">{filasEmparejadas.length} con equipo encontrado</span>
            <span className="text-amber-700">{filasSinEquipo.length} sin equipo encontrado</span>
            <span className="text-red-700">{resultado.filasConError.length} filas con error de parseo</span>
          </div>

          {filasConMatch.length > 0 && (
            <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-neutral-200">
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
                          <span className="text-green-700">encontrado</span>
                        ) : (
                          <span className="text-amber-700">no encontrado</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">{f.lat.toFixed(5)}</td>
                      <td className="px-3 py-1.5">{f.lon.toFixed(5)}</td>
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
            </div>
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
            <button
              type="button"
              onClick={cargarUbicaciones}
              disabled={estadoCarga === "cargando"}
              className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {estadoCarga === "cargando"
                ? "Cargando…"
                : `Cargar ${filasEmparejadas.length} ubicaciones a Supabase`}
            </button>
          )}

          {mensajeCarga && (
            <pre
              className={`mt-3 whitespace-pre-wrap rounded-md px-4 py-3 text-sm ${
                estadoCarga === "error" ? "border border-amber-200 bg-amber-50 text-amber-800" : "border border-green-200 bg-green-50 text-green-800"
              }`}
            >
              {mensajeCarga}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
