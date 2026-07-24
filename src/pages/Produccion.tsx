import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { parsearReporteProduccion, type ResultadoParseoProduccion, type TurnoParseado } from "../lib/produccion";

type Equipo = { id: string; identificador: string };

type FilaConMatch = TurnoParseado & {
  equipoId: string | null;
};

type EstadoCarga = "idle" | "cargando" | "listo" | "error";

type TurnoCargado = {
  id: string;
  dia_jornada: string;
  horometro_inicio: number | null;
  horometro_termino: number | null;
  equipos: { identificador: string } | null;
  contratos: { codigo: string } | null;
  fundos: { nombre: string } | null;
};

export default function Produccion() {
  const [equipos, setEquipos] = useState<Equipo[] | null>(null);
  const [errorEquipos, setErrorEquipos] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoParseoProduccion | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("idle");
  const [mensajeCarga, setMensajeCarga] = useState<string | null>(null);
  const [cargadas, setCargadas] = useState<TurnoCargado[]>([]);
  const [totalCargadas, setTotalCargadas] = useState(0);
  const [cargandoTabla, setCargandoTabla] = useState(true);

  async function cargarTablaProduccion() {
    setCargandoTabla(true);
    const { data, error, count } = await supabase
      .from("lecturas_horometro_turno")
      .select("id, dia_jornada, horometro_inicio, horometro_termino, equipos(identificador), contratos(codigo), fundos(nombre)", {
        count: "exact",
      })
      .order("dia_jornada", { ascending: false })
      .limit(300);
    setCargandoTabla(false);
    if (error) {
      setErrorEquipos(error.message);
      return;
    }
    setCargadas((data ?? []) as unknown as TurnoCargado[]);
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
    cargarTablaProduccion();
  }, []);

  const onArchivoSeleccionado = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setNombreArchivo(archivo.name);
    setEstadoCarga("idle");
    setMensajeCarga(null);
    const texto = await archivo.text();
    setResultado(parsearReporteProduccion(texto));
  }, []);

  const filasConMatch: FilaConMatch[] = (resultado?.filas ?? []).map((fila) => {
    const equipo = equipos?.find(
      (eq) => eq.identificador.trim().toLowerCase() === fila.equipoIdentificador.trim().toLowerCase()
    );
    return { ...fila, equipoId: equipo?.id ?? null };
  });

  const filasEmparejadas = filasConMatch.filter((f) => f.equipoId);
  const filasSinEquipo = filasConMatch.filter((f) => !f.equipoId);

  async function cargarProduccion() {
    setEstadoCarga("cargando");
    setMensajeCarga(null);
    let exitosas = 0;
    const errores: string[] = [];

    for (const fila of filasEmparejadas) {
      const { error } = await supabase.rpc("registrar_lectura_horometro_turno", {
        p_id_produccion: fila.idProduccion,
        p_equipo_id: fila.equipoId,
        p_contrato_codigo: fila.contratoCodigo,
        p_fundo_nombre: fila.fundoNombre,
        p_dia_jornada: fila.diaJornada,
        p_horometro_inicio: fila.horometroInicio,
        p_horometro_termino: fila.horometroTermino,
      });
      if (error) {
        errores.push(`${fila.equipoIdentificador} (${fila.diaJornada}): ${error.message}`);
      } else {
        exitosas++;
      }
    }

    if (errores.length > 0) {
      setEstadoCarga("error");
      setMensajeCarga(
        `${exitosas} turnos cargados. ${errores.length} con error:\n${errores.slice(0, 5).join("\n")}` +
          (errores.length > 5 ? `\n… y ${errores.length - 5} más` : "")
      );
    } else {
      setEstadoCarga("listo");
      setMensajeCarga(`${exitosas} turnos cargados correctamente.`);
    }
    cargarTablaProduccion();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Producción / horómetro por turno</h1>
      <p className="mt-2 text-neutral-600">
        Sube el reporte de producción (tarja) exportado del sistema. Se toma el equipo, la línea de negocio
        (contrato), el fundo y el horómetro de inicio/término de cada turno para mantener actualizado el
        horómetro de cada equipo y alimentar el plan de mantenimiento.
      </p>

      {errorEquipos && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          No se pudo cargar la lista de equipos desde Supabase: {errorEquipos}
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-medium">Turnos cargados</h2>
        {cargandoTabla ? (
          <p className="mt-2 text-sm text-neutral-500">Cargando…</p>
        ) : cargadas.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Todavía no hay turnos cargados.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-neutral-500">
              Mostrando los {cargadas.length} más recientes de {totalCargadas} en total.
            </p>
            <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-neutral-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Equipo</th>
                    <th className="px-3 py-2 font-medium">Contrato</th>
                    <th className="px-3 py-2 font-medium">Fundo</th>
                    <th className="px-3 py-2 font-medium">Día jornada</th>
                    <th className="px-3 py-2 font-medium">Horómetro inicio</th>
                    <th className="px-3 py-2 font-medium">Horómetro término</th>
                  </tr>
                </thead>
                <tbody>
                  {cargadas.map((t) => (
                    <tr key={t.id} className="border-t border-neutral-100">
                      <td className="px-3 py-1.5">{t.equipos?.identificador ?? "—"}</td>
                      <td className="px-3 py-1.5">{t.contratos?.codigo ?? "—"}</td>
                      <td className="px-3 py-1.5">{t.fundos?.nombre ?? "—"}</td>
                      <td className="px-3 py-1.5">{t.dia_jornada}</td>
                      <td className="px-3 py-1.5">{t.horometro_inicio ?? "—"}</td>
                      <td className="px-3 py-1.5">{t.horometro_termino ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Subir nuevo archivo</h2>
        <div className="mt-4">
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50">
            <span>Seleccionar archivo (.xls)</span>
            <input type="file" accept=".xls,.html,.htm" className="hidden" onChange={onArchivoSeleccionado} />
          </label>
          {nombreArchivo && <p className="mt-1 text-xs text-neutral-500">{nombreArchivo}</p>}
        </div>

      {resultado && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-neutral-600">{filasEmparejadas.length} turnos con equipo encontrado</span>
            <span className="text-amber-700">{filasSinEquipo.length} sin equipo encontrado</span>
            <span className="text-red-700">{resultado.filasConError.length} filas con error de parseo</span>
          </div>

          {filasConMatch.length > 0 && (
            <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-neutral-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Equipo</th>
                    <th className="px-3 py-2 font-medium">Contrato</th>
                    <th className="px-3 py-2 font-medium">Fundo</th>
                    <th className="px-3 py-2 font-medium">Día jornada</th>
                    <th className="px-3 py-2 font-medium">Horómetro inicio</th>
                    <th className="px-3 py-2 font-medium">Horómetro término</th>
                  </tr>
                </thead>
                <tbody>
                  {filasConMatch.slice(0, 200).map((f, i) => (
                    <tr key={i} className="border-t border-neutral-100">
                      <td className="px-3 py-1.5">
                        {f.equipoIdentificador}{" "}
                        {!f.equipoId && <span className="text-amber-700">(no encontrado)</span>}
                      </td>
                      <td className="px-3 py-1.5">{f.contratoCodigo ?? "—"}</td>
                      <td className="px-3 py-1.5">{f.fundoNombre ?? "—"}</td>
                      <td className="px-3 py-1.5">{f.diaJornada}</td>
                      <td className="px-3 py-1.5">{f.horometroInicio ?? "—"}</td>
                      <td className="px-3 py-1.5">{f.horometroTermino ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filasConMatch.length > 200 && (
                <p className="px-3 py-2 text-xs text-neutral-500">Mostrando 200 de {filasConMatch.length} filas.</p>
              )}
            </div>
          )}

          {resultado.filasConError.length > 0 && (
            <details className="mt-3 text-sm text-red-700">
              <summary className="cursor-pointer">Ver {resultado.filasConError.length} filas con error de parseo</summary>
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
              onClick={cargarProduccion}
              disabled={estadoCarga === "cargando"}
              className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {estadoCarga === "cargando" ? "Cargando…" : `Cargar ${filasEmparejadas.length} turnos a Supabase`}
            </button>
          )}

          {mensajeCarga && (
            <pre
              className={`mt-3 whitespace-pre-wrap rounded-md px-4 py-3 text-sm ${
                estadoCarga === "error"
                  ? "border border-amber-200 bg-amber-50 text-amber-800"
                  : "border border-green-200 bg-green-50 text-green-800"
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
