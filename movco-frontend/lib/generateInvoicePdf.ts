type InvoicePdfData = {
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  invoiceRef: string;
  invoiceDate: string;
  dueDate?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  movingFrom?: string;
  movingTo?: string;
  movingDate?: string;
  estimatedPrice?: number;
  notes?: string;
  branding?: {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    footer_text?: string;
    bank_details?: string;
    payment_terms?: string;
    text_color?: string;
  };
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

export async function downloadInvoicePdf(data: InvoicePdfData, filename?: string) {
  const { default: jsPDF } = await import('jspdf');

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const branding = data.branding || {};
  const primaryColor: [number, number, number] = branding.primary_color ? hexToRgb(branding.primary_color) : [10, 15, 28];
  const accentColor: [number, number, number] = branding.secondary_color ? hexToRgb(branding.secondary_color) : [37, 99, 235];
  const grayColor: [number, number, number] = [107, 114, 128];
  const lightGray: [number, number, number] = [243, 244, 246];
  const headerTextColor: [number, number, number] = branding.text_color ? hexToRgb(branding.text_color) : [255, 255, 255];

  // ===== HEADER =====
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  let logoOffset = 0;
  if (branding.logo_url) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = branding.logo_url!;
      });
      const logoH = 20;
      const logoW = (img.width / img.height) * logoH;
      doc.addImage(img, 'PNG', margin, 10, logoW, logoH);
      logoOffset = logoW + 6;
    } catch {}
  }

  doc.setTextColor(...headerTextColor);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName.toUpperCase(), margin + logoOffset, 18);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const headerInfo: string[] = [];
  if (data.companyEmail) headerInfo.push(data.companyEmail);
  if (data.companyPhone) headerInfo.push(data.companyPhone);
  if (headerInfo.length > 0) doc.text(headerInfo.join('  |  '), margin + logoOffset, 28);

  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...headerTextColor);
  doc.text('INVOICE', pageWidth - margin, 22, { align: 'right' });

  y = 52;

  // ===== INVOICE META =====
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  const metaItems = [
    `Invoice No: ${data.invoiceRef}`,
    `Date: ${data.invoiceDate}`,
    data.dueDate ? `Due: ${data.dueDate}` : '',
  ].filter(Boolean);
  doc.text(metaItems.join('   |   '), margin, y);
  y += 10;

  // ===== TWO-COLUMN BOXES =====
  const colWidth = (contentWidth - 8) / 2;

  // Customer box
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, y, colWidth, 48, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('BILLED TO', margin + 6, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text(data.customerName, margin + 6, y + 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  let cy = y + 24;
  if (data.customerEmail) { doc.text(data.customerEmail, margin + 6, cy); cy += 6; }
  if (data.customerPhone) { doc.text(data.customerPhone, margin + 6, cy); }

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
    const fromText = doc.splitTextToSize(data.movingFrom, colWidth - 28);
    doc.text(fromText, col2X + 22, my);
    my += fromText.length * 5 + 2;
  }
  if (data.movingTo) {
    doc.setFont('helvetica', 'bold');
    doc.text('To:', col2X + 6, my);
    doc.setFont('helvetica', 'normal');
    const toText = doc.splitTextToSize(data.movingTo, colWidth - 28);
    doc.text(toText, col2X + 22, my);
    my += toText.length * 5 + 2;
  }
  if (data.movingDate) {
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', col2X + 6, my);
    doc.setFont('helvetica', 'normal');
    doc.text(
      new Date(data.movingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      col2X + 22, my
    );
  }

  y += 58;

  // ===== INVOICE LINE ITEM =====
  doc.setFillColor(...primaryColor);
  doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('DESCRIPTION', margin + 4, y + 7);
  doc.text('AMOUNT', pageWidth - margin - 4, y + 7, { align: 'right' });
  y += 14;

  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryColor);
  doc.text('Removal Service', margin + 4, y + 8);
  if (data.estimatedPrice) {
    doc.text(
      `£${data.estimatedPrice.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      pageWidth - margin - 4, y + 8, { align: 'right' }
    );
  }
  y += 20;

  // ===== TOTALS =====
  if (data.estimatedPrice) {
    const exVat = data.estimatedPrice;
    const vatAmount = exVat * 0.20;
    const incVat = exVat + vatAmount;

    // Subtotal
    doc.setFillColor(...lightGray);
    doc.roundedRect(pageWidth - margin - 80, y, 80, 14, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayColor);
    doc.text('SUBTOTAL (ex. VAT)', pageWidth - margin - 42, y + 6, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(`£${exVat.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin - 2, y + 6, { align: 'right' });
    y += 16;

    // VAT
    doc.setFillColor(...lightGray);
    doc.roundedRect(pageWidth - margin - 80, y, 80, 14, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayColor);
    doc.text('VAT (20%)', pageWidth - margin - 42, y + 6, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(`£${vatAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin - 2, y + 6, { align: 'right' });
    y += 16;

    // Total
    doc.setFillColor(...accentColor);
    doc.roundedRect(pageWidth - margin - 80, y, 80, 28, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL DUE (inc. VAT)', pageWidth - margin - 40, y + 8, { align: 'center' });
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `£${incVat.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      pageWidth - margin - 40, y + 22, { align: 'center' }
    );
    y += 36;
  }

  // ===== PAYMENT TERMS =====
  if (branding.payment_terms) {
    y += 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayColor);
    doc.text(branding.payment_terms, margin, y);
    y += 8;
  }

  // ===== BANK DETAILS =====
  if (branding.bank_details) {
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('PAYMENT DETAILS', margin, y);
    y += 5;
    const bankLines = doc.splitTextToSize(branding.bank_details, contentWidth - 12);
    doc.setFillColor(...lightGray);
    doc.roundedRect(margin, y, contentWidth, bankLines.length * 4.5 + 8, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayColor);
    doc.text(bankLines, margin + 6, y + 6);
    y += bankLines.length * 4.5 + 14;
  }

  // ===== NOTES =====
  if (data.notes) {
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('NOTES', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
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
  doc.text(branding.footer_text || 'Thank you for your business.', margin, footerY);
  doc.text(`Generated by ${data.companyName}`, margin, footerY + 4);
  doc.text(`Page 1 of 1`, pageWidth - margin, footerY, { align: 'right' });

  const fname = filename || `invoice-${data.customerName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
}