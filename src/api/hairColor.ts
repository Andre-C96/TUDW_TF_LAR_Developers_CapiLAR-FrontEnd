import { apiFetch } from './client';

// Prueba virtual de color (TP3, API 1). El back llama a YouCam: la clave nunca llega al navegador.

export interface VistaPreviaColor {
  // Imagen con el color aplicado (en modo simulado, la misma selfie como data URL)
  url: string;
  // Hasta cuándo sirve el link (YouCam lo guarda 2 horas)
  venceEn: string;
  // true si el back no llamó a YouCam (YOUCAM_MODO=simulado)
  simulado: boolean;
}

export interface ColorCarta {
  nombre: string;
  hex: string;
}

// Carta de colores del salón (se puede ajustar con las profesionales)
export const CARTA_DE_COLORES: ColorCarta[] = [
  { nombre: 'Rubio ceniza', hex: '#B8A68A' },
  { nombre: 'Rubio miel', hex: '#C8964E' },
  { nombre: 'Castaño claro', hex: '#8B6542' },
  { nombre: 'Castaño chocolate', hex: '#4E3424' },
  { nombre: 'Cobrizo', hex: '#A4552B' },
  { nombre: 'Rojo borgoña', hex: '#6E1F2E' },
  { nombre: 'Negro azulado', hex: '#1C1E2B' },
  { nombre: 'Fantasía violeta', hex: '#6B3FA0' },
];

// Igual que el back: de 0 a 100, 80 si no se manda
export const INTENSIDAD_POR_DEFECTO = 80;

// La foto va en multipart (campo "foto") junto con el color y la intensidad. Cada llamada real gasta 1 unit de YouCam.
export const previewHairColorRequest = (token: string, foto: Blob, color: string, intensidad?: number) => {
  const body = new FormData();
  body.append('foto', foto, 'selfie.jpg');
  body.append('color', color);
  if (intensidad !== undefined) body.append('intensidad', String(intensidad));
  return apiFetch<VistaPreviaColor>('/hair-color/preview', { method: 'POST', body, token });
};
