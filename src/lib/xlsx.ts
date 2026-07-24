import ExcelJS from "exceljs";

export async function leerXlsxPrimeraHoja(buffer: ArrayBuffer): Promise<Record<string, unknown>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  const filas: Record<string, unknown>[] = [];
  const encabezados: string[] = [];
  ws.eachRow((row, numeroFila) => {
    const valores = (row.values as unknown[]).slice(1);
    if (numeroFila === 1) {
      valores.forEach((v) => encabezados.push(String(v ?? "").trim()));
      return;
    }
    const fila: Record<string, unknown> = {};
    encabezados.forEach((enc, i) => {
      fila[enc] = valores[i] ?? null;
    });
    filas.push(fila);
  });
  return filas;
}
