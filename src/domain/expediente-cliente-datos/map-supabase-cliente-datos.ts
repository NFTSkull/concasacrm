import type {
  ExpedienteClienteDatos,
  ExpedienteClienteDatosEstado,
} from "./types";

export type SupabaseClienteDatosRow = {
  expediente_id: string;
  datos: Record<string, unknown> | null;
  estado: string;
  comentario_rechazo?: string | null;
  validated_at?: string | null;
  validated_by?: string | null;
  rejected_at?: string | null;
  rejected_by?: string | null;
  updated_at: string;
  referencias?: unknown;
  updated_by_profile?: { email?: string | null } | null;
};

type ReferenciaJson = {
  nombre?: unknown;
  celular?: unknown;
  telefono?: unknown;
};

function normalizeEstado(value: unknown): ExpedienteClienteDatosEstado {
  if (
    value === "pendiente" ||
    value === "completo" ||
    value === "validado" ||
    value === "rechazado"
  ) {
    return value;
  }
  return "pendiente";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mapReferencias(
  datos: Record<string, unknown>,
  referenciasCol: unknown,
): ExpedienteClienteDatos["datos"]["referencias"] {
  const raw =
    Array.isArray(referenciasCol) && referenciasCol.length > 0
      ? referenciasCol
      : Array.isArray(datos.referencias)
        ? datos.referencias
        : [];

  const mapped = raw
    .filter((item): item is ReferenciaJson => !!item && typeof item === "object")
    .map((item) => ({
      nombre: asString(item.nombre),
      celular: asString(item.celular) || asString(item.telefono),
    }));

  while (mapped.length < 2) {
    mapped.push({ nombre: "", celular: "" });
  }

  return mapped.slice(0, 2);
}

function mapBeneficiario(
  value: unknown,
): ExpedienteClienteDatos["datos"]["beneficiario"] {
  if (!value || typeof value !== "object") {
    return { nombre: "", parentesco: "" };
  }
  const obj = value as Record<string, unknown>;
  return {
    nombre: asString(obj.nombre),
    parentesco: asString(obj.parentesco),
  };
}

function mapDireccionEmpresa(
  value: unknown,
): ExpedienteClienteDatos["datos"]["direccionEmpresa"] {
  if (!value || typeof value !== "object") {
    return { calle: "", colonia: "", municipio: "", cp: "" };
  }
  const obj = value as Record<string, unknown>;
  return {
    calle: asString(obj.calle),
    colonia: asString(obj.colonia),
    municipio: asString(obj.municipio),
    cp: asString(obj.cp),
  };
}

export function mapSupabaseRowToExpedienteClienteDatos(
  row: SupabaseClienteDatosRow,
): ExpedienteClienteDatos {
  const datos = row.datos ?? {};

  return {
    expedienteId: row.expediente_id,
    datos: {
      nombreCliente: asString(datos.nombreCliente),
      nss: asString(datos.nss),
      curp: asString(datos.curp),
      rfc: asString(datos.rfc),
      celular: asString(datos.celular) || asString(datos.telefono),
      correo: asString(datos.correo),
      empresa: asString(datos.empresa),
      registroPatronal: asString(datos.registroPatronal),
      telefonoEmpresa: asString(datos.telefonoEmpresa),
      referencias: mapReferencias(datos, row.referencias),
      beneficiario: mapBeneficiario(datos.beneficiario),
      direccionEmpresa: mapDireccionEmpresa(datos.direccionEmpresa),
    },
    estado: normalizeEstado(row.estado),
    comentarioRechazo: row.comentario_rechazo?.trim() || undefined,
    validatedAt: row.validated_at ?? undefined,
    validatedBy: row.validated_by ?? undefined,
    rejectedAt: row.rejected_at ?? undefined,
    rejectedBy: row.rejected_by ?? undefined,
    updatedAt: row.updated_at,
    updatedBy:
      row.updated_by_profile?.email?.trim() ||
      "asesor",
  };
}

export function buildSaveClienteDatosRpcPayload(
  expedienteId: string,
  datos: ExpedienteClienteDatos["datos"],
): {
  p_expediente_id: string;
  p_rfc: string;
  p_telefono: string;
  p_referencias: { nombre: string; telefono: string }[];
  p_datos: Record<string, unknown>;
  p_estado: "completo";
} {
  return {
    p_expediente_id: expedienteId,
    p_rfc: datos.rfc.trim(),
    p_telefono: datos.celular.trim(),
    p_referencias: datos.referencias.map((ref) => ({
      nombre: ref.nombre.trim(),
      telefono: ref.celular.trim(),
    })),
    p_datos: {
      nombreCliente: datos.nombreCliente.trim(),
      nss: datos.nss.trim(),
      curp: datos.curp.trim(),
      correo: datos.correo.trim(),
      empresa: datos.empresa.trim(),
      registroPatronal: datos.registroPatronal.trim(),
      telefonoEmpresa: datos.telefonoEmpresa.trim(),
      beneficiario: {
        nombre: datos.beneficiario.nombre.trim(),
        parentesco: datos.beneficiario.parentesco.trim(),
      },
      direccionEmpresa: {
        calle: datos.direccionEmpresa.calle.trim(),
        colonia: datos.direccionEmpresa.colonia.trim(),
        municipio: datos.direccionEmpresa.municipio.trim(),
        cp: datos.direccionEmpresa.cp.trim(),
      },
    },
    p_estado: "completo",
  };
}
