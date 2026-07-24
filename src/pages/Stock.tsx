import { useCallback, useMemo, useState } from "react";
import { Upload, Warehouse } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { parsearArchivoStock, type ResultadoParseoStock } from "../lib/stock";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import SearchInput from "../components/ui/SearchInput";
import Button from "../components/ui/Button";

type EstadoCarga = "idle" | "cargando" | "listo" | "error";

export default function Stock() {
  const [resultado, setResultado] = useState<ResultadoParseoStock | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("idle");
  const [mensajeCarga, setMensajeCarga] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const onArchivoSeleccionado = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setNombreArchivo(archivo.name);
    setEstadoCarga("idle");
    setMensajeCarga(null);
    setResultado(await parsearArchivoStock(archivo));
  }, []);

  const filasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const filas = resultado?.filas ?? [];
    if (!texto) return filas;
    return filas.filter(
      (f) =>
        f.descripcion.toLowerCase().includes(texto) ||
        f.codigoPieza.toLowerCase().includes(texto) ||
        f.bodegaNombre.toLowerCase().includes(texto)
    );
  }, [resultado, busqueda]);

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
    <div className="space-y-8">
      <PageHeader
        icon={<Warehouse className="size-5" />}
        title="Stock de bodega"
        description="Sube la planilla de stock (.xlsx). Se crean automáticamente los insumos y bodegas que no existan, y se actualiza la cantidad de cada artículo — subir el mismo archivo de nuevo actualiza en vez de duplicar."
      />

      <div>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm hover:border-pine-400 hover:bg-pine-50/40">
          <Upload className="size-4 text-pine-700" />
          <span>Seleccionar archivo (.xlsx)</span>
          <input type="file" accept=".xlsx" className="hidden" onChange={onArchivoSeleccionado} />
        </label>
        {nombreArchivo && <p className="mt-1.5 text-xs text-neutral-500">{nombreArchivo}</p>}
      </div>

      {resultado && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{resultado.filas.length} ítems listos para cargar</Badge>
              {resultado.filasConError.length > 0 && (
                <Badge tone="danger">{resultado.filasConError.length} filas con error de parseo</Badge>
              )}
            </div>
            {resultado.filas.length > 0 && (
              <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Filtrar por artículo o bodega…" className="w-72" />
            )}
          </div>

          {resultado.filas.length > 0 && (
            <Card className="mt-4 max-h-96 overflow-auto">
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
                  {filasFiltradas.slice(0, 200).map((f, i) => (
                    <tr key={i} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                      <td className="px-3 py-1.5">{f.bodegaNombre}</td>
                      <td className="px-3 py-1.5 font-medium text-neutral-800">{f.codigoPieza}</td>
                      <td className="px-3 py-1.5">{f.descripcion}</td>
                      <td className="px-3 py-1.5">{f.linea ?? "—"}</td>
                      <td className="px-3 py-1.5 tabular-nums">{f.cantidad}</td>
                      <td className="px-3 py-1.5 tabular-nums">{f.costoUnitario ?? "—"}</td>
                      <td className="px-3 py-1.5">{f.ubicacion ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filasFiltradas.length > 200 && (
                <p className="px-3 py-2 text-xs text-neutral-500">Mostrando 200 de {filasFiltradas.length} filas.</p>
              )}
            </Card>
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
            <Button
              onClick={cargarStock}
              loading={estadoCarga === "cargando"}
              icon={<Upload className="size-4" />}
              className="mt-4"
            >
              Cargar {resultado.filas.length} ítems a Supabase
            </Button>
          )}

          {mensajeCarga && (
            <pre
              className={`mt-3 whitespace-pre-wrap rounded-lg px-4 py-3 text-sm ${
                estadoCarga === "error"
                  ? "border border-amber-200 bg-amber-50 text-amber-800"
                  : "border border-pine-200 bg-pine-50 text-pine-800"
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
