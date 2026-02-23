"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createPrecalificacion,
  type Precalificacion,
  type Programa,
  type UsuarioMock,
} from "@/lib/mock-store";

interface MockStoreState {
  currentUser: UsuarioMock | null;
  precalificaciones: Precalificacion[];
}

export interface MockStoreContextValue extends MockStoreState {
  login: (email: string, _password: string, rol: UsuarioMock["rol"]) => void;
  logout: () => void;
  addPrecalificacion: (data: {
    programa: Programa;
    nss: string;
    cliente_nombre: string;
    telefono_cliente: string;
    direccion_opcional: string;
  }) => Precalificacion | undefined;
  updatePrecalificacion: (
    id: string,
    data: {
      monto_aprobado?: number | null;
      notas?: string;
      notas_revision?: string;
      decision?: "pendiente" | "aprobado" | "no_cumple";
    }
  ) => Precalificacion | undefined;
  getPrecalificacionById: (id: string) => Precalificacion | undefined;
  getPrecalificacionesByAsesor: (asesorId: string) => Precalificacion[];
  getAllPrecalificaciones: () => Precalificacion[];
}

const MockStoreContext = createContext<MockStoreContextValue | null>(null);

const PRECALIFICACIONES_INICIALES: Precalificacion[] = [
  createPrecalificacion({
    asesorId: "asesor@concasa.com",
    programa: "Mejoravit",
    nss: "12345678901",
    cliente_nombre: "Juan Pérez",
    telefono_cliente: "5512345678",
    direccion_opcional: "Calle Ejemplo 123",
  }),
  createPrecalificacion({
    asesorId: "asesor@concasa.com",
    programa: "Subcuenta",
    nss: "98765432109",
    cliente_nombre: "María García",
    telefono_cliente: "5587654321",
    direccion_opcional: "",
  }),
];

export function MockStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MockStoreState>({
    currentUser: null,
    precalificaciones: PRECALIFICACIONES_INICIALES,
  });

  const login = useCallback(
    (email: string, _password: string, rol: UsuarioMock["rol"]) => {
      setState((s) => ({
        ...s,
        currentUser: { email, rol },
      }));
    },
    []
  );

  const logout = useCallback(() => {
    setState((s) => ({ ...s, currentUser: null }));
  }, []);

  const addPrecalificacion = useCallback(
    (data: {
      programa: Programa;
      nss: string;
      cliente_nombre: string;
      telefono_cliente: string;
      direccion_opcional: string;
    }): Precalificacion | undefined => {
      if (!state.currentUser || state.currentUser.rol !== "asesor") return undefined;
      const nueva = createPrecalificacion({
        ...data,
        asesorId: state.currentUser.email,
      });
      setState((s) => ({
        ...s,
        precalificaciones: [nueva, ...s.precalificaciones],
      }));
      return nueva;
    },
    [state.currentUser]
  );

  const updatePrecalificacion = useCallback(
    (
      id: string,
      data: {
        monto_aprobado?: number | null;
        notas?: string;
        notas_revision?: string;
        decision?: "pendiente" | "aprobado" | "no_cumple";
      }
    ): Precalificacion | undefined => {
      const prev = state.precalificaciones.find((p) => p.id === id);
      if (!prev) return undefined;
      const updated: Precalificacion = { ...prev, ...data };
      setState((s) => ({
        ...s,
        precalificaciones: s.precalificaciones.map((p) =>
          p.id === id ? updated : p
        ),
      }));
      return updated;
    },
    [state.precalificaciones]
  );

  const getPrecalificacionById = useCallback(
    (id: string) => state.precalificaciones.find((p) => p.id === id),
    [state.precalificaciones]
  );

  const getPrecalificacionesByAsesor = useCallback(
    (asesorId: string) =>
      state.precalificaciones.filter((p) => p.asesorId === asesorId),
    [state.precalificaciones]
  );

  const getAllPrecalificaciones = useCallback(
    () => [...state.precalificaciones].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    [state.precalificaciones]
  );

  const value = useMemo<MockStoreContextValue>(
    () => ({
      ...state,
      login,
      logout,
      addPrecalificacion,
      updatePrecalificacion,
      getPrecalificacionById,
      getPrecalificacionesByAsesor,
      getAllPrecalificaciones,
    }),
    [
      state,
      login,
      logout,
      addPrecalificacion,
      updatePrecalificacion,
      getPrecalificacionById,
      getPrecalificacionesByAsesor,
      getAllPrecalificaciones,
    ]
  );

  return (
    <MockStoreContext.Provider value={value}>
      {children}
    </MockStoreContext.Provider>
  );
}

export function useMockStore(): MockStoreContextValue {
  const ctx = useContext(MockStoreContext);
  if (!ctx) throw new Error("useMockStore debe usarse dentro de MockStoreProvider");
  return ctx;
}
