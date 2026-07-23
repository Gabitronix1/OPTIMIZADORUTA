"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Pedido = {
  id: string;
  cantidad: number;
  urgencia: "normal" | "alta" | "critica";
  estado: "pendiente" | "planificado" | "entregado" | "cancelado";
  creado_at: string;
  insumos: { nombre: string; unidad_medida: string } | null;
  faenas: { nombre: string } | null;
  equipos: { identificador: string; tipo: string } | null;
};

const urgenciaEstilo: Record<Pedido["urgencia"], string> = {
  normal: "bg-bosque-50 text-bosque-700",
  alta: "bg-tierra-400/20 text-tierra-600",
  critica: "bg-red-100 text-red-700",
};

const estadoEstilo: Record<Pedido["estado"], string> = {
  pendiente: "bg-bosque-100 text-bosque-700",
  planificado: "bg-blue-100 text-blue-700",
  entregado: "bg-green-100 text-green-700",
  cancelado: "bg-gray-100 text-gray-500",
};

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      const { data, error } = await supabase
        .from("pedidos")
        .select(
          `id, cantidad, urgencia, estado, creado_at,
           insumos ( nombre, unidad_medida ),
           faenas ( nombre ),
           equipos ( identificador, tipo )`
        )
        .order("creado_at", { ascending: false });

      if (!activo) return;
      if (error) {
        setError(error.message);
        return;
      }
      setPedidos(data as unknown as Pedido[]);
    }

    cargar();
    return () => {
      activo = false;
    };
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-2xl text-bosque-900">Pedidos</h1>
        <p className="text-sm text-bosque-700">
          {pedidos ? `${pedidos.length} pedidos` : "Cargando…"}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          No se pudo cargar: {error}
        </div>
      )}

      {pedidos && pedidos.length === 0 && !error && (
        <div className="rounded-md border border-dashed border-bosque-100 px-4 py-8 text-center text-sm text-bosque-700">
          No hay pedidos todavía. Se crean desde la tabla{" "}
          <code className="rounded bg-bosque-50 px-1">pedidos</code> en Supabase
          por ahora.
        </div>
      )}

      {pedidos && pedidos.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-bosque-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-bosque-50 text-bosque-700">
              <tr>
                <th className="px-4 py-3 font-medium">Destino</th>
                <th className="px-4 py-3 font-medium">Insumo</th>
                <th className="px-4 py-3 font-medium">Cantidad</th>
                <th className="px-4 py-3 font-medium">Urgencia</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="border-t border-bosque-100">
                  <td className="px-4 py-3">
                    {p.faenas?.nombre ??
                      (p.equipos
                        ? `${p.equipos.tipo} · ${p.equipos.identificador}`
                        : "—")}
                  </td>
                  <td className="px-4 py-3">{p.insumos?.nombre ?? "—"}</td>
                  <td className="px-4 py-3">
                    {p.cantidad} {p.insumos?.unidad_medida ?? ""}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${urgenciaEstilo[p.urgencia]}`}
                    >
                      {p.urgencia}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${estadoEstilo[p.estado]}`}
                    >
                      {p.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
