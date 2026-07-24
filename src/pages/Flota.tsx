import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Save, Trash2, Truck, TriangleAlert, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import SearchInput from "../components/ui/SearchInput";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";

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

const TONO_ESTADO: Record<Estado, "success" | "info" | "warning"> = {
  disponible: "success",
  en_ruta: "info",
  mantencion: "warning",
};

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
  const [busqueda, setBusqueda] = useState("");

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

  const flotaFiltrada = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return flota;
    return flota.filter(
      (c) => c.patente.toLowerCase().includes(texto) || (c.tipo ?? "").toLowerCase().includes(texto)
    );
  }, [flota, busqueda]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Truck className="size-5" />}
        title="Flota"
        description="Vehículos de la flota y sus restricciones para la planificación de rutas: autonomía y capacidad de carga."
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <Card className="p-4">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-medium text-neutral-700">
            Tipo
            <Input
              type="text"
              placeholder="camioneta"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className="mt-1.5"
            />
          </label>
          <label className="text-sm font-medium text-neutral-700">
            Patente
            <Input
              type="text"
              required
              value={form.patente}
              onChange={(e) => setForm({ ...form, patente: e.target.value })}
              className="mt-1.5"
            />
          </label>
          <label className="text-sm font-medium text-neutral-700">
            Estado
            <Select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as Estado })} className="mt-1.5">
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm font-medium text-neutral-700">
            Autonomía estanque lleno (km)
            <Input
              type="number"
              min="0"
              value={form.autonomia_km}
              onChange={(e) => setForm({ ...form, autonomia_km: e.target.value })}
              className="mt-1.5"
            />
          </label>
          <label className="text-sm font-medium text-neutral-700">
            Capacidad de carga (kg)
            <Input
              type="number"
              min="0"
              required
              value={form.capacidad_carga}
              onChange={(e) => setForm({ ...form, capacidad_carga: e.target.value })}
              className="mt-1.5"
            />
          </label>

          <div className="col-span-full flex items-center gap-3">
            <Button type="submit" loading={guardando} icon={editandoId ? <Save className="size-4" /> : <Plus className="size-4" />}>
              {editandoId ? "Guardar cambios" : "Agregar a la flota"}
            </Button>
            {editandoId && (
              <Button type="button" variant="secondary" onClick={cancelarEdicion} icon={<X className="size-4" />}>
                Cancelar edición
              </Button>
            )}
          </div>
        </form>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-neutral-900">Listado</h2>
        {flota.length > 0 && (
          <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por patente o tipo…" className="w-72" />
        )}
      </div>

      {cargando ? (
        <Spinner />
      ) : flota.length === 0 ? (
        <EmptyState icon={<Truck className="size-8" />}>Aún no hay vehículos registrados.</EmptyState>
      ) : (
        <Card className="overflow-auto">
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
              {flotaFiltrada.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-neutral-500">
                    Ningún vehículo coincide con la búsqueda.
                  </td>
                </tr>
              ) : (
                flotaFiltrada.map((c) => (
                  <tr key={c.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                    <td className="px-3 py-1.5">{c.tipo ?? "—"}</td>
                    <td className="px-3 py-1.5 font-medium text-neutral-800">{c.patente}</td>
                    <td className="px-3 py-1.5 tabular-nums">{c.autonomia_km ?? "—"}</td>
                    <td className="px-3 py-1.5 tabular-nums">{c.capacidad_carga}</td>
                    <td className="px-3 py-1.5">
                      <Badge tone={TONO_ESTADO[c.estado]}>{c.estado}</Badge>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => editar(c)} icon={<Pencil className="size-3.5" />}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => eliminar(c.id)} icon={<Trash2 className="size-3.5" />} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
