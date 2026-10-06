import { apiFetch } from './client';

// PENDIENTE: lo pidió el cliente y espera al profesional. REPROGRAMADO: el salón propuso otro horario y espera al cliente.
// RECHAZADO y CANCELADO liberan el horario.
export type EstadoTurno = 'PENDIENTE' | 'CONFIRMADO' | 'REPROGRAMADO' | 'COMPLETADO' | 'RECHAZADO' | 'CANCELADO';

export type MetodoPago = 'EFECTIVO' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA';

// Un servicio del turno, con su profesional y su propio horario (se hacen uno después del otro)
export interface TurnoDetalle {
  id: number;
  servicioId: number;
  servicio: string;
  legajo: number;
  profesional: string;
  horaInicio: string;
  horaFin: string;
  // Precio al reservar, como texto ("15000.00")
  precioBase: string;
}

export interface Turno {
  id: number;
  // "YYYY-MM-DD" y "HH:mm", hora local del salón
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: EstadoTurno;
  metodoPago: MetodoPago | null;
  // Motivo de la cancelación (lo ven las dos partes) o del rechazo (el cliente no lo recibe)
  motivo?: string | null;
  cliente: {
    id: number;
    nombre: string;
    apellido: string;
    telefono: string;
    alergia: string | null;
  };
  detalles: TurnoDetalle[];
}

// Servicio del turno y quién lo hace, en el orden en que se hacen
export interface TurnoItem {
  servicioId: number;
  legajo: number;
}

export interface HorariosLibres {
  fecha: string;
  // Minutos que dura el turno completo
  duracion: number;
  // Horarios de inicio posibles, cada 15 minutos
  horarios: string[];
}

export interface CreateTurnoData {
  fecha: string;
  horaInicio: string;
  items: TurnoItem[];
  // Solo PROFESIONAL o ADMIN, al cargar un turno a nombre de un cliente (nace CONFIRMADO)
  clienteId?: number;
}

// Reglas del salón (las mismas que valida el back)
export const MAX_DIAS_ANTICIPACION = 60;
export const HORAS_CANCELACION_CLIENTE = 12;
// La agenda se consulta de a 31 días como máximo
export const MAX_DIAS_AGENDA = 31;

// Endpoints de turnos. El back valida el rol en cada uno.

// clienteId: el salón carga un turno para un cliente (descarta los horarios en que ese cliente ya tiene otro turno).
// turnoId: al reprogramar, el horario actual de ese turno no cuenta como ocupado.
export interface HorariosLibresOptions {
  clienteId?: number;
  turnoId?: number;
}

export const getHorariosLibresRequest = (token: string, fecha: string, items: TurnoItem[], options: HorariosLibresOptions = {}) =>
  apiFetch<HorariosLibres>('/turnos/horarios-libres', { method: 'POST', body: { fecha, items, ...options }, token });

// CLIENTE: queda PENDIENTE. PROFESIONAL / ADMIN con clienteId: queda CONFIRMADO
export const createTurnoRequest = (token: string, data: CreateTurnoData) =>
  apiFetch<Turno>('/turnos', { method: 'POST', body: data, token });

// Turnos del cliente logueado, del más nuevo al más viejo
export const getMyTurnosRequest = (token: string) => apiFetch<Turno[]>('/turnos/mios', { token });

// Turnos del profesional logueado entre dos fechas (incluidas), ordenados por fecha y hora
export const getAgendaRequest = (token: string, desde: string, hasta: string) =>
  apiFetch<Turno[]>(`/turnos/agenda?${new URLSearchParams({ desde, hasta })}`, { token });

export const acceptTurnoRequest = (token: string, id: number) =>
  apiFetch<Turno>(`/turnos/${id}/aceptar`, { method: 'PATCH', token });

// El motivo es interno: el cliente recibe un aviso amable sin él
export const rejectTurnoRequest = (token: string, id: number, motivo: string) =>
  apiFetch<Turno>(`/turnos/${id}/rechazar`, { method: 'PATCH', body: { motivo }, token });

// Queda REPROGRAMADO hasta que el cliente lo acepte
export const rescheduleTurnoRequest = (token: string, id: number, fecha: string, horaInicio: string) =>
  apiFetch<Turno>(`/turnos/${id}/reprogramar`, { method: 'PATCH', body: { fecha, horaInicio }, token });

export const acceptRescheduleRequest = (token: string, id: number) =>
  apiFetch<Turno>(`/turnos/${id}/aceptar-reprogramacion`, { method: 'PATCH', token });

// Motivo obligatorio si cancela el salón; opcional para el cliente
export const cancelTurnoRequest = (token: string, id: number, motivo?: string) =>
  apiFetch<Turno>(`/turnos/${id}/cancelar`, { method: 'PATCH', body: motivo ? { motivo } : {}, token });

export const completeTurnoRequest = (token: string, id: number) =>
  apiFetch<Turno>(`/turnos/${id}/completar`, { method: 'PATCH', token });

// --- Fechas: viajan como "YYYY-MM-DD" y "HH:mm" locales, así no hay corrimientos por zona horaria ---

const pad = (n: number) => String(n).padStart(2, '0');

// Date local -> "2026-10-07"
export const toIsoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// "2026-10-07" -> Date local a las 00:00
export const fromIsoDate = (fecha: string) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

// "2026-10-07" -> "martes 7 de octubre"
export const formatFechaLarga = (fecha: string) =>
  fromIsoDate(fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

// "2026-10-07" -> "mar 7 oct"
export const formatFechaCorta = (fecha: string) =>
  fromIsoDate(fecha).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

// Minutos que faltan para que empiece el turno (negativo si ya empezó)
export const minutosHastaInicio = (turno: Pick<Turno, 'fecha' | 'horaInicio'>) => {
  const [h, m] = turno.horaInicio.split(':').map(Number);
  const inicio = fromIsoDate(turno.fecha);
  inicio.setHours(h, m);
  return Math.floor((inicio.getTime() - Date.now()) / 60000);
};

// Ya terminó (para separar los próximos del historial)
export const yaTermino = (turno: Pick<Turno, 'fecha' | 'horaFin'>) =>
  minutosHastaInicio({ fecha: turno.fecha, horaInicio: turno.horaFin }) <= 0;

// Mismo criterio que el back: un CONFIRMADO se cancela hasta 12 h antes; pendientes y reprogramados, hasta que empiece
export const clientePuedeCancelar = (turno: Turno) => {
  if (!['PENDIENTE', 'CONFIRMADO', 'REPROGRAMADO'].includes(turno.estado)) return false;
  const faltan = minutosHastaInicio(turno);
  if (faltan <= 0) return false;
  return turno.estado !== 'CONFIRMADO' || faltan >= HORAS_CANCELACION_CLIENTE * 60;
};

// Lunes de la semana de `date`
export const startOfWeek = (date: Date) => {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
};

// "6 al 12 de octubre" / "29 de septiembre al 5 de octubre"
export const formatWeek = (monday: Date) => {
  const sunday = addDays(monday, 6);
  const end = sunday.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
  const start =
    monday.getMonth() === sunday.getMonth()
      ? monday.getDate()
      : monday.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
  return `${start} al ${end}`;
};

