import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, TriangleAlert } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import BrandMark from "../components/BrandMark";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

export default function Login() {
  const [modo, setModo] = useState<"ingresar" | "crear">("ingresar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setCargando(true);

    if (modo === "ingresar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setCargando(false);
      if (error) {
        setError(error.message);
        return;
      }
      navigate("/", { replace: true });
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });
    setCargando(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMensaje("Cuenta creada. Si se requiere confirmación por correo, revisa tu bandeja antes de ingresar.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-pine-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <BrandMark wordmarkClassName="text-base text-white" withWordmark />
        </div>
        <form onSubmit={onSubmit} className="w-full rounded-2xl border border-pine-700/60 bg-white p-6 shadow-xl">
          <h1 className="text-xl font-semibold text-neutral-900">Optimizador de Rutas</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {modo === "ingresar" ? "Ingresa con tu cuenta" : "Crea una cuenta nueva"}
          </p>

          <label className="mt-5 block text-sm font-medium text-neutral-700">
            Correo
            <Input
              type="email"
              required
              icon={<Mail className="size-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-neutral-700">
            Contraseña
            <Input
              type="password"
              required
              minLength={6}
              icon={<Lock className="size-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5"
            />
          </label>

          {error && (
            <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
          {mensaje && (
            <p className="mt-4 rounded-lg bg-pine-50 px-3 py-2 text-sm text-pine-800">{mensaje}</p>
          )}

          <Button type="submit" loading={cargando} className="mt-5 w-full">
            {modo === "ingresar" ? "Ingresar" : "Crear cuenta"}
          </Button>

          <button
            type="button"
            onClick={() => {
              setModo(modo === "ingresar" ? "crear" : "ingresar");
              setError(null);
              setMensaje(null);
            }}
            className="mt-3 w-full text-center text-xs text-neutral-500 underline hover:text-pine-700"
          >
            {modo === "ingresar" ? "¿No tienes cuenta? Créala" : "¿Ya tienes cuenta? Ingresa"}
          </button>
        </form>
      </div>
    </div>
  );
}
