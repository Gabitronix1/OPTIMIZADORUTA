"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Contrato = {
  id: string;
  codigo: string;
  cliente: string | null;
  fundos: { nombre: string } | null;
};

type Equipo = {
  id: string;
  identificador: string;
  tipo: string;
  estado: string;
  contrato_id: string | null;
};

const ESTADOS = ["operativo", "mantencion", "traslado", "detenido"] as const;

const estadoEstilo: Record<string, string> = {
  operativo: "bg-green-100 text-green-700",
  mantencion: "bg-tierra-400/20 text-tierra-600",
  traslado: "bg-blue-100 text-blue-700",
  detenido: "bg-red-100 text-red-700",
};

export default function EquiposPage() {
  const [contratos, setContratos] = useState<Contrato[] | null>(null);
  const [equipos, setEquipos] = useState<Equipo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  async function cargar() {
    const [{ data: c, error: ec }, { data: e, error: ee }] = await Promise.all([
      supabase
        .from("contratos")
        .select("id, codigo, cliente, fundos ( nombre )")
        .order("codigo"),
      supabase
        .from("equipos")
        .select("id, identificador, tipo, estado, contrato_id")
        .order("identificador"),
    ]);

    if (ec || ee) {
      setError((ec ?? ee)?.message ?? "Error desconocido");
      return;
    }
    setContratos(c as unknown as Contrato[]);
    setEquipos(e as unknown as Equipo[]);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function actualizarEquipo(
    id: string,
    cambios: Partial<Pick<Equipo, "contrato_id" | "estado">>
  ) {
    setGuardandoId(id);
    // Optimista: refleja el cambio de inmediato en pantalla
    setEquipos((prev) =>
      prev ? prev.map((eq) => (eq.id === id ? { ...eq, ...cambios } : eq)) : prev
    );
    const { error } = await supabase.from("equipos").update(cambios).eq("id", id);
    if (error) setError(error.message);
    setGuardandoId(null);
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        No se pudo cargar: {error}
      </div>
    );
  }

  if (!contratos || !equipos) {
    return <p className="text-sm text-bosque-700">Cargando…</p>;
  }

  const sinAsignar = equipos.filter((e) => !e.contrato_id);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl text-bosque-900">
        Contratos y equipos
      </h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {contratos.map((contrato) => {
          const asignados = equipos.filter((e) => e.contrato_id === contrato.id);
          return (
            <div
              key={contrato.id}
              className="rounded-lg border border-bosque-100 bg-white p-4"
            >
              <div className="mb-3 border-b border-bosque-100 pb-2">
                <p className="font-display text-base text-bosque-900">
                  {contrato.codigo}{" "}
                  <span className="font-sans text-sm text-bosque-700">
                    · {contrato.fundos?.nombre ?? "sin fundo"}
                  </span>
                </p>
                {contrato.cliente && (
                  <p className="text-xs text-bosque-700">{contrato.cliente}</p>
                )}
              </div>

              {asignados.length === 0 && (
                <p className="text-xs text-bosque-700">Sin equipos asignados.</p>
              )}

              <ul className="flex flex-col gap-2">
                {asignados.map((eq) => (
                  <li
                    key={eq.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-bosque-50 px-2 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-bosque-900">
                        {eq.identificador}
                      </p>
                      <p className="text-xs text-bosque-700">{eq.tipo}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <select
                        value={eq.estado}
                        disabled={guardandoId === eq.id}
                        onChange={(ev) =>
                          actualizarEquipo(eq.id, { estado: ev.target.value })
                        }
                        className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${estadoEstilo[eq.estado]}`}
                      >
                        {ESTADOS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <select
                        value={eq.contrato_id ?? ""}
                        disabled={guardandoId === eq.id}
                        onChange={(ev) =>
                          actualizarEquipo(eq.id, {
                            contrato_id: ev.target.value || null,
                          })
                        }
                        className="rounded-md border border-bosque-100 px-1 py-1 text-xs text-bosque-700"
                        title="Reasignar contrato"
                      >
                        <option value="">Sin asignar</option>
                        {contratos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.codigo}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {sinAsignar.length > 0 && (
          <div className="rounded-lg border border-dashed border-bosque-100 bg-white p-4">
            <p className="mb-3 border-b border-bosque-100 pb-2 font-display text-base text-bosque-900">
              Sin asignar
            </p>
            <ul className="flex flex-col gap-2">
              {sinAsignar.map((eq) => (
                <li
                  key={eq.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-bosque-50 px-2 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-bosque-900">
                      {eq.identificador}
                    </p>
                    <p className="text-xs text-bosque-700">{eq.tipo}</p>
                  </div>
                  <select
                    value=""
                    disabled={guardandoId === eq.id}
                    onChange={(ev) =>
                      actualizarEquipo(eq.id, { contrato_id: ev.target.value || null })
                    }
                    className="rounded-md border border-bosque-100 px-1 py-1 text-xs text-bosque-700"
                  >
                    <option value="">Asignar a…</option>
                    {contratos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codigo}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
