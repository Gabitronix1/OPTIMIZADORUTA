import { leerXlsxPrimeraHoja } from "./xlsx";

export type StockItemParseado = {
  bodegaNombre: string;
  codigoPieza: string;
  descripcion: string;
  linea: string | null;
  costoUnitario: number | null;
  cantidad: number;
  ubicacion: string | null;
};

export type ResultadoParseoStock = {
  filas: StockItemParseado[];
  filasConError: { fila: number; motivo: string }[];
};

function normalizarNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  const n = typeof valor === "number" ? valor : parseFloat(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizarTexto(valor: unknown): string | null {
  const s = valor === null || valor === undefined ? "" : String(valor).trim();
  return s ? s : null;
}

export async function parsearArchivoStock(archivo: File): Promise<ResultadoParseoStock> {
  const buffer = await archivo.arrayBuffer();
  const filas = await leerXlsxPrimeraHoja(buffer);
  const resultado: ResultadoParseoStock = { filas: [], filasConError: [] };

  filas.forEach((fila, i) => {
    const bodegaNombre = normalizarTexto(fila["Almacén"]);
    const codigoPieza = normalizarTexto(fila["Articulo"]);
    const descripcion = normalizarTexto(fila["Descripción del artículo"]);
    if (!bodegaNombre || !codigoPieza || !descripcion) {
      resultado.filasConError.push({ fila: i + 2, motivo: "Falta almacén, artículo o descripción" });
      return;
    }

    const costo = normalizarNumero(fila["Costo"]);
    const costoTotal = normalizarNumero(fila["Costo Total"]);
    const cantidad = costo && costo > 0 && costoTotal !== null ? Math.round(costoTotal / costo) : 0;

    resultado.filas.push({
      bodegaNombre,
      codigoPieza,
      descripcion,
      linea: normalizarTexto(fila["Linea"]),
      costoUnitario: costo,
      cantidad,
      ubicacion: normalizarTexto(fila["UBICACION"]),
    });
  });

  return resultado;
}
