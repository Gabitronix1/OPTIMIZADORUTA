import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ruteo forestal",
  description: "Panel de despacho e insumos",
};

const nav = [
  { href: "/pedidos", label: "Pedidos" },
  { href: "/equipos", label: "Equipos" },
  { href: "/rutas", label: "Rutas" },
  { href: "/bodega", label: "Bodega" },
  { href: "/flota", label: "Flota" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 border-r border-bosque-100 bg-white px-5 py-6">
            <p className="font-display text-lg text-bosque-700">Ruteo forestal</p>
            <nav className="mt-8 flex flex-col gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm text-bosque-700 hover:bg-bosque-50"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 px-8 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
