import { Fragment, useEffect, useMemo, useState } from "react";
import { Filter, Pencil, Plus, Save, Tractor, TriangleAlert, X } from "lucide-react";
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
  maquina_base_id: string | null;
  contratos: { codigo: string } | null;
};

const ESTADOS: Estado[] = ["operativo", "mantencion", "traslado", "detenido"];

const TONO_ESTADO: Record<Estado, "success" | "warning" | "info" | "danger"> = {
  operativo: "success",
  mantencion: "warning",
  traslado: "info",
  detenido: "danger",
};

const FORM_VACIO = {
  identificador: "",
  tipo: "",
  estado: "operativo" as Estado,
  contrato_id: "",
  maquina_base_id: "",
};

export default function Equipos() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [contratoFiltro, setContratoFiltro] = useState("");

  async function cargarEquipos() {
    setCargando(true);
    const { data, error } = await supabase
      .from("equipos")
      .select(
        "id, identificador, tipo, estado, contrato_id, horometro_actual, horometro_actualizado_at, maquina_base_id, contratos(codigo)"
      )
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
      maquina_base_id: eq.maquina_base_id ?? "",
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
            maquina_base_id: form.maquina_base_id || null,
          })
          .eq("id", editandoId)
      : await supabase.from("equipos").insert({
          identificador: form.identificador.trim(),
          tipo: form.tipo.trim() || null,
          estado: form.estado,
          contrato_id: form.contrato_id || null,
          maquina_base_id: form.maquina_base_id || null,
        });

    setGuardando(false);
    if (error) {
      setError(error.message);
      return;
    }
    cancelarEdicion();
    cargarEquipos();
  }

  const equiposFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return equipos.filter((eq) => {
      const coincideTexto =
        !texto ||
        eq.identificador.toLowerCase().includes(texto) ||
        (eq.tipo ?? "").toLowerCase().includes(texto) ||
        (eq.contratos?.codigo ?? "").toLowerCase().includes(texto);
      const coincideContrato = !contratoFiltro || eq.contrato_id === contratoFiltro;
      return coincideTexto && coincideContrato;
    });
  }, [equipos, busqueda, contratoFiltro]);

  const identificadorPorId = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const eq of equipos) mapa.set(eq.id, eq.identificador);
    return mapa;
  }, [equipos]);

  const gruposEquipos = useMemo(() => {
    const mapa = new Map<string, { contratoId: string | null; codigo: string; equipos: Equipo[] }>();
    for (const eq of equiposFiltrados) {
      const key = eq.contrato_id ?? "sin-contrato";
      const codigo = eq.contratos?.codigo ?? "Sin contrato";
      if (!mapa.has(key)) mapa.set(key, { contratoId: eq.contrato_id, codigo, equipos: [] });
      mapa.get(key)!.equipos.push(eq);
    }
    return Array.from(mapa.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [equiposFiltrados]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Tractor className="size-5" />}
        title="Equipos"
        description="Maquinaria de la flota forestal. El horómetro se actualiza automáticamente al subir datos en Ubicaciones o Producción, así que no es editable aquí. Si un cabezal (accesorio) está montado sobre otra máquina, márcalo en «Cabezal de»: comparte ubicación y horas de uso con su máquina base, pero mantiene su propio plan de mantenimiento e insumos."
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
            Identificador
            <Input
              type="text"
              required
              disabled={!!editandoId}
              value={form.identificador}
              onChange={(e) => setForm({ ...form, identificador: e.target.value })}
              className="mt-1.5"
            />
          </label>
          <label className="text-sm font-medium text-neutral-700">
            Tipo
            <Input
              type="text"
              placeholder="procesador, skidder…"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className="mt-1.5"
            />
          </label>
          <label className="text-sm font-medium text-neutral-700">
            Estado
            <Select
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value as Estado })}
              className="mt-1.5"
            >
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm font-medium text-neutral-700">
            Contrato
            <Select
              value={form.contrato_id}
              onChange={(e) => setForm({ ...form, contrato_id: e.target.value })}
              className="mt-1.5"
            >
              <option value="">Sin contrato</option>
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm font-medium text-neutral-700">
            Cabezal de (opcional)
            <Select
              value={form.maquina_base_id}
              onChange={(e) => setForm({ ...form, maquina_base_id: e.target.value })}
              className="mt-1.5"
            >
              <option value="">No es un cabezal</option>
              {equipos
                .filter((eq) => eq.id !== editandoId && !eq.maquina_base_id)
                .map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.identificador}
                  </option>
                ))}
            </Select>
          </label>

          <div className="col-span-full flex items-center gap-3">
            <Button type="submit" loading={guardando} icon={editandoId ? <Save className="size-4" /> : <Plus className="size-4" />}>
              {editandoId ? "Guardar cambios" : "Agregar equipo"}
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
        {equipos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {contratos.length > 0 && (
              <Select
                value={contratoFiltro}
                onChange={(e) => setContratoFiltro(e.target.value)}
                icon={<Filter className="size-4" />}
                className="w-52"
              >
                <option value="">Todos los contratos</option>
                {contratos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo}
                  </option>
                ))}
              </Select>
            )}
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por identificador o tipo…" className="w-72" />
          </div>
        )}
      </div>

      {cargando ? (
        <Spinner />
      ) : equipos.length === 0 ? (
        <EmptyState icon={<Tractor className="size-8" />}>Aún no hay equipos registrados.</EmptyState>
      ) : (
        <Card className="overflow-auto">
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
              {equiposFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-neutral-500">
                    Ningún equipo coincide con la búsqueda.
                  </td>
                </tr>
              ) : (
                gruposEquipos.map((g) => (
                  <Fragment key={g.contratoId ?? "sin-contrato"}>
                    <tr className="border-t border-neutral-200 bg-neutral-50">
                      <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                        {g.codigo} · {g.equipos.length} equipo{g.equipos.length === 1 ? "" : "s"}
                      </td>
                    </tr>
                    {g.equipos.map((eq) => (
                      <tr key={eq.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-neutral-800">{eq.identificador}</span>
                            {eq.maquina_base_id && (
                              <span title={`Cabezal de ${identificadorPorId.get(eq.maquina_base_id) ?? "—"}`}>
                                <Badge tone="neutral">cabezal</Badge>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5">{eq.tipo ?? "—"}</td>
                        <td className="px-3 py-1.5">
                          <Badge tone={TONO_ESTADO[eq.estado]}>{eq.estado}</Badge>
                        </td>
                        <td className="px-3 py-1.5">{eq.contratos?.codigo ?? "—"}</td>
                        <td className="px-3 py-1.5 tabular-nums">{eq.horometro_actual ?? "—"}</td>
                        <td className="px-3 py-1.5">
                          {eq.horometro_actualizado_at
                            ? new Date(eq.horometro_actualizado_at).toLocaleDateString("es-CL")
                            : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <Button variant="ghost" size="sm" onClick={() => editar(eq)} icon={<Pencil className="size-3.5" />}>
                            Editar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
