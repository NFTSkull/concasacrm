"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Ruta legacy mock `/revisor` → `/editor`.
 * En producción no existe el rol `revisor`; el rol productivo es `editor`.
 */
export default function RevisorLegacyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/editor");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <p className="text-gray-500">Redirigiendo a Editor (ruta legacy /revisor)…</p>
    </div>
  );
}
