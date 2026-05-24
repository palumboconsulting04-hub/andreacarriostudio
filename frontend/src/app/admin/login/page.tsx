"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "./actions";
import Image from "next/image";

const initialState = { error: "", success: false };

export default function AdminLogin() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  useEffect(() => {
    if (state.success) router.push("/admin");
  }, [state.success, router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#fff8f5" }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.png"
            alt="Andrea Carrió Studio"
            width={80}
            height={80}
            className="rounded-full object-cover mb-4"
          />
          <h1
            className="text-2xl font-semibold text-center"
            style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}
          >
            Studio Admin
          </h1>
          <p className="text-sm mt-1" style={{ color: "#89726c" }}>
            Acceso privado — Andrea Carrió Studio
          </p>
        </div>

        <form
          action={formAction}
          className="rounded-3xl border p-8 space-y-5"
          style={{ backgroundColor: "#ffffff", borderColor: "#dcc1b9" }}
        >
          <div>
            <label
              className="block text-xs tracking-widest uppercase mb-2"
              style={{ color: "#56423d", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
            >
              Usuario
            </label>
            <input
              type="text"
              name="username"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none transition-colors"
              style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9", color: "#25190f" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7d2b13")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#dcc1b9")}
            />
          </div>

          <div>
            <label
              className="block text-xs tracking-widest uppercase mb-2"
              style={{ color: "#56423d", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
            >
              Contraseña
            </label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none transition-colors"
              style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9", color: "#25190f" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7d2b13")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#dcc1b9")}
            />
          </div>

          {state.error && (
            <p className="text-xs text-red-600 text-center">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 rounded-full text-sm font-semibold tracking-widest uppercase transition-colors"
            style={{
              backgroundColor: pending ? "#dcc1b9" : "#7d2b13",
              color: "#ffffff",
              fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
              cursor: pending ? "not-allowed" : "pointer",
            }}
          >
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
