"use client";

import Link from "next/link";
import { useState } from "react";
import { supabaseBrowser, isSupabaseAuthEnabled } from "@/lib/supabaseBrowser";

type SavedConnection = {
  id: string;
  connection_type: "meta_test" | "coexistence";
  connection_state: string;
  display_phone_number: string | null;
  created_at: string;
};

type PreflightResult = {
  ready: false;
  blockers: string[];
  connections: SavedConnection[];
  message: string;
};

/**
 * Safe per-advisor onboarding preparation. The real Meta Embedded Signup
 * popup is NOT shown until webhook/history/security gates have passed.
 */
export default function ConnectWhatsAppPage() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkReadiness() {
    if (!isSupabaseAuthEnabled() || !supabaseBrowser) {
      setError("Necesitas iniciar sesión en el entorno conectado de ConCasa.");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const { data: session } = await supabaseBrowser.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Inicia sesión con tu cuenta de asesor.");
      const response = await fetch("/api/asesor/whatsapp/onboarding/status", {
        method: "GET",
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      });
      if (response.status === 401) {
        throw new Error("Solo los asesores activos pueden conectar su WhatsApp.");
      }
      if (!response.ok) {
        throw new Error("El asistente de conexión todavía no está disponible.");
      }
      const body = await response.json() as PreflightResult;
      setResult(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos revisar los requisitos.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/asesor/whatsapp" className="text-sm text-emerald-800 hover:underline">
          ← Volver a mis conversaciones
        </Link>

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Vincular mi WhatsApp Business
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            La idea es utilizar tu mismo WhatsApp Business en el celular y
            gestionar las conversaciones compatibles desde tu cuenta de ConCasa.
            Tu número se vinculará a tu usuario, no al de otro asesor.
          </p>
        </header>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-950">Vinculación aún no habilitada</h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-900">
            Esta pantalla ya está preparada, pero todavía no abre la autorización
            de Meta: faltan las validaciones técnicas, permisos y sincronización
            de historial. Nadie ha cambiado tu número ni tu aplicación móvil.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Así funcionará cuando esté disponible</h2>
          <ol className="mt-3 space-y-3 text-sm text-slate-700">
            <li><strong>1.</strong> Inicias sesión con tu usuario de ConCasa.</li>
            <li><strong>2.</strong> Revisas qué conversaciones compartirás y autorizas el enlace.</li>
            <li><strong>3.</strong> Abres el flujo oficial de Meta para WhatsApp Business Coexistence.</li>
            <li><strong>4.</strong> Confirmas tu número desde WhatsApp Business en tu celular.</li>
            <li><strong>5.</strong> ConCasa sincroniza los mensajes permitidos y muestra tu bandeja.</li>
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Requiere la aplicación WhatsApp Business y un número elegible.
            No es para WhatsApp Messenger personal ni para cuentas ajenas.
            Antes de vincular, se te informará si Meta desvinculará dispositivos
            adicionales y cómo funciona la importación del historial.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Verificar preparación de mi cuenta</h2>
          <p className="mt-2 text-sm text-slate-600">
            Esta comprobación es de solo lectura: no abrirá Meta, no conectará
            el teléfono y no enviará ningún mensaje.
          </p>
          <button
            type="button"
            onClick={() => void checkReadiness()}
            disabled={checking}
            className="mt-4 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {checking ? "Revisando…" : "Comprobar estado de vinculación"}
          </button>

          {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
          {result ? (
            <div className="mt-4 space-y-3" role="status">
              <p className="text-sm font-medium text-slate-900">{result.message}</p>
              <h3 className="text-sm font-semibold">Pendiente por completar</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                {result.blockers.map((item) => <li key={item}>{item}</li>)}
              </ul>
              {result.connections.length ? (
                <>
                  <h3 className="text-sm font-semibold">Mis números registrados</h3>
                  <ul className="space-y-1 text-sm text-slate-600">
                    {result.connections.map((connection) => (
                      <li key={connection.id}>
                        {connection.display_phone_number || "Número registrado"} ·
                        {" "}{connection.connection_type === "meta_test" ? "Prueba Meta" : "WhatsApp Business"} ·
                        {" "}{connection.connection_state}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
