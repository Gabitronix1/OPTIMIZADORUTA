import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

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
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Optimizador de Rutas</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {modo === "ingresar" ? "Ingresa con tu cuenta" : "Crea una cuenta nueva"}
        </p>

        <label className="mt-4 block text-sm text-neutral-700">
          Correo
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-3 block text-sm text-neutral-700">
          Contraseña
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {mensaje && <p className="mt-3 text-sm text-green-700">{mensaje}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="mt-4 w-full rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {cargando ? "Cargando…" : modo === "ingresar" ? "Ingresar" : "Crear cuenta"}
        </button>

        <button
          type="button"
          onClick={() => {
            setModo(modo === "ingresar" ? "crear" : "ingresar");
            setError(null);
            setMensaje(null);
          }}
          className="mt-3 w-full text-center text-xs text-neutral-500 underline"
        >
          {modo === "ingresar" ? "¿No tienes cuenta? Créala" : "¿Ya tienes cuenta? Ingresa"}
        </button>
      </form>
    </div>
  );
}
