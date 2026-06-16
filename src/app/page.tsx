"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSessionRepo } from "@/domain/session";

export default function HomePage() {
  const router = useRouter();
  const { currentUser } = useSessionRepo();

  useEffect(() => {
    if (currentUser === undefined) return;
    if (!currentUser) {
      router.replace("/login");
      return;
    }
    if (currentUser.role === "asesor") router.replace("/asesor");
    else if (currentUser.role === "editor" || currentUser.role === "revisor") {
      router.replace("/editor");
    } else if (currentUser.role === "mesa_control") {
      router.replace("/mesa-control");
    } else router.replace("/admin");
  }, [currentUser, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <p className="text-gray-500">Redirigiendo...</p>
    </div>
  );
}
