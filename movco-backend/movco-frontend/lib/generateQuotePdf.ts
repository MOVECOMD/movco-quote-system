import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type QuotePdfData = {
  // Company info
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;

  // Quote info
  quoteRef?: string;
  quoteDate: string;
  validUntil?: string;
  status?: string;

  // Customer info
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;

  // Move details
  movingFrom?: string;
  movingTo?: string;
  movingDate?: string;

  // Items & logistics
  items?: { name: string; quantity: number; estimated_volume_ft3?: number }[];
  totalVolume?: number;
  vanCount?: number;
  movers?: number;
  estimatedPrice?: number;

  // Notes
  notes?: string;
};

export function generateQuotePdf(data: QuotePdfData) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors
  const primaryColor: [number, number, number] = [10, 15, 28]; // dark navy #0a0f1c
  const accentColor: [number, number, number] = [37, 99, 235]; // blue-600
  const greenColor: [number, number, number] = [22, 163, 74]; // green-600
  const grayColor: [number, number, number] = [107, 114, 128];
  const lightGray: [number, number, number] = [243, 244, 246];

  // ===== HEADER BAR =====
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName.toUpperCase(), margin, 18);

  // Contact info in header
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const headerInfo: string[] = [];
  if (data.companyEmail) headerInfo.push(data.companyEmail);
  if (data.companyPhone) headerInfo.push(data.companyPhone);
  if (headerInfo.length > 0) {
    doc.text(headerInfo.join('  |  '), margin, 28);
  }

  // QUOTE label on right side
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('QUOTE', pageWidth - margin, 22, { align: 'right' });

  y = 52;

  // ===== QUOTE REF & DATE ROW =====
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);

  const refText = data.quoteRef ? `Ref: ${data.quoteRef}` : '';
  const dateText = `Date: ${data.quoteDate}`;
  const validText = data.validUntil ? `Valid until: ${data.validUntil}` : '';
  const statusText = data.status ? `Status: ${data.status.toUpperCase()}` : '';

  const metaItems = [refText, dateText, validText, statusText].filter(Boolean);
  doc.text(metaItems.join('   |   '), margin, y);
  y += 10;

  // ===== TWO-COLUMN: CUSTOMER / MOVE DETAILS =====
  const colWidth = (contentWidth - 8) / 2;

  // Customer details box
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, y, colWidth, 48, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('CUSTOMER DETAILS', margin + 6, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text(data.customerName, margin + 6, y + 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  let cy = y + 24;
  if (data.customerEmail) { doc.text(data.customerEmail, margin + 6, cy); cy += 6; }
  if (data.customerPhone) { doc.text(data.customerPhone, margin + 6, cy); cy += 6; }

  // Move details box
  const col2X = margin + colWidth + 8;
  doc.setFillColor(...lightGray);
  doc.roundedRect(col2X, y, colWidth, 48, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('MOVE DETAILS', col2X + 6, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  let my = y + 17;
  if (data.movingFrom) {
    doc.setFont('helvetica', 'bold');
    doc.text('From:', col2X + 6, my);
    doc.setFont('helvetica', 'normal');
    doc.text(data.movingFrom, col2X + 22, my);
    my += 7;
  }
  if (data.movingTo) {
    doc.setFont('helvetica', 'bold');
    doc.text('To:', col2X + 6, my);
    doc.setFont('helvetica', 'normal');
    doc.text(data.movingTo, col2X + 22, my);
    my += 7;
  }
  if (data.movingDate) {
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', col2X + 6, my);
    doc.setFont('helvetica', 'normal');
    const formattedDate = new Date(data.movingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(formattedDate, col2X + 22, my);
  }

  y += 58;

  // ===== ITEMS TABLE =====
  if (data.items && data.items.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('ITEMS', margin, y);
    y += 4;

    const tableBody = data.items.map((item, idx) => [
      (idx + 1).toString(),
      item.name,
      item.quantity.toString(),
      item.estimated_volume_ft3 ? `${item.estimated_volume_ft3.toFixed(1)} ft³` : '—',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Item', 'Qty', 'Volume']],
      body: tableBody,
      margin: { left: margin, right: margin },
      theme: 'plain',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3.5,
        textColor: [55, 65, 81],
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ===== LOGISTICS SUMMARY =====
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'F');

  const logItems: string[] = [];
  if (data.totalVolume) logItems.push(`Total Volume: ${data.totalVolume} m³`);
  if (data.vanCount) logItems.push(`Vans: ${data.vanCount}`);
  if (data.movers) logItems.push(`Movers: ${data.movers}`);

  if (logItems.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayColor);

    const spacing = contentWidth / logItems.length;
    logItems.forEach((item, idx) => {
      doc.text(item, margin + spacing * idx + spacing / 2, y + 13, { align: 'center' });
    });
  }

  y += 30;

  // ===== TOTAL PRICE =====
  if (data.estimatedPrice) {
    doc.setFillColor(...accentColor);
    doc.roundedRect(pageWidth - margin - 80, y, 80, 28, 2, 2, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL', pageWidth - margin - 40, y + 8, { align: 'center' });

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`£${data.estimatedPrice.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin - 40, y + 22, { align: 'center' });

    y += 36;
  }

  // ===== NOTES =====
  if (data.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('NOTES', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    const splitNotes = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(splitNotes, margin, y);
    y += splitNotes.length * 4 + 6;
  }

  // ===== FOOTER =====
  const footerY = pageHeight - 20;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  doc.text('This quote is subject to a final survey of items. Prices may vary based on actual volume and access requirements.', margin, footerY);
  doc.text(`Generated by ${data.companyName} via MOVCO`, margin, footerY + 4);
  doc.text(`Page 1 of 1`, pageWidth - margin, footerY, { align: 'right' });

  return doc;
}

export function downloadQuotePdf(data: QuotePdfData, filename?: string) {
  const doc = generateQuotePdf(data);
  const fname = filename || `quote-${data.customerName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
}
