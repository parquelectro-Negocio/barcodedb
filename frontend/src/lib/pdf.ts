// Client-side PDF generation for receipts and quotes. jsPDF is loaded lazily
// (dynamic import) so it never weighs down the initial bundle.
import { API_BASE } from './config';

export type PdfLine = { name: string; quantity: number; unitPrice: number; total: number };

export type PdfDoc = {
  kind: 'recibo' | 'presupuesto';
  businessName: string;
  logoDataUrl?: string;
  docNumber?: string;
  dateISO?: string;
  customer?: string;
  lines: PdfLine[];
  total: number;
  payment?: string;
  amountTendered?: number;
  change?: number;
  validityDays?: number;
};

// Pull the shop logo through our backend proxy (R2 sends no CORS headers), then
// downscale + re-encode it as a small JPEG. jsPDF embeds source PNGs almost raw
// (a full-size logo can bloat the PDF to tens of MB), so shrinking first keeps the
// file WhatsApp-friendly. White background flattens any transparency. undefined on failure.
export async function fetchLogoDataUrl(logoUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${API_BASE}/images/proxy?url=${encodeURIComponent(logoUrl)}`);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const max = 160;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return undefined;
  }
}

const money = (n: number) =>
  '$' + (isFinite(n) ? n : 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function generateDocumentPDF(d: PdfDoc): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const green: [number, number, number] = [46, 125, 79];
  const dark: [number, number, number] = [41, 37, 36];
  const gray: [number, number, number] = [120, 113, 108];
  let y = 58;

  let nameX = M;
  if (d.logoDataUrl) {
    try {
      const props = doc.getImageProperties(d.logoDataUrl);
      const h = 46;
      const w = Math.min(150, h * (props.width / props.height));
      const fmt = /^data:image\/png/i.test(d.logoDataUrl) ? 'PNG' : 'JPEG';
      doc.addImage(d.logoDataUrl, fmt, M, y - 34, w, h);
      nameX = M + w + 14;
    } catch { /* bad image — fall back to text-only header */ }
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...dark);
  doc.text(d.businessName || 'Comercio', nameX, y);

  const label = d.kind === 'recibo' ? 'RECIBO' : 'PRESUPUESTO';
  doc.setFontSize(16); doc.setTextColor(...green);
  doc.text(label, W - M, y, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gray);
  const dt = d.dateISO ? new Date(d.dateISO) : new Date();
  doc.text(dt.toLocaleString('es-AR'), W - M, y + 16, { align: 'right' });
  if (d.docNumber) doc.text('N° ' + d.docNumber, W - M, y + 28, { align: 'right' });

  y += 42;
  doc.setDrawColor(...green); doc.setLineWidth(1.5); doc.line(M, y, W - M, y);
  y += 24;

  if (d.customer) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...dark);
    doc.text('Cliente: ' + d.customer, M, y); y += 20;
  }

  const colQ = M;
  const colName = M + 44;
  const colUnit = W - M - 150;
  const colSub = W - M;

  doc.setFillColor(243, 242, 240); doc.rect(M, y - 12, W - 2 * M, 20, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...gray);
  doc.text('CANT.', colQ, y);
  doc.text('PRODUCTO', colName, y);
  doc.text('P. UNIT.', colUnit, y, { align: 'right' });
  doc.text('SUBTOTAL', colSub, y, { align: 'right' });
  y += 20;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...dark);
  const maxNameW = colUnit - colName - 60;
  for (const l of d.lines) {
    const original = l.name || '';
    let name = original;
    while (name.length > 4 && doc.getTextWidth(name) > maxNameW) name = name.slice(0, -2);
    if (name !== original) name = name.trimEnd() + '…';
    doc.text(String(l.quantity), colQ, y);
    doc.text(name, colName, y);
    doc.text(money(l.unitPrice), colUnit, y, { align: 'right' });
    doc.text(money(l.total), colSub, y, { align: 'right' });
    y += 18;
    if (y > 780) { doc.addPage(); y = 58; }
  }

  y += 6;
  doc.setDrawColor(220, 218, 215); doc.setLineWidth(0.8); doc.line(M, y, W - M, y);
  y += 26;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...dark);
  doc.text('TOTAL', colUnit, y, { align: 'right' });
  doc.setTextColor(...green);
  doc.text(money(d.total), colSub, y, { align: 'right' });
  y += 30;

  if (d.kind === 'recibo' && d.payment) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...gray);
    doc.text('Pago: ' + d.payment, M, y); y += 15;
    if (d.amountTendered) { doc.text('Abonó: ' + money(d.amountTendered), M, y); y += 15; }
    if (d.change) { doc.text('Vuelto: ' + money(d.change), M, y); y += 15; }
  }

  if (d.kind === 'presupuesto') {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(...gray);
    const days = d.validityDays ?? 7;
    doc.text(`Presupuesto válido por ${days} días. Precios sujetos a cambio.`, M, y);
    y += 16;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...dark);
    doc.text('No válido como factura.', M, y);
  }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...gray);
  doc.text('Generado con CodigoAR', W / 2, 812, { align: 'center' });

  return doc.output('blob');
}

// Share the PDF via the OS share sheet (ideal on mobile → WhatsApp), or fall
// back to a plain download when file-sharing isn't available.
export async function sharePDF(blob: Blob, filename: string, title: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'application/pdf' });
  const nav = navigator as any;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch { /* dismissed or failed — fall through to download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  return 'downloaded';
}
