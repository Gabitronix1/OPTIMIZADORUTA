export type Punto = { lat: number; lon: number };

export function distanciaKm(a: Punto, b: Punto): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ordena paradas por vecino más cercano: heurística simple, no un solver de VRP. */
export function ordenarPorVecinoMasCercano<T extends Punto>(puntos: T[]): T[] {
  if (puntos.length <= 2) return puntos;
  const restantes = [...puntos];
  const ordenado: T[] = [restantes.shift() as T];
  while (restantes.length > 0) {
    const actual = ordenado[ordenado.length - 1];
    let idxMasCercano = 0;
    let distMin = Infinity;
    restantes.forEach((p, i) => {
      const d = distanciaKm(actual, p);
      if (d < distMin) {
        distMin = d;
        idxMasCercano = i;
      }
    });
    ordenado.push(restantes.splice(idxMasCercano, 1)[0]);
  }
  return ordenado;
}
