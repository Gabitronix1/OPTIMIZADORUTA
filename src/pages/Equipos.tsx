import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Estado = "operativo" | "mantencion" | "traslado" | "detenido";

type Contrato = { id: string; codigo: string };

type Equipo = {
  id: string;
  identificador: string;
  tipo: string | null;
  estado: Estado;
  contrato_id: string | null;
  horometro_actual: number | null;
  horometro_actualizado_at: string | null;
  contratos: { codigo: string } | null;
};

const ESTADOS: Estado[] = ["operativo", "mantencion", "traslado", "detenido"];

const FORM_VACIO = {
  identificador: "",
  tipo: "",
  estado: "operativo" as Estado,
  contrato_id: "",
};

export default function Equipos() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargarEquipos() {
    setCargando(true);
    const { data, error } = await supabase
      .from("equipos")
      .select("id, identificador, tipo, estado, contrato_id, horometro_actual, horometro_actualizado_at, contratos(codigo)")
      .order("identificador");
    setCargando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEquipos((data ?? []) as unknown as Equipo[]);
  }

  useEffect(() => {
    cargarEquipos();
    supabase
      .from("contratos")
      .select("id, codigo")
      .order("codigo")
      .then(({ data, error }) => {
        if (!error) setContratos(data ?? []);
      });
  }, []);

  function editar(eq: Equipo) {
    setEditandoId(eq.id);
    setForm({
      identificador: eq.identificador,
      tipo: eq.tipo ?? "",
      estado: eq.estado,
      contrato_id: eq.contrato_id ?? "",
    });
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setForm(FORM_VACIO);
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setGuardando(true);

    const { error } = editandoId
      ? await supabase
          .from("equipos")
          .update({
            tipo: form.tipo.trim() || null,
            estado: form.estado,
            contrato_id: form.contrato_id || null,
          })
          .eq("id", editandoId)
      : await supabase.from("equipos").insert({
          identificador: form.identificador.trim(),
          tipo: form.tipo.trim() || null,
          estado: form.estado,
          contrato_id: form.contrato_id || null,
        });

    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    cancelarEdicion();
    cargarEquipos();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Equipos</h1>
      <p className="mt-2 text-neutral-600">
        Maquinaria de la flota forestal. El horómetro se actualiza automáticamente al subir datos en
        Ubicaciones o Producción, así que no es editable aquí.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-6 grid max-w-3xl grid-cols-2 gap-4 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-4"
      >
        <label className="text-sm text-neutral-700">
          Identificador
          <input
            type="text"
            required
            disabled={!!editandoId}
            value={form.identificador}
            onChange={(e) => setForm({ ...form, identificador: e.target.value })}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
          />
        </label>
        <label className="text-sm text-neutral-700">
          Tipo
          <input
            type="text"
            placeholder="procesador, skidder…"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
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
          Contrato
          <select
            value={form.contrato_id}
            onChange={(e) => setForm({ ...form, contrato_id: e.target.value })}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Sin contrato</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo}
              </option>
            ))}
          </select>
        </label>

        <div className="col-span-2 flex items-end gap-3 sm:col-span-4">
          <button
            type="submit"
            disabled={guardando}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Agregar equipo"}
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
              <th className="px-3 py-2 font-medium">Identificador</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Contrato</th>
              <th className="px-3 py-2 font-medium">Horómetro actual</th>
              <th className="px-3 py-2 font-medium">Actualizado</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-neutral-500">
                  Cargando…
                </td>
              </tr>
            ) : equipos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-neutral-500">
                  Aún no hay equipos registrados.
                </td>
              </tr>
            ) : (
              equipos.map((eq) => (
                <tr key={eq.id} className="border-t border-neutral-100">
                  <td className="px-3 py-1.5">{eq.identificador}</td>
                  <td className="px-3 py-1.5">{eq.tipo ?? "—"}</td>
                  <td className="px-3 py-1.5">{eq.estado}</td>
                  <td className="px-3 py-1.5">{eq.contratos?.codigo ?? "—"}</td>
                  <td className="px-3 py-1.5">{eq.horometro_actual ?? "—"}</td>
                  <td className="px-3 py-1.5">
                    {eq.horometro_actualizado_at
                      ? new Date(eq.horometro_actualizado_at).toLocaleDateString("es-CL")
                      : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button type="button" onClick={() => editar(eq)} className="text-blue-600 underline">
                      Editar
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
