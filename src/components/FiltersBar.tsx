"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { FiltersState } from "@/lib/filters";
import { PROGRAMAS } from "@/lib/mock-store";

interface FiltersBarProps {
  filters: FiltersState;
  setFilters: (f: FiltersState | ((prev: FiltersState) => FiltersState)) => void;
  asesorOptions: { value: string; label: string }[];
  showAsesorFilter: boolean;
  showProgramaFilter: boolean;
}

export function FiltersBar({
  filters,
  setFilters,
  asesorOptions,
  showAsesorFilter,
  showProgramaFilter,
}: FiltersBarProps) {
  const update = (key: keyof FiltersState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClear = () => {
    setFilters({
      asesorId: "",
      programa: "",
      buscar: "",
      desde: "",
      hasta: "",
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 text-sm font-medium text-gray-700">
        Filtros
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {showAsesorFilter && (
          <Select
            label="Asesor"
            options={[{ value: "", label: "Todos" }, ...asesorOptions]}
            value={filters.asesorId}
            onChange={(e) => update("asesorId", e.target.value)}
            className="min-w-[180px]"
          />
        )}
        {showProgramaFilter && (
          <Select
            label="Programa"
            options={[
              { value: "", label: "Todos" },
              ...PROGRAMAS.map((p) => ({ value: p, label: p })),
            ]}
            value={filters.programa}
            onChange={(e) => update("programa", e.target.value)}
            className="min-w-[160px]"
          />
        )}
        <Input
          label="Buscar"
          placeholder="cliente, teléfono, nss, dirección, notas, monto..."
          value={filters.buscar}
          onChange={(e) => update("buscar", e.target.value)}
          className="min-w-[200px]"
        />
        <Input
          label="Desde"
          type="date"
          value={filters.desde}
          onChange={(e) => update("desde", e.target.value)}
        />
        <Input
          label="Hasta"
          type="date"
          value={filters.hasta}
          onChange={(e) => update("hasta", e.target.value)}
        />
        <Button variant="secondary" onClick={handleClear}>
          Limpiar
        </Button>
      </div>
    </div>
  );
}
