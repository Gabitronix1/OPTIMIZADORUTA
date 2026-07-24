import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Estado = "disponible" | "en_ruta" | "mantencion";

type Camioneta = {
  id: string;
  tipo: string | null;
  patente: string;
  autonomia_km: number | null;
  capacidad_carga: number;
  estado: Estado;
};

const ESTADOS: Estado[] = ["disponible", "en_ruta", "mantencion"];

const FORM_VACIO = {
  tipo: "",
  patente: "",
  autonomia_km: "",
  capacidad_carga: "",
  estado: "disponible" as Estado,
};

export default function Flota() {
  const [flota, setFlota] = useState<Camioneta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargarFlota() {
    setCargando(true);
    const { data, error } = await supabase.from("camionetas").select("*").order("patente");
    setCargando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setFlota(data ?? []);
  }

  useEffect(() => {
    cargarFlota();
  }, []);

  function editar(c: Camioneta) {
    setEditandoId(c.id);
    setForm({
      tipo: c.tipo ?? "",
      patente: c.patente,
      autonomia_km: c.autonomia_km?.toString() ?? "",
      capacidad_carga: c.capacidad_carga?.toString() ?? "",
      estado: c.estado,
    });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setForm(FORM_VACIO);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    const payload = {
      tipo: form.tipo.trim() || null,
      patente: form.patente.trim().toUpperCase(),
      autonomia_km: form.autonomia_km ? Number(form.autonomia_km) : null,
      capacidad_carga: Number(form.capacidad_carga),
      estado: form.estado,
    };

    const { error } = editandoId
      ? await supabase.from("camionetas").update(payload).eq("id", editandoId)
      : await supabase.from("camionetas").insert(payload);

    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    cancelarEdicion();
    cargarFlota();
  }

  async function eliminar(id: string) {
    if (!window.confirm("¿Eliminar este vehículo de la flota?")) return;
    const { error } = await supabase.from("camionetas").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    cargarFlota();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Flota</h1>
      <p className="mt-2 text-neutral-600">
        Vehículos de la flota y sus restricciones para la planificación de rutas: autonomía y capacidad de
        carga.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-6 grid max-w-2xl grid-cols-2 gap-4 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-3"
      >
        <label className="text-sm text-neutral-700">
          Tipo
          <input
            type="text"
            placeholder="camioneta"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-neutral-700">
          Patente
          <input
            type="text"
            required
            value={form.patente}
            onChange={(e) => setForm({ ...form, patente: e.target.value })}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-neutral-700">
          Estado
          <select
            value={form.estado}
            onChange={(e) => setForm({ ...form, estado: e.target.value as Estado })}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            {ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-neutral-700">
          Autonomía estanque lleno (km)
          <input
            type="number"
            min="0"
            value={form.autonomia_km}
            onChange={(e) => setForm({ ...form, autonomia_km: e.target.value })}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-neutral-700">
          Capacidad de carga (kg)
          <input
            type="number"
            min="0"
            required
            value={form.capacidad_carga}
            onChange={(e) => setForm({ ...form, capacidad_carga: e.target.value })}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="col-span-2 flex items-end gap-3 sm:col-span-3">
          <button
            type="submit"
            disabled={guardando}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Agregar a la flota"}
          </button>
          {editandoId && (
            <button type="button" onClick={cancelarEdicion} className="text-sm text-neutral-500 underline">
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <div className="mt-6 overflow-auto rounded-lg border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Patente</th>
              <th className="px-3 py-2 font-medium">Autonomía (km)</th>
              <th className="px-3 py-2 font-medium">Capacidad carga (kg)</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-neutral-500">
                  Cargando…
                </td>
              </tr>
            ) : flota.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-neutral-500">
                  Aún no hay vehículos registrados.
                </td>
              </tr>
            ) : (
              flota.map((c) => (
                <tr key={c.id} className="border-t border-neutral-100">
                  <td className="px-3 py-1.5">{c.tipo ?? "—"}</td>
                  <td className="px-3 py-1.5">{c.patente}</td>
                  <td className="px-3 py-1.5">{c.autonomia_km ?? "—"}</td>
                  <td className="px-3 py-1.5">{c.capacidad_carga}</td>
                  <td className="px-3 py-1.5">{c.estado}</td>
                  <td className="px-3 py-1.5 text-right">
                    <button type="button" onClick={() => editar(c)} className="text-blue-600 underline">
                      Editar
                    </button>
                    <button type="button" onClick={() => eliminar(c.id)} className="ml-3 text-red-600 underline">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
