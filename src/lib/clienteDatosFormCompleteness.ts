import type { ExpedienteClienteDatos } from "@/domain/expediente-cliente-datos";

export type ClienteDatosFormShape = ExpedienteClienteDatos["datos"];

export const CLIENTE_DATOS_NOTA_MESA_MAX_LENGTH = 1000;

/** Error si la nota opcional supera el límite; vacía no genera error. */
export function getNotaMesaLongitudError(
  nota: string | undefined,
): string | null {
  const len = (nota ?? "").length;
  if (len > CLIENTE_DATOS_NOTA_MESA_MAX_LENGTH) {
    return `La nota para Mesa no puede superar ${CLIENTE_DATOS_NOTA_MESA_MAX_LENGTH} caracteres.`;
  }
  return null;
}

/** Etiquetas legibles de campos obligatorios vacíos (trim). */
export function getClienteDatosCamposFaltantes(d: ClienteDatosFormShape): string[] {
  const missing: string[] = [];
  const req = (label: string, v: string) => {
    if (!String(v).trim()) missing.push(label);
  };
  req("Nombre del cliente", d.nombreCliente);
  req("NSS", d.nss);
  req("CURP", d.curp);
  req("RFC", d.rfc);
  req("Celular", d.celular);
  req("Correo", d.correo);
  req("Empresa", d.empresa);
  req("Registro patronal", d.registroPatronal);
  req("Teléfono empresa", d.telefonoEmpresa);
  d.referencias.forEach((r, i) => {
    req(`Referencia ${i + 1} — nombre`, r.nombre);
    req(`Referencia ${i + 1} — celular`, r.celular);
  });
  req("Beneficiario — nombre", d.beneficiario.nombre);
  req("Beneficiario — parentesco", d.beneficiario.parentesco);
  req("Dirección empresa — calle", d.direccionEmpresa.calle);
  req("Dirección empresa — colonia", d.direccionEmpresa.colonia);
  req("Dirección empresa — municipio", d.direccionEmpresa.municipio);
  req("Dirección empresa — CP", d.direccionEmpresa.cp);
  return missing;
}
