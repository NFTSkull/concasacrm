"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isSupabaseAuthEnabled, supabaseBrowser } from "@/lib/supabaseBrowser";

type Connection = {
  id: string;
  display_phone_number: string | null;
  connection_state: string;
  connection_type: "meta_test" | "coexistence";
  consent_received_at: string | null;
  coexistence_confirmed: boolean;
};

type Conversation = {
  id: string;
  connection_id: string;
  contact_wa_id: string;
  contact_display_name: string | null;
  last_message_at: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  direction: "incoming" | "outgoing";
  source: "cloud_api" | "business_app" | "history";
  message_type: string;
  text_body: string | null;
  sent_at: string;
  delivery_status: string;
};

const ENABLED = process.env.NEXT_PUBLIC_WHATSAPP_INBOX_ENABLED === "true";
const SEND_ENABLED = process.env.NEXT_PUBLIC_WHATSAPP_SEND_ENABLED === "true";

function formatTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Monterrey",
  }).format(date);
}

function displayMessage(message: Message): string {
  if (message.message_type === "text") return message.text_body || "(Sin texto)";
  const label: Record<string, string> = {
    image: "Imagen", video: "Video", audio: "Audio",
    document: "Documento", location: "Ubicación", sticker: "Sticker",
  };
  return label[message.message_type] || "Mensaje multimedia";
}

/**
 * Read-only inbox. No button to send and no number-connection actions until
 * Meta review, pilot consent and authorization are complete. All reads are
 * constrained by Supabase RLS, never by an advisor_id from the client.
 */
export default function AsesorWhatsAppPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busyThread, setBusyThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (!ENABLED || !isSupabaseAuthEnabled() || !supabaseBrowser) return;
    const client = supabaseBrowser;
    let cancelled = false;
    async function load() {
      setBusy(true);
      setError(null);
      try {
        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError || !authData.user) {
          throw new Error("Inicia sesión para consultar tus conversaciones.");
        }

        const accounts = await client
          .from("whatsapp_connections")
          .select("id,display_phone_number,connection_state,connection_type,consent_received_at,coexistence_confirmed")
          .order("created_at", { ascending: false });

        if (accounts.error) {
          throw new Error("Esta bandeja todavía no está habilitada. Contacta al administrador.");
        }

        const safeAccounts = (accounts.data || []) as Connection[];
        const accountIds = safeAccounts
          .filter((account) =>
            account.connection_state === "active" &&
            account.coexistence_confirmed &&
            Boolean(account.consent_received_at),
          )
          .map((account) => account.id);

        let safeThreads: Conversation[] = [];
        if (accountIds.length > 0) {
          const threads = await client
            .from("whatsapp_conversations")
            .select("id,connection_id,contact_wa_id,contact_display_name,last_message_at")
            .in("connection_id", accountIds)
            .order("last_message_at", { ascending: false })
            .limit(100);
          if (threads.error) throw new Error("No pudimos cargar tus conversaciones.");
          safeThreads = (threads.data || []) as Conversation[];
        }

        if (!cancelled) {
          setConnections(safeAccounts);
          setConversations(safeThreads);
          setSelectedId((previous) =>
            previous && safeThreads.some((thread) => thread.id === previous)
              ? previous : safeThreads[0]?.id || null,
          );
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "No pudimos cargar WhatsApp.");
          setConnections([]);
          setConversations([]);
          setSelectedId(null);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [revision]);

  useEffect(() => {
    if (!ENABLED || !isSupabaseAuthEnabled() || !supabaseBrowser || !selectedId) {
      return;
    }
    const client = supabaseBrowser;
    let cancelled = false;

    async function loadThread() {
      setBusyThread(true);
      setMessages([]);
      const result = await client
        .from("whatsapp_messages")
        .select("id,conversation_id,direction,source,message_type,text_body,sent_at,delivery_status")
        .eq("conversation_id", selectedId)
        .order("sent_at", { ascending: false })
        .limit(150);

      if (!cancelled) {
        setMessages(result.error ? [] : ((result.data || []) as Message[]).reverse());
        if (result.error) setError("No pudimos cargar los mensajes de esta conversación.");
        setBusyThread(false);
      }
    }
    void loadThread();
    return () => { cancelled = true; };
  }, [selectedId, revision]);

  const visibleThreads = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es-MX");
    return conversations.filter((thread) =>
      !term || `${thread.contact_display_name || ""} ${thread.contact_wa_id}`
        .toLocaleLowerCase("es-MX").includes(term),
    );
  }, [conversations, search]);

  const selected = conversations.find((thread) => thread.id === selectedId);
  const selectedConnection = connections.find((c) => c.id === selected?.connection_id);
  const canSendHere = SEND_ENABLED && selectedConnection?.connection_type === "meta_test"
    && selectedConnection.connection_state === "active";

  async function handleSend() {
    if (!selected || !supabaseBrowser || !canSendHere) return;
    const text = replyText.trim();
    if (!text) return;
    setSending(true);
    setSendError(null);
    try {
      const { data: sessionData } = await supabaseBrowser.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");

      const response = await fetch("/api/asesor/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          conversationId: selected.id,
          contactWaId: selected.contact_wa_id,
          text,
          confirm: true,
        }),
      });
      if (!response.ok) {
        const labels: Record<number, string> = {
          401: "Debes iniciar sesión como asesor autorizado.",
          403: "Este número no está confirmado como destinatario de prueba en Meta.",
          501: "Responder desde Coexistence todavía no está implementado.",
          503: "El envío está desactivado en este entorno.",
        };
        throw new Error(labels[response.status] || "No se pudo enviar el mensaje.");
      }
      setReplyText("");
      setRevision((v) => v + 1);
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/asesor" className="text-sm text-emerald-800 hover:underline">
              ← Volver a mi panel
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Mis conversaciones de WhatsApp
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Cada asesor ve solo sus números y conversaciones autorizadas.
              Las respuestas desde el CRM estarán disponibles después del piloto de Meta.
            </p>
          </div>
          {ENABLED && isSupabaseAuthEnabled() ? (
            <button type="button" onClick={() => setRevision((v) => v + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100">
              Actualizar
            </button>
          ) : null}
        </header>

        {!ENABLED || !isSupabaseAuthEnabled() ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-semibold text-amber-950">Integración en preparación</h2>
            <p className="mt-2 text-sm text-amber-900">
              Tu WhatsApp Business del celular no se ha modificado ni conectado.
              La bandeja se activará únicamente después de las verificaciones de Meta,
              las pruebas técnicas y tu consentimiento.
            </p>
          </section>
        ) : (
          <>
            <section className="rounded-xl border border-emerald-100 bg-white px-5 py-4 shadow-sm">
              <h2 className="text-sm font-medium text-slate-700">Números vinculados</h2>
              {connections.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {connections.map((account) => (
                    <span key={account.id} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                      {account.display_phone_number || "Número oculto"}
                      {" · "}{account.connection_state === "active" ? "Activo" : "Pendiente"}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Aún no tienes ningún WhatsApp Business vinculado a ConCasa.
                </p>
              )}
            </section>

            {error ? (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            ) : null}

            <div className="grid min-h-[470px] grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:grid-cols-[minmax(230px,35%)_1fr]">
              <section className="border-b border-slate-200 md:border-b-0 md:border-r" aria-label="Conversaciones">
                <div className="border-b p-4">
                  <label htmlFor="whatsapp-search" className="text-sm font-medium">Buscar conversación</label>
                  <input id="whatsapp-search" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nombre o teléfono" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div className="max-h-[510px] overflow-y-auto">
                  {busy ? <p className="p-4 text-sm text-slate-500">Cargando...</p> : null}
                  {!busy && visibleThreads.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">No hay conversaciones disponibles.</p>
                  ) : null}
                  {visibleThreads.map((thread) => (
                    <button key={thread.id} type="button" onClick={() => setSelectedId(thread.id)}
                      className={`block w-full border-b border-slate-100 p-4 text-left hover:bg-slate-50 ${thread.id === selectedId ? "bg-emerald-50" : ""}`}>
                      <span className="block truncate text-sm font-semibold">
                        {thread.contact_display_name || thread.contact_wa_id}
                      </span>
                      <span className="block text-xs text-slate-500">{formatTime(thread.last_message_at)}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="flex flex-col" aria-label="Mensajes">
                <div className="border-b border-slate-200 p-4">
                  <h2 className="font-semibold">{selected?.contact_display_name || selected?.contact_wa_id || "Selecciona una conversación"}</h2>
                  <p className="text-xs text-slate-500">Vista de solo lectura durante el piloto</p>
                </div>
                <div className="flex min-h-[370px] flex-1 flex-col gap-3 overflow-y-auto bg-slate-50 p-4">
                  {busyThread ? <p className="text-sm text-slate-500">Cargando mensajes...</p> : null}
                  {!busyThread && messages.length === 0 ? (
                    <p className="m-auto text-center text-sm text-slate-500">Todavía no hay mensajes para mostrar.</p>
                  ) : null}
                  {messages.map((message) => (
                    <article key={message.id} className={`max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-sm ${
                      message.direction === "outgoing" ? "ml-auto bg-emerald-100" : "mr-auto bg-white"
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{displayMessage(message)}</p>
                      <span className="mt-2 block text-right text-[11px] text-slate-500">
                        {message.source === "business_app" ? "Desde celular · " : ""}
                        {formatTime(message.sent_at)}
                      </span>
                    </article>
                  ))}
                </div>
                {canSendHere ? (
                  <div className="border-t border-slate-200 bg-white p-4">
                    {sendError ? (
                      <p role="alert" className="mb-2 text-xs text-red-700">{sendError}</p>
                    ) : null}
                    <div className="flex gap-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        disabled={!selected || sending}
                        placeholder={selected ? "Escribe una respuesta de prueba..." : "Selecciona una conversación"}
                        rows={2}
                        maxLength={4096}
                        className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                      <button type="button" onClick={() => void handleSend()}
                        disabled={!selected || sending || !replyText.trim()}
                        className="shrink-0 self-end rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                        {sending ? "Enviando..." : "Enviar"}
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Solo número de prueba de Meta y destinatarios confirmados. Nada se envía automáticamente.
                    </p>
                  </div>
                ) : (
                  <div className="border-t border-slate-200 bg-white p-4 text-xs text-slate-500">
                    Envío desde CRM desactivado hasta completar Meta App Review y las pruebas de coexistencia.
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
