import Papa from "papaparse";
import { leerXlsxPrimeraHoja } from "./xlsx";

export type DealerFormato = "john_deere" | "cat_finning" | "tigercat" | "develon";

export const NOMBRE_FORMATO: Record<DealerFormato, string> = {
  john_deere: "John Deere (JDLink)",
  cat_finning: "Caterpillar / Finning (VisionLink)",
  tigercat: "Tigercat",
  develon: "Develon (Doosan)",
};

export type UbicacionParseada = {
  identificador: string;
  lat: number;
  lon: number;
  momento: string | null;
  horometro: number | null;
  advertencia?: string;
};

export type FilaConError = {
  fila: number;
  motivo: string;
};

export type ResultadoParseo = {
  formato: DealerFormato | null;
  filas: UbicacionParseada[];
  filasConError: FilaConError[];
};

const MESES_ES: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11,
};

function dmsADecimal(deg: number, min: number, sec: number, hemisferio: string): number {
  const valor = deg + min / 60 + sec / 3600;
  return hemisferio === "S" || hemisferio === "W" ? -valor : valor;
}

/**
 * Extrae coordenadas de un texto libre, soportando GMS ("38°26'16.8\" S 73°11'34.2\" W")
 * y decimal separado por "/" o "," ("-38.38225 / -73.19851").
 */
export function extraerCoordenadas(texto: string | null | undefined): { lat: number; lon: number } | null {
  if (!texto) return null;
  const limpio = texto.trim();

  const dms = limpio.match(
    /(\d{1,3})[°]\s*(\d{1,2})['’]\s*([\d.]+)["”]?\s*([NS])[,\s]+(\d{1,3})[°]\s*(\d{1,2})['’]\s*([\d.]+)["”]?\s*([EW])/i
  );
  if (dms) {
    const lat = dmsADecimal(+dms[1], +dms[2], +dms[3], dms[4].toUpperCase());
    const lon = dmsADecimal(+dms[5], +dms[6], +dms[7], dms[8].toUpperCase());
    return coordenadaValida(lat, lon) ? { lat, lon } : null;
  }

  const decimal = limpio.match(/(-?\d{1,3}\.\d+)\s*[/,]\s*(-?\d{1,3}\.\d+)/);
  if (decimal) {
    const lat = parseFloat(decimal[1]);
    const lon = parseFloat(decimal[2]);
    return coordenadaValida(lat, lon) ? { lat, lon } : null;
  }

  return null;
}

function coordenadaValida(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/** Convierte fecha+hora a ISO. No se conoce con certeza la zona horaria de origen de cada
 * plataforma; se toma el valor tal cual lo entrega el dealer, sin desplazar por huso horario. */
function fechaHoraAIso(anio: number, mes0: number, dia: number, hora: number, min: number, seg = 0): string | null {
  const d = new Date(Date.UTC(anio, mes0, dia, hora, min, seg));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parsearFechaHoraJohnDeere(fecha: string, tiempo: string): string | null {
  const m = fecha.trim().toLowerCase().match(/^(\d{1,2})-([a-záéíóú]{3})-(\d{2})$/);
  if (!m) return null;
  const mes = MESES_ES[m[2]];
  if (mes === undefined) return null;
  const [h, min] = tiempo.trim().split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return fechaHoraAIso(2000 + +m[3], mes, +m[1], h, min);
}

function parsearFechaHoraTigercat(texto: string): string | null {
  const m = texto.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  return fechaHoraAIso(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

function parsearFechaHoraDdMmYyyy(texto: string): string | null {
  const m = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return fechaHoraAIso(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], m[6] ? +m[6] : 0);
}

function normalizarNumero(texto: unknown): number | null {
  if (texto === null || texto === undefined) return null;
  const s = String(texto).trim();
  if (!s || s === "---" || s.toLowerCase() === "n/a") return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function leerCsv(texto: string): { filas: Record<string, string>[]; encabezados: string[] } {
  const { data, meta } = Papa.parse<Record<string, string>>(texto, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return { filas: data, encabezados: meta.fields ?? [] };
}

export function detectarFormatoPorEncabezados(encabezados: string[]): DealerFormato | null {
  const h = new Set(encabezados.map((x) => x.trim().toLowerCase()));
  if (h.has("número de serie de la máquina") && h.has("alías")) return "john_deere";
  if (h.has("id del activo") && h.has("nombre de la marca")) return "cat_finning";
  if (h.has("nombre de la máquina") && h.has("duración total del turno")) return "tigercat";
  if (h.has("apodo") && [...h].some((x) => x.startsWith("ubicación reciente"))) return "develon";
  return null;
}

function parsearJohnDeere(filas: Record<string, string>[]): ResultadoParseo {
  const resultado: ResultadoParseo = { formato: "john_deere", filas: [], filasConError: [] };
  filas.forEach((fila, i) => {
    const identificador = fila["Alías"]?.trim();
    const lat = normalizarNumero(fila["Latitud"]);
    const lon = normalizarNumero(fila["Longitud"]);
    if (!identificador || lat === null || lon === null) {
      resultado.filasConError.push({ fila: i + 2, motivo: "Falta alias o coordenadas" });
      return;
    }
    const momento = parsearFechaHoraJohnDeere(fila["Fecha"] ?? "", fila["Tiempo"] ?? "");
    resultado.filas.push({
      identificador,
      lat,
      lon,
      momento,
      horometro: normalizarNumero(fila["Horas de trabajo del motor"]),
      advertencia: momento ? undefined : "No se pudo interpretar fecha/hora",
    });
  });
  return resultado;
}

function parsearTigercat(filas: Record<string, unknown>[]): ResultadoParseo {
  const resultado: ResultadoParseo = { formato: "tigercat", filas: [], filasConError: [] };
  filas.forEach((fila, i) => {
    const identificador = String(fila["Nombre de la máquina"] ?? "").trim();
    const coords = extraerCoordenadas(String(fila["Ubicación"] ?? ""));
    if (!identificador || !coords) {
      resultado.filasConError.push({ fila: i + 2, motivo: "Falta identificador o no se pudo leer la coordenada" });
      return;
    }
    const inicioTurno = String(fila["Hora de inicio del turno"] ?? "");
    const momento = parsearFechaHoraTigercat(inicioTurno);
    resultado.filas.push({
      identificador,
      lat: coords.lat,
      lon: coords.lon,
      momento,
      horometro: null,
      advertencia: "Tigercat no informa hora exacta de la ubicación; se usó el inicio de turno como referencia",
    });
  });
  return resultado;
}

function parsearDevelon(filas: Record<string, unknown>[]): ResultadoParseo {
  const resultado: ResultadoParseo = { formato: "develon", filas: [], filasConError: [] };
  const claveUbicacion = Object.keys(filas[0] ?? {}).find((k) => k.toLowerCase().startsWith("ubicación reciente"));
  filas.forEach((fila, i) => {
    const identificador = String(fila["Apodo"] ?? "").trim();
    const coords = extraerCoordenadas(claveUbicacion ? String(fila[claveUbicacion] ?? "") : "");
    if (!identificador || !coords) {
      resultado.filasConError.push({ fila: i + 2, motivo: "Falta apodo o no se pudo leer la coordenada" });
      return;
    }
    const ultimoInforme = String(fila["Último informe (hora local)"] ?? "");
    resultado.filas.push({
      identificador,
      lat: coords.lat,
      lon: coords.lon,
      momento: parsearFechaHoraDdMmYyyy(ultimoInforme),
      horometro: normalizarNumero(fila["Ópera total. Hora (horas)"]),
    });
  });
  return resultado;
}

function parsearCatFinning(filas: Record<string, string>[]): ResultadoParseo {
  const resultado: ResultadoParseo = { formato: "cat_finning", filas: [], filasConError: [] };
  filas.forEach((fila, i) => {
    const identificador = (fila["Número de serie del activo"] ?? fila["ID del activo"] ?? "").trim();
    const textoUbicacion = fila["Ubicación"] || fila["Última ubicación conocida"] || "";
    const coords = extraerCoordenadas(textoUbicacion);
    if (!identificador || !coords) {
      resultado.filasConError.push({
        fila: i + 2,
        motivo: "Falta identificador o no se pudo leer la coordenada (formato Cat/Finning aún no validado con datos reales)",
      });
      return;
    }
    const horaInforme = fila["Última hora informada de la ubicación"] ?? "";
    resultado.filas.push({
      identificador,
      lat: coords.lat,
      lon: coords.lon,
      momento: parsearFechaHoraDdMmYyyy(horaInforme),
      horometro: normalizarNumero(fila["Horómetro"] ?? fila["Último horómetro conocido"]),
      advertencia: "Formato Cat/Finning parseado de forma genérica: revisa el preview con cuidado",
    });
  });
  return resultado;
}

export async function parsearArchivoUbicaciones(archivo: File): Promise<ResultadoParseo> {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith(".csv")) {
    const texto = await archivo.text();
    const { filas, encabezados } = leerCsv(texto);
    const formato = detectarFormatoPorEncabezados(encabezados);
    if (formato === "john_deere") return parsearJohnDeere(filas);
    if (formato === "cat_finning") return parsearCatFinning(filas);
    return { formato, filas: [], filasConError: [{ fila: 0, motivo: "No se reconoció el formato del CSV" }] };
  }

  if (nombre.endsWith(".xlsx")) {
    const buffer = await archivo.arrayBuffer();
    const filas = await leerXlsxPrimeraHoja(buffer);
    const encabezados = filas.length > 0 ? Object.keys(filas[0]) : [];
    const formato = detectarFormatoPorEncabezados(encabezados);
    if (formato === "tigercat") return parsearTigercat(filas);
    if (formato === "develon") return parsearDevelon(filas);
    return { formato, filas: [], filasConError: [{ fila: 0, motivo: "No se reconoció el formato del Excel" }] };
  }

  return { formato: null, filas: [], filasConError: [{ fila: 0, motivo: "Formato de archivo no soportado (usa .csv o .xlsx)" }] };
}
