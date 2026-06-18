import test from "node:test";
import assert from "node:assert/strict";
import {
  mapAppRoleToMockRole,
  mapMockRoleToSessionRole,
  SupabaseSessionError,
} from "@/domain/session/supabase.repo";

test("mapAppRoleToMockRole: mapea roles productivos a mock UI", () => {
  assert.equal(mapAppRoleToMockRole("asesor"), "asesor");
  assert.equal(mapAppRoleToMockRole("editor"), "editor");
  assert.equal(mapAppRoleToMockRole("super_admin"), "super_admin");
  assert.equal(mapAppRoleToMockRole("mesa_admin"), "mesa_control_admin");
  assert.equal(mapAppRoleToMockRole("mesa_interno"), "mesa_control_interno");
  assert.equal(mapAppRoleToMockRole("mesa_externo"), "mesa_control_externo");
});

test("mapAppRoleToMockRole: rechaza rol desconocido (sin revisor)", () => {
  assert.throws(
    () => mapAppRoleToMockRole("revisor"),
    (err: unknown) =>
      err instanceof SupabaseSessionError &&
      (err as Error).message.includes("no soportado"),
  );
});

test("mapMockRoleToSessionRole: colapsa mesa_control_* a mesa_control", () => {
  assert.equal(mapMockRoleToSessionRole("mesa_control_admin"), "mesa_control");
  assert.equal(mapMockRoleToSessionRole("mesa_control_interno"), "mesa_control");
  assert.equal(mapMockRoleToSessionRole("mesa_control_externo"), "mesa_control");
  assert.equal(mapMockRoleToSessionRole("mesa_control"), "mesa_control");
});

test("mapMockRoleToSessionRole: conserva roles directos", () => {
  assert.equal(mapMockRoleToSessionRole("asesor"), "asesor");
  assert.equal(mapMockRoleToSessionRole("editor"), "editor");
  assert.equal(mapMockRoleToSessionRole("super_admin"), "super_admin");
});
