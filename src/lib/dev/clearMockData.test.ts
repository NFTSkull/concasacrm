import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RETENCION_ENVIO_MESA_STORAGE_KEY } from "@/domain/expediente-retencion/envio-mesa.mock-localstorage.repo";
import { RETENCION_OPCION_STORAGE_KEY } from "@/domain/expediente-retencion/mock-localstorage.repo";
import { MOCK_LOCAL_STORAGE_KEYS } from "./clearMockData";

describe("clearMockData: MOCK_LOCAL_STORAGE_KEYS", () => {
  it("incluye claves de retención etapa 8 (B0D3–B0D6)", () => {
    assert.ok(MOCK_LOCAL_STORAGE_KEYS.includes(RETENCION_OPCION_STORAGE_KEY));
    assert.ok(MOCK_LOCAL_STORAGE_KEYS.includes(RETENCION_ENVIO_MESA_STORAGE_KEY));
  });
});
