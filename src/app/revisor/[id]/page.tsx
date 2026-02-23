"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSessionRepo } from "@/domain/session";
import { usePrecalificacionesRepo } from "@/domain/precalificaciones";
import type { Precalificacion } from "@/domain/precalificaciones";
import { FormEditarPrecalificacion } from "@/components/FormEditarPrecalificacion";

export default function RevisorEditarPage() {
  const params = useParams();
  const id = params.id as string;
  const { currentUser } = useSessionRepo();
  const repo = usePrecalificacionesRepo();
  const [precal, setPrecal] = useState<Precalificacion | null | undefined>(undefined);

  useEffect(() => {
    repo.getById(id).then((p) => setPrecal(p ?? null));
  }, [id, repo]);

  if (currentUser === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }
  if (!currentUser || currentUser.role !== "revisor") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          <Link href="/login" className="text-blue-600 underline">
            Inicia sesión como revisor
          </Link>
        </p>
      </div>
    );
  }

  if (precal === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  if (!precal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-gray-600">Precalificación no encontrada.</p>
          <Link href="/revisor" className="mt-2 inline-block text-blue-600 underline">
            Volver al dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <FormEditarPrecalificacion
      key={id}
      id={id}
      precal={precal}
      backHref="/revisor"
      redirectTo="/revisor"
    />
  );
}
