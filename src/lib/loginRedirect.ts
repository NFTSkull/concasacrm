import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** Rol mock UI usado para decidir la ruta post-login. */
export type LoginRedirectRole =
  | "super_admin"
  | "editor"
  | "asesor"
  | "mesa_control"
  | "mesa_control_admin"
  | "mesa_control_interno"
  | "mesa_control_externo";

type LoginRouter = Pick<AppRouterInstance, "push">;

export function redirectAfterLogin(
  router: LoginRouter,
  role: LoginRedirectRole | string,
): void {
  if (role === "asesor") {
    router.push("/asesor");
  } else if (role.startsWith("mesa_control")) {
    router.push("/mesa-control");
  } else if (role === "super_admin") {
    router.push("/admin");
  } else if (role === "editor") {
    router.push("/editor");
  } else {
    router.push("/admin");
  }
}
