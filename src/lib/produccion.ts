export type TurnoParseado = {
  idProduccion: number;
  equipoIdentificador: string;
  contratoCodigo: string | null;
  fundoNombre: string | null;
  diaJornada: string;
  horometroInicio: number | null;
  horometroTermino: number | null;
};

export type ResultadoParseoProduccion = {
  filas: TurnoParseado[];
  filasConError: { fila: number; motivo: string }[];
};

const COLUMNAS_REQUERIDAS = [
  "ID PRODUCCIÓN",
  "EQUIPO",
  "LÍNEA DE NEGOCIO",
  "FUNDO",
  "DÍA JORNADA",
  "HORÓMETRO DE INICIO",
  "HORÓMETRO DE TÉRMINO",
] as const;

function normalizarNumero(texto: string | undefined): number | null {
  if (texto === undefined) return null;
  const s = texto.trim();
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizarTexto(texto: string | undefined): string | null {
  const s = texto?.trim();
  return s ? s : null;
}

/** El "reporte de producción" se exporta como HTML con extensión .xls, no como un Excel real. */
export function parsearReporteProduccion(html: string): ResultadoParseoProduccion {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const filasHtml = Array.from(doc.querySelectorAll("table tr"));
  if (filasHtml.length < 2) {
    return { filas: [], filasConError: [{ fila: 0, motivo: "No se encontró una tabla en el archivo" }] };
  }

  const filaEncabezado = filasHtml.find((tr) => tr.querySelectorAll("th").length > 1);
  if (!filaEncabezado) {
    return { filas: [], filasConError: [{ fila: 0, motivo: "No se encontró la fila de encabezados" }] };
  }
  const encabezados = Array.from(filaEncabezado.querySelectorAll("th")).map((th) => th.textContent?.trim() ?? "");

  const faltantes = COLUMNAS_REQUERIDAS.filter((c) => !encabezados.includes(c));
  if (faltantes.length > 0) {
    return {
      filas: [],
      filasConError: [{ fila: 0, motivo: `Faltan columnas esperadas: ${faltantes.join(", ")}` }],
    };
  }

  const indice = (nombre: string) => encabezados.indexOf(nombre);
  const idxIdProduccion = indice("ID PRODUCCIÓN");
  const idxEquipo = indice("EQUIPO");
  const idxContrato = indice("LÍNEA DE NEGOCIO");
  const idxFundo = indice("FUNDO");
  const idxDia = indice("DÍA JORNADA");
  const idxHorometroInicio = indice("HORÓMETRO DE INICIO");
  const idxHorometroTermino = indice("HORÓMETRO DE TÉRMINO");

  const filasDatos = filasHtml.filter((tr) => tr.querySelectorAll("td").length > 1);

  const resultado: ResultadoParseoProduccion = { filas: [], filasConError: [] };

  filasDatos.forEach((tr, i) => {
    const celdas = Array.from(tr.querySelectorAll("td")).map((td) => td.textContent ?? "");
    const idProduccion = normalizarNumero(celdas[idxIdProduccion]);
    const equipoIdentificador = normalizarTexto(celdas[idxEquipo]);
    const diaJornada = normalizarTexto(celdas[idxDia]);

    if (idProduccion === null || !equipoIdentificador || !diaJornada) {
      resultado.filasConError.push({ fila: i + 1, motivo: "Falta ID de producción, equipo o fecha de jornada" });
      return;
    }

    resultado.filas.push({
      idProduccion,
      equipoIdentificador,
      contratoCodigo: normalizarTexto(celdas[idxContrato]),
      fundoNombre: normalizarTexto(celdas[idxFundo]),
      diaJornada,
      horometroInicio: normalizarNumero(celdas[idxHorometroInicio]),
      horometroTermino: normalizarNumero(celdas[idxHorometroTermino]),
    });
  });

  return resultado;
}
