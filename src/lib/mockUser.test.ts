import test from "node:test";
import assert from "node:assert/strict";
import {
  getEffectiveMockEmail,
  getEffectiveMockRole,
  MOCK_USER_KEY,
  normalizeLegacyMockRole,
  persistMockUser,
  readMockUser,
} from "@/lib/mockUser";

function installWindowStore(initial: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(initial));
  (globalThis as unknown as { window: object }).window = {
    localStorage: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    },
  };
}

test("getEffectiveMockRole: prioriza mock_user sobre mock_role legacy", () => {
  installWindowStore({
    [MOCK_USER_KEY]: JSON.stringify({
      email: "c@test.com",
      role: "mesa_control_admin",
      name: "Cynthia",
    }),
    mock_role: "asesor",
    mock_email: "wrong@test.com",
  });
  assert.equal(getEffectiveMockRole(), "mesa_control_admin");
  assert.equal(getEffectiveMockEmail(), "c@test.com");
});

test("getEffectiveMockRole: sin mock_user usa mock_role", () => {
  installWindowStore({ mock_role: "mesa_control_interno", mock_email: "x@test.com" });
  assert.equal(getEffectiveMockRole(), "mesa_control_interno");
});

test("normalizeLegacyMockRole: revisor legacy → editor", () => {
  assert.equal(normalizeLegacyMockRole("revisor"), "editor");
  assert.equal(normalizeLegacyMockRole("editor"), "editor");
});

test("getEffectiveMockRole: revisor legacy en mock_role → editor", () => {
  installWindowStore({ mock_role: "revisor", mock_email: "x@test.com" });
  assert.equal(getEffectiveMockRole(), "editor");
});

test("persistMockUser escribe mock_user y sincroniza claves legacy", () => {
  const map = new Map<string, string>();
  (globalThis as unknown as { window: object }).window = {
    localStorage: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    },
  };
  persistMockUser({
    email: "cynthia@concasa.test",
    role: "mesa_control_admin",
    name: "Cynthia",
  });
  assert.equal(readMockUser()?.name, "Cynthia");
  assert.equal(map.get("mock_role"), "mesa_control_admin");
  assert.equal(map.get("mock_email"), "cynthia@concasa.test");
});

test("persistMockUser normaliza revisor legacy a editor", () => {
  const map = new Map<string, string>();
  (globalThis as unknown as { window: object }).window = {
    localStorage: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    },
  };
  persistMockUser({
    email: "legacy@test.com",
    role: "revisor",
    name: "Legacy",
  });
  assert.equal(readMockUser()?.role, "editor");
  assert.equal(map.get("mock_role"), "editor");
});
