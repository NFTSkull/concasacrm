import test from "node:test";
import assert from "node:assert/strict";
import { redirectAfterLogin } from "@/lib/loginRedirect";

function createRouterMock() {
  const pushes: string[] = [];
  return {
    router: { push: (path: string) => pushes.push(path) },
    pushes,
  };
}

test("redirectAfterLogin: rutas por rol", () => {
  const cases: Array<{ role: string; path: string }> = [
    { role: "asesor", path: "/asesor" },
    { role: "editor", path: "/editor" },
    { role: "super_admin", path: "/admin" },
    { role: "mesa_control_admin", path: "/mesa-control" },
    { role: "mesa_control_interno", path: "/mesa-control" },
    { role: "mesa_control_externo", path: "/mesa-control" },
  ];

  for (const { role, path } of cases) {
    const { router, pushes } = createRouterMock();
    redirectAfterLogin(router, role);
    assert.deepEqual(pushes, [path], `role=${role}`);
  }
});
