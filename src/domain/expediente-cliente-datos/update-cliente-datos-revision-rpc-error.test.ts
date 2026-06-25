import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapUpdateClienteDatosRevisionRpcError } from "./update-cliente-datos-revision-rpc-error";

describe("mapUpdateClienteDatosRevisionRpcError", () => {
  it("mapea comentario obligatorio", () => {
    const err = mapUpdateClienteDatosRevisionRpcError({
      code: "22023",
      message: "update_cliente_datos_revision: comentario_rechazo es obligatorio al rechazar",
    });
    assert.match(err.message, /motivo de rechazo/);
  });

  it("mapea RPC no desplegada", () => {
    const err = mapUpdateClienteDatosRevisionRpcError({
      message: "Could not find the function public.update_cliente_datos_revision",
    });
    assert.match(err.message, /aún no está disponible/);
  });
});
