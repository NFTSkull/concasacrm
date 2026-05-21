# Devlog

## 2026-05-21 - Exportacion admin a Excel (CSV)

- Objetivo: permitir descarga de la informacion visible en la vista admin sin alterar flujos existentes.
- Decision: se implemento descarga en formato CSV con BOM UTF-8 para compatibilidad con Excel.
- Alcance:
  - Boton "Descargar CSV (dia)" en la seccion "Vista del dia".
  - Boton "Descargar CSV (tabla)" en la seccion "Todas las precalificaciones".
  - Exporta datos visibles, no modifica DB ni permisos, y mantiene consultas de solo lectura.
- Riesgo mitigado: no se tocaron rutas de asesor/revisor ni logica de creacion/edicion.
