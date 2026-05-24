"use client";

import { useActionState, useEffect, useState } from "react";
import { loginAction } from "./actions";
import Image from "next/image";

const initialState = { error: "", success: false };

export default function AdminLogin() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (state.success) window.location.href = "/admin";
  }, [state.success]);

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
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border px-4 py-3 pr-12 text-sm focus:outline-none transition-colors"
                style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9", color: "#25190f" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#7d2b13")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#dcc1b9")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                style={{ color: "#89726c" }}
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
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
