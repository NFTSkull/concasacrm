"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Ruta legacy mock `/revisor/[id]` → `/editor/[id]`.
 * En producción no existe el rol `revisor`; el rol productivo es `editor`.
 */
export default function RevisorLegacyDetailRedirectPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    if (!id) return;
    router.replace(`/editor/${id}`);
  }, [id, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <p className="text-gray-500">Redirigiendo a Editor (ruta legacy /revisor)…</p>
    </div>
  );
}
