"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AvanceOperativo2a3View } from "@/domain/expedientes/mesa-avance-integracion";

const CONFIRMACION_AVANCE_2_3 =
  "¿Confirmas avanzar este expediente a etapa 3: Listo para cita de biométrico?";

type Props = {
  view: AvanceOperativo2a3View;
  puedeOperar: boolean;
  loading: boolean;
  error: string | null;
  success: string | null;
  onAvanzar: () => Promise<void>;
};

export function MesaAvanceOperativoSection({
  view,
  puedeOperar,
  loading,
  error,
  success,
  onAvanzar,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirmar = useCallback(() => {
    void onAvanzar().finally(() => setConfirmOpen(false));
  }, [onAvanzar]);

  if (!view.mostrar) return null;

  return (
    <>
      <section
        className="overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-b from-sky-50/40 to-white shadow-sm"
        aria-label="Avance operativo Mesa"
      >
        <header className="border-b border-sky-100 bg-white px-4 py-4">
          <h2 className="text-base font-semibold text-gray-900">Avance operativo Mesa</h2>
          <p className="mt-1 max-w-2xl text-xs text-gray-500">
            El expediente está en Registro (etapa 2). Confirma el avance a Listo para cita de
            biométrico (etapa 3). No se requiere cita biométrica agendada en este paso.
          </p>
        </header>

        <div className="space-y-3 p-4">
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </p>
          ) : null}

          {success ? (
            <p
              role="status"
              className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-900"
            >
              {success}
            </p>
          ) : null}

          {puedeOperar ? (
            <div className="border-t border-sky-100 pt-3">
              <Button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!view.puedeAvanzar || loading}
              >
                {loading ? "Avanzando…" : "Avanzar a Listo para cita de biométrico"}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => !loading && setConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mesa-avance-operativo-title"
            className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="mesa-avance-operativo-title" className="text-base font-semibold text-gray-900">
              Confirmar avance de etapa
            </h3>
            <p className="mt-2 text-sm text-gray-600">{CONFIRMACION_AVANCE_2_3}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => setConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" disabled={loading} onClick={() => void handleConfirmar()}>
                {loading ? "Avanzando…" : "Confirmar avance"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
