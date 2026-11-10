import type { jsPDF } from 'jspdf';
import { mejorPunto, rankingsDe } from '../../api/reportes';
import type { Agrupacion, FilaRentabilidad, PuntoEvolucion, Rentabilidad } from '../../api/reportes';
import { formatPrice } from '../../api/services';

type Color = [number, number, number];

const VIOLETA: Color = [163, 95, 218];
const VIOLETA_SUAVE: Color = [218, 191, 240];
const LILA: Color = [243, 232, 255];
const NEGRO: Color = [23, 23, 23];
const GRIS: Color = [115, 115, 115];
const LINEA: Color = [229, 231, 235];
const AMBAR: Color = [146, 64, 14];
const AMBAR_FONDO: Color = [255, 251, 235];

// Medidas en milímetros, hoja A4
const MARGEN = 15;
const ANCHO = 180;
const ALTO_UTIL = 282;
const MAX_BARRAS = 8;

// Las fuentes del PDF no tienen estos caracteres, y el formato de moneda usa espacios especiales
const limpiar = (texto: string) => texto.replace(/[\u00A0\u202F]/g, ' ').replace(/[\u2013\u2014\u2212]/g, '-');
const plata = (valor: string | number) => limpiar(formatPrice(valor));
const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

export interface DatosRentabilidadPdf {
  reporte: Rentabilidad;
  evolucion: PuntoEvolucion[];
  agrupacion: Agrupacion;
  periodo: string;
  profesional: string;
  servicio: string;
}

// Arma el reporte: período y filtros, totales, destacados, gráficos y tablas.
// Las librerías se cargan recién acá, para que no pesen en el resto de la página
export const generarRentabilidadPdf = async ({ reporte, evolucion, agrupacion, periodo, profesional, servicio }: DatosRentabilidadPdf) => {
  const [{ jsPDF: JsPdf }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new JsPdf({ unit: 'mm', format: 'a4' });
  let y = 0;

  const fuente = (tamanio: number, color: Color = NEGRO, estilo: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', estilo);
    doc.setFontSize(tamanio);
    doc.setTextColor(...color);
  };

  // Si lo que sigue no entra, pasa a otra hoja
  const reservar = (alto: number) => {
    if (y + alto <= ALTO_UTIL) return;
    doc.addPage();
    y = MARGEN;
  };

  const tituloDeSeccion = (texto: string) => {
    fuente(12, NEGRO, 'bold');
    doc.text(texto, MARGEN, y);
    y += 5;
  };

  // Encabezado
  doc.setFillColor(...VIOLETA);
  doc.rect(0, 0, 210, 3, 'F');
  y = 14;
  fuente(10, VIOLETA, 'bold');
  doc.text('CapiLAR', MARGEN, y);
  y += 8;
  fuente(20, NEGRO, 'bold');
  doc.text('Reporte de rentabilidad', MARGEN, y);
  y += 7;
  fuente(10, NEGRO, 'bold');
  doc.text(limpiar(`Período: ${capitalizar(periodo)}`), MARGEN, y);
  y += 5;
  fuente(9, GRIS);
  doc.text(limpiar(`Profesional: ${profesional}  ·  Servicio: ${servicio}`), MARGEN, y);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, MARGEN + ANCHO, y, { align: 'right' });
  y += 7;

  // Totales
  const { total } = reporte;
  const tarjetas: [string, string][] = [
    ['COBRADO', plata(total.cobrado)],
    ['PRODUCTOS', plata(total.costo)],
    ['MARGEN', plata(total.margen)],
    ['TURNOS', String(total.turnos)],
  ];
  const anchoTarjeta = (ANCHO - 9) / 4;
  tarjetas.forEach(([titulo, valor], index) => {
    const x = MARGEN + index * (anchoTarjeta + 3);
    doc.setDrawColor(...LINEA);
    doc.roundedRect(x, y, anchoTarjeta, 18, 1.5, 1.5, 'S');
    fuente(7, GRIS, 'bold');
    doc.text(titulo, x + 3, y + 6);
    fuente(13, NEGRO, 'bold');
    doc.text(valor, x + 3, y + 13.5);
  });
  y += 23;

  if (total.conCostoIncompleto > 0) {
    doc.setFillColor(...AMBAR_FONDO);
    doc.roundedRect(MARGEN, y, ANCHO, 8, 1.5, 1.5, 'F');
    fuente(9, AMBAR);
    const servicios = total.conCostoIncompleto === 1 ? '1 servicio tiene' : `${total.conCostoIncompleto} servicios tienen`;
    doc.text(`${servicios} productos sin precio: el margen real es menor.`, MARGEN + 3, y + 5.3);
    y += 13;
  }

  // Destacados
  const { porCantidad, porMargen } = rankingsDe(reporte);
  const mejor = mejorPunto(evolucion);
  const nombrePeriodo = agrupacion === 'semana' ? 'SEMANA' : 'MES';
  const veces = `${porCantidad[0].cantidad} ${porCantidad[0].cantidad === 1 ? 'vez' : 'veces'}`;
  const destacados: [string, string, string][] = [
    ['SERVICIO MÁS SOLICITADO', porCantidad[0].servicio, veces],
    ['SERVICIO CON MÁS MARGEN', porMargen[0].servicio, `${plata(porMargen[0].margen)} de margen`],
    [`${nombrePeriodo} CON MÁS MARGEN`, mejor ? capitalizar(limpiar(mejor.largo)) : 'Sin margen', mejor ? `${plata(mejor.margen)} de margen` : ''],
  ];
  const anchoDestacado = (ANCHO - 6) / 3;
  destacados.forEach(([titulo, valor, detalle], index) => {
    const x = MARGEN + index * (anchoDestacado + 3);
    doc.setDrawColor(...LINEA);
    doc.roundedRect(x, y, anchoDestacado, 21, 1.5, 1.5, 'S');
    fuente(7, GRIS, 'bold');
    doc.text(titulo, x + 3, y + 6);
    fuente(11, NEGRO, 'bold');
    doc.text(doc.splitTextToSize(limpiar(valor), anchoDestacado - 6)[0], x + 3, y + 12);
    fuente(9, GRIS);
    doc.text(detalle, x + 3, y + 17.5);
  });
  y += 29;

  // Margen por semana o mes, con la mejor resaltada
  const altoGrafico = 45;
  reservar(altoGrafico + 22);
  tituloDeSeccion(`Margen por ${agrupacion === 'semana' ? 'semana' : 'mes'}`);
  y += 6;
  const maximo = Math.max(...evolucion.map((punto) => punto.margen), 0);
  const potencia = maximo > 0 ? 10 ** Math.floor(Math.log10(maximo)) : 1;
  const escala = maximo / potencia;
  const techo = maximo > 0 ? (escala <= 1 ? 1 : escala <= 2 ? 2 : escala <= 5 ? 5 : 10) * potencia : 1;
  const ejeX = MARGEN + 22;
  const anchoEje = ANCHO - 22;
  const base = y + altoGrafico;
  [1, 0.5, 0].forEach((parte) => {
    const lineaY = base - altoGrafico * parte;
    doc.setDrawColor(...LINEA);
    doc.line(ejeX, lineaY, MARGEN + ANCHO, lineaY);
    fuente(7, GRIS);
    doc.text(plata(techo * parte), ejeX - 2, lineaY + 1, { align: 'right' });
  });
  const anchoTramo = anchoEje / Math.max(evolucion.length, 1);
  const anchoBarra = Math.min(7, anchoTramo - 2);
  evolucion.forEach((punto, index) => {
    const centro = ejeX + anchoTramo * (index + 0.5);
    const altura = (Math.max(punto.margen, 0) / techo) * altoGrafico;
    if (altura > 0) {
      doc.setFillColor(...(punto === mejor ? VIOLETA : VIOLETA_SUAVE));
      doc.rect(centro - anchoBarra / 2, base - altura, anchoBarra, altura, 'F');
    }
    if (punto === mejor) {
      fuente(8, NEGRO, 'bold');
      const valor = plata(punto.margen);
      // Fondo blanco: la línea del eje no tiene que cruzar el número
      const anchoValor = doc.getTextWidth(valor) + 2;
      doc.setFillColor(255, 255, 255);
      doc.rect(centro - anchoValor / 2, base - altura - 4.6, anchoValor, 3.8, 'F');
      doc.text(valor, centro, base - altura - 1.5, { align: 'center' });
    }
    fuente(7, GRIS);
    doc.text(doc.splitTextToSize(limpiar(punto.label), anchoTramo - 1), centro, base + 4, { align: 'center' });
  });
  y = base + 14;

  // Rankings de servicios, uno al lado del otro
  const filasSolicitados = porCantidad.slice(0, MAX_BARRAS).map((fila) => ({ label: fila.servicio, valor: fila.cantidad, texto: String(fila.cantidad) }));
  const filasMargen = porMargen.slice(0, MAX_BARRAS).map((fila) => ({ label: fila.servicio, valor: Number(fila.margen), texto: plata(fila.margen) }));
  const anchoRanking = (ANCHO - 8) / 2;
  reservar(10 + filasSolicitados.length * 9);
  const inicioRankings = y;
  const ranking = (titulo: string, filas: typeof filasMargen, x: number) => {
    let filaY = inicioRankings;
    fuente(12, NEGRO, 'bold');
    doc.text(titulo, x, filaY);
    filaY += 7;
    const mayor = Math.max(...filas.map((fila) => fila.valor), 0);
    filas.forEach((fila) => {
      fuente(9, NEGRO);
      doc.text(doc.splitTextToSize(limpiar(fila.label), anchoRanking - 24)[0], x, filaY);
      fuente(9, fila.valor < 0 ? ([239, 68, 68] as Color) : NEGRO, 'bold');
      doc.text(fila.texto, x + anchoRanking, filaY, { align: 'right' });
      doc.setFillColor(...LINEA);
      doc.rect(x, filaY + 1.5, anchoRanking, 1.6, 'F');
      if (mayor > 0 && fila.valor > 0) {
        doc.setFillColor(...VIOLETA);
        doc.rect(x, filaY + 1.5, (fila.valor / mayor) * anchoRanking, 1.6, 'F');
      }
      filaY += 9;
    });
  };
  ranking('Servicios más solicitados', filasSolicitados, MARGEN);
  ranking('Margen por servicio', filasMargen, MARGEN + anchoRanking + 8);
  y = inicioRankings + 10 + filasSolicitados.length * 9;

  // Tablas
  const tabla = <T extends FilaRentabilidad>(titulo: string, columna: string, filas: T[], nombreDe: (fila: T) => string) => {
    reservar(26);
    tituloDeSeccion(titulo);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN },
      theme: 'grid',
      rowPageBreak: 'avoid',
      head: [[columna, 'Cant.', 'Cobrado', 'Productos', 'Margen']],
      body: filas.map((fila) => [limpiar(nombreDe(fila)), String(fila.cantidad), plata(fila.cobrado), plata(fila.costo), plata(fila.margen)]),
      styles: { font: 'helvetica', fontSize: 9, textColor: NEGRO, lineColor: LINEA, lineWidth: 0.1, cellPadding: 2 },
      headStyles: { fillColor: LILA, textColor: NEGRO, fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: ({ section, column, cell }) => {
        if (section === 'head' && column.index > 0) cell.styles.halign = 'right';
      },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  };
  tabla('Por servicio', 'Servicio', reporte.porServicio, (fila) => fila.servicio);
  tabla('Por profesional', 'Profesional', reporte.porProfesional, (fila) => fila.profesional);

  // Número de página, al terminar para saber el total
  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina);
    fuente(8, GRIS);
    doc.text(`CapiLAR  ·  Página ${pagina} de ${paginas}`, 105, 291, { align: 'center' });
  }

  return doc;
};
