import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapUpsertAgendaConfigFirmasRpcError } from "./upsert-agenda-config-rpc-error";

describe("mapUpsertAgendaConfigFirmasRpcError", () => {
  it("mapea rol no autorizado", () => {
    const err = mapUpsertAgendaConfigFirmasRpcError({
      code: "42501",
      message: "upsert_agenda_config_firmas: rol no autorizado (asesor)",
    });
    assert.match(err.message, /Mesa Admin o Super Admin/);
  });

  it("mapea timezone inválido", () => {
    const err = mapUpsertAgendaConfigFirmasRpcError({
      message: "upsert_agenda_config_firmas: timezone inválido: Foo/Bar",
    });
    assert.match(err.message, /zona horaria/i);
  });

  it("expone mensaje SQL conocido sin prefijo", () => {
    const err = mapUpsertAgendaConfigFirmasRpcError({
      message: "upsert_agenda_config_firmas: slots con duplicados",
    });
    assert.match(err.message, /horarios/i);
  });
});
