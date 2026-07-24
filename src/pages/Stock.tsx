import { useCallback, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { parsearArchivoStock, type ResultadoParseoStock } from "../lib/stock";

type EstadoCarga = "idle" | "cargando" | "listo" | "error";

export default function Stock() {
  const [resultado, setResultado] = useState<ResultadoParseoStock | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("idle");
  const [mensajeCarga, setMensajeCarga] = useState<string | null>(null);

  const onArchivoSeleccionado = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setNombreArchivo(archivo.name);
    setEstadoCarga("idle");
    setMensajeCarga(null);
    setResultado(await parsearArchivoStock(archivo));
  }, []);

  async function cargarStock() {
    if (!resultado) return;
    setEstadoCarga("cargando");
    setMensajeCarga(null);
    let exitosas = 0;
    const errores: string[] = [];

    for (const item of resultado.filas) {
      const { error } = await supabase.rpc("registrar_stock_insumo", {
        p_bodega_nombre: item.bodegaNombre,
        p_codigo_pieza: item.codigoPieza,
        p_nombre_insumo: item.descripcion,
        p_categoria: item.linea,
        p_cantidad: item.cantidad,
        p_costo_unitario: item.costoUnitario,
        p_ubicacion: item.ubicacion,
      });
      if (error) {
        errores.push(`${item.codigoPieza}: ${error.message}`);
      } else {
        exitosas++;
      }
    }

    if (errores.length > 0) {
      setEstadoCarga("error");
      setMensajeCarga(
        `${exitosas} ítems cargados. ${errores.length} con error:\n${errores.slice(0, 5).join("\n")}` +
          (errores.length > 5 ? `\n… y ${errores.length - 5} más` : "")
      );
    } else {
      setEstadoCarga("listo");
      setMensajeCarga(`${exitosas} ítems de stock cargados correctamente.`);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Stock de bodega</h1>
      <p className="mt-2 text-neutral-600">
        Sube la planilla de stock (.xlsx). Se crean automáticamente los insumos y bodegas que no existan, y
        se actualiza la cantidad de cada artículo — subir el mismo archivo de nuevo actualiza en vez de
        duplicar.
      </p>

      <div className="mt-4">
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50">
          <span>Seleccionar archivo (.xlsx)</span>
          <input type="file" accept=".xlsx" className="hidden" onChange={onArchivoSeleccionado} />
        </label>
        {nombreArchivo && <p className="mt-1 text-xs text-neutral-500">{nombreArchivo}</p>}
      </div>

      {resultado && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-neutral-600">{resultado.filas.length} ítems listos para cargar</span>
            <span className="text-red-700">{resultado.filasConError.length} filas con error de parseo</span>
          </div>

          {resultado.filas.length > 0 && (
            <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-neutral-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Almacén</th>
                    <th className="px-3 py-2 font-medium">Artículo</th>
                    <th className="px-3 py-2 font-medium">Descripción</th>
                    <th className="px-3 py-2 font-medium">Línea</th>
                    <th className="px-3 py-2 font-medium">Cantidad</th>
                    <th className="px-3 py-2 font-medium">Costo unit.</th>
                    <th className="px-3 py-2 font-medium">Ubicación</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.filas.slice(0, 200).map((f, i) => (
                    <tr key={i} className="border-t border-neutral-100">
                      <td className="px-3 py-1.5">{f.bodegaNombre}</td>
                      <td className="px-3 py-1.5">{f.codigoPieza}</td>
                      <td className="px-3 py-1.5">{f.descripcion}</td>
                      <td className="px-3 py-1.5">{f.linea ?? "—"}</td>
                      <td className="px-3 py-1.5">{f.cantidad}</td>
                      <td className="px-3 py-1.5">{f.costoUnitario ?? "—"}</td>
                      <td className="px-3 py-1.5">{f.ubicacion ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {resultado.filas.length > 200 && (
                <p className="px-3 py-2 text-xs text-neutral-500">Mostrando 200 de {resultado.filas.length} filas.</p>
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

          {resultado.filas.length > 0 && (
            <button
              type="button"
              onClick={cargarStock}
              disabled={estadoCarga === "cargando"}
              className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {estadoCarga === "cargando" ? "Cargando…" : `Cargar ${resultado.filas.length} ítems a Supabase`}
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
    </div>
  );
}
