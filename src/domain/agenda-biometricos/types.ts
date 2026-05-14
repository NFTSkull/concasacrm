export type AgendaBiometricosLocationId = string;

export type AgendaBiometricosRole = "mesa_control_admin";

/** Quien creó la reserva (sesión mock o admin de agenda). */
export type AgendaBiometricosBookingActorRole =
  | AgendaBiometricosRole
  | "mesa_control"
  | "asesor";

export type YmdDate = `${number}-${number}-${number}`;
export type HhmmTime = `${number}:${number}`;

export type AgendaBiometricosConfigSlot = Readonly<{
  time: HhmmTime;
  /** Cupo por slot (>= 1). */
  capacity: number;
  /** Si es false, el slot se muestra como inactivo/no agendable. */
  active?: boolean;
}>;

export type AgendaBiometricosConfigDay = Readonly<{
  [locationId in AgendaBiometricosLocationId]?: Readonly<{
    slots: readonly AgendaBiometricosConfigSlot[];
  }>;
}>;

export type AgendaBiometricosCutoffRules = Readonly<{
  /** Días mínimos de anticipación por defecto (antes del cutoff). */
  minLeadDays: number;
  /** Hora local a partir de la cual sube la anticipación mínima. */
  afterTimeLocal: HhmmTime;
  /** Días mínimos de anticipación cuando ya pasó el cutoff. */
  minLeadDaysAfterCutoff: number;
}>;

export type AgendaBiometricosConfigV1 = Readonly<{
  version: 1;
  kind: "biometricos";
  updatedAt: string;
  updatedBy: Readonly<{ email: string; role: AgendaBiometricosRole }>;
  locations: readonly Readonly<{
    id: AgendaBiometricosLocationId;
    label: string;
    tz: "America/Monterrey";
    /** Si es false, la ubicación se conserva pero no se ofrece para agenda. */
    active?: boolean;
  }>[];
  rules: AgendaBiometricosCutoffRules;
  /** Config flexible por día. Si el día no existe, no hay disponibilidad. */
  days: Readonly<Record<YmdDate, AgendaBiometricosConfigDay | undefined>>;
}>;

export type AgendaBiometricosBookingStatus = "booked" | "cancelled";

export type AgendaBiometricosBookingV1 = Readonly<{
  id: string;
  expedienteId: string;
  date: YmdDate;
  locationId: AgendaBiometricosLocationId;
  time: HhmmTime;
  status: AgendaBiometricosBookingStatus;
  createdAt: string;
  createdBy: Readonly<{ email: string; role: AgendaBiometricosBookingActorRole }>;
  note: string | null;
}>;

export type AgendaBiometricosBookingsV1 = Readonly<{
  version: 1;
  kind: "biometricos";
  updatedAt: string;
  bookings: readonly AgendaBiometricosBookingV1[];
}>;

export type AgendaBiometricosSlotAvailability = Readonly<{
  date: YmdDate;
  locationId: AgendaBiometricosLocationId;
  time: HhmmTime;
  capacity: number;
  bookedCount: number;
  remaining: number;
}>;

