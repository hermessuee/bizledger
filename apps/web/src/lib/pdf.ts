import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPaise, paiseToWords } from '@bizledger/shared';

export interface InvoicePdfData {
  business: {
    name: string;
    gstin?: string;
    address?: string;
    settings?: any;
  };
  document: {
    docType: string;
    docNo: string;
    docDate: string;
    dueDate?: string;
    placeOfSupply: string;
    subtotal: number;
    taxTotal: number;
    roundOff: number;
    total: number;
    lines: Array<{
      description: string;
      hsnSac?: string;
      qty: number;
      unit?: string;
      rate: number;
      discount: number;
      discountPercent?: number;
      gstRate: number;
      cgst: number;
      sgst: number;
      igst: number;
      lineTotal: number;
    }>;
  };
  party?: {
    name: string;
    gstin?: string;
    address?: string;
    phone?: string;
  };
}

export function generateInvoicePdf(data: InvoicePdfData, docInstance?: jsPDF) {
  const doc = docInstance || new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait',
  });

  const { business, document: inv, party } = data;
  const isInvoice = inv.docType === 'sales_invoice';
  const isCreditNote = inv.docType === 'credit_note';
  const isDebitNote = inv.docType === 'debit_note';
  const docTitle = isCreditNote
    ? 'CREDIT NOTE'
    : isDebitNote
    ? 'DEBIT NOTE'
    : isInvoice
    ? 'TAX INVOICE'
    : 'PURCHASE BILL';

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 28;
  const contentWidth = pageWidth - margin * 2; // 539.28 pt

  // Outer Corporate Border
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(1);
  doc.rect(margin, margin, contentWidth, pageHeight - margin * 2);

  // Top Title Bar (Grayscale / B&W Corporate Header)
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, margin, contentWidth, 24, 'F');
  doc.line(margin, margin + 24, margin + contentWidth, margin + 24);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(docTitle, pageWidth / 2, margin + 16, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('ORIGINAL FOR RECIPIENT', margin + contentWidth - 10, margin + 16, { align: 'right' });
  doc.text('(Statutory GST Document)', margin + 10, margin + 16);

  // Company Letterhead & Document Details Box (Two Columns)
  const headerBoxY = margin + 24;
  const headerBoxH = 75;
  doc.line(margin, headerBoxY + headerBoxH, margin + contentWidth, headerBoxY + headerBoxH);
  // Vertical divider between Company and Invoice Meta
  const dividerX = margin + 310;
  doc.line(dividerX, headerBoxY, dividerX, headerBoxY + headerBoxH);

  // Left Column: Supplier / Distributor Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const compName = (business.name || 'DISTRIBUTOR FIRM').toUpperCase();
  doc.text(compName, margin + 10, headerBoxY + 18);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const addr = business.address || 'Kerala';
  doc.text(addr.substring(0, 60), margin + 10, headerBoxY + 32);
  if (addr.length > 60) {
    doc.text(addr.substring(60, 120), margin + 10, headerBoxY + 44);
  }

  const gstinText = `GSTIN: ${business.gstin?.trim() ? business.gstin.trim() : 'Unregistered / Not Configured'}`;
  const stateText = `State: Kerala (State Code: 32)`;
  doc.setFont('helvetica', 'bold');
  doc.text(gstinText, margin + 10, headerBoxY + 58);
  doc.setFont('helvetica', 'normal');
  doc.text(stateText, margin + 10, headerBoxY + 70);

  // Right Column: Invoice Meta Details
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Doc / Invoice #:`, dividerX + 10, headerBoxY + 16);
  doc.text(inv.docNo, dividerX + 100, headerBoxY + 16);

  doc.setFont('helvetica', 'normal');
  doc.text(`Date:`, dividerX + 10, headerBoxY + 30);
  doc.text(inv.docDate || '-', dividerX + 100, headerBoxY + 30);

  doc.text(`Payment Due:`, dividerX + 10, headerBoxY + 44);
  doc.text(inv.dueDate || 'Immediate / On Demand', dividerX + 100, headerBoxY + 44);

  doc.text(`Place of Supply:`, dividerX + 10, headerBoxY + 58);
  const posCode = inv.placeOfSupply || '32';
  doc.text(`${posCode} - Kerala`, dividerX + 100, headerBoxY + 58);

  doc.text(`Reverse Charge:`, dividerX + 10, headerBoxY + 70);
  doc.text(`No`, dividerX + 100, headerBoxY + 70);

  // Buyer / Consignee Info Box (Two Columns)
  const partyBoxY = headerBoxY + headerBoxH;
  const partyBoxH = 65;
  doc.line(margin, partyBoxY + partyBoxH, margin + contentWidth, partyBoxY + partyBoxH);
  doc.line(dividerX, partyBoxY, dividerX, partyBoxY + partyBoxH);

  // Left Column: Details of Receiver (Billed To)
  doc.setFillColor(248, 248, 248);
  doc.rect(margin, partyBoxY, dividerX - margin, 14, 'F');
  doc.line(margin, partyBoxY + 14, dividerX, partyBoxY + 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAILS OF RECEIVER | BILLED TO:', margin + 10, partyBoxY + 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(party?.name || 'Cash Customer', margin + 10, partyBoxY + 26);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(party?.address ? party.address.substring(0, 55) : 'Kerala', margin + 10, partyBoxY + 38);
  const partyGstin = `GSTIN: ${party?.gstin?.trim() ? party.gstin.trim() : 'Unregistered'}`;
  doc.text(partyGstin, margin + 10, partyBoxY + 50);
  if (party?.phone) {
    doc.text(`Phone: ${party.phone}`, margin + 10, partyBoxY + 61);
  }

  // Right Column: Details of Consignee (Shipped To)
  doc.setFillColor(248, 248, 248);
  doc.rect(dividerX, partyBoxY, margin + contentWidth - dividerX, 14, 'F');
  doc.line(dividerX, partyBoxY + 14, margin + contentWidth, partyBoxY + 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAILS OF CONSIGNEE | SHIPPED TO:', dividerX + 10, partyBoxY + 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(party?.name || 'Cash Customer', dividerX + 10, partyBoxY + 26);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(party?.address ? party.address.substring(0, 45) : 'Kerala', dividerX + 10, partyBoxY + 38);
  doc.text(`Destination State: Kerala (32)`, dividerX + 10, partyBoxY + 50);
  doc.text(`Dispatched via: Direct Delivery / Transport`, dividerX + 10, partyBoxY + 61);

  // Line Items Table (Corporate Black & White Grid)
  const tableRows = inv.lines.map((l, index) => {
    const grossPaise = l.rate * l.qty;
    const discountPaise = l.discount || 0;
    const taxablePaise = grossPaise - discountPaise;
    const taxPaise = (l.cgst || 0) + (l.sgst || 0) + (l.igst || 0);
    const discStr = l.discountPercent !== undefined && l.discountPercent !== null
      ? `${Number(l.discountPercent)}%`
      : discountPaise > 0 && grossPaise > 0
      ? `${((discountPaise / grossPaise) * 100).toFixed(1)}%`
      : '0%';

    return [
      index + 1,
      l.description,
      l.hsnSac && l.hsnSac !== '-' ? l.hsnSac : '-',
      l.qty,
      l.unit || 'PCS',
      formatPaise(l.rate),
      discStr,
      formatPaise(taxablePaise),
      `${l.gstRate || 0}%`,
      formatPaise(taxPaise),
      formatPaise(l.lineTotal || (taxablePaise + taxPaise)),
    ];
  });

  autoTable(doc, {
    startY: partyBoxY + partyBoxH,
    head: [[
      '#',
      'Description of Goods / Services',
      'HSN/SAC',
      'Qty',
      'Unit',
      'Rate (Rs)',
      'Disc %',
      'Taxable Value (Rs)',
      'GST %',
      'Tax Amount (Rs)',
      'Total Amount (Rs)',
    ]],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [0, 0, 0],
      lineColor: [60, 60, 60],
      lineWidth: 0.5,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      lineColor: [60, 60, 60],
      lineWidth: 0.5,
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 140, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 42, halign: 'center' },
      3: { cellWidth: 32, halign: 'center' },
      4: { cellWidth: 28, halign: 'center' },
      5: { cellWidth: 46, halign: 'right' },
      6: { cellWidth: 36, halign: 'center' },
      7: { cellWidth: 54, halign: 'right' },
      8: { cellWidth: 33, halign: 'center' },
      9: { cellWidth: 48, halign: 'right' },
      10: { cellWidth: 60, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 360;

  // Amount in Words Bar
  const wordsY = finalY;
  doc.line(margin, wordsY, margin + contentWidth, wordsY);
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, wordsY, contentWidth, 20, 'F');
  doc.line(margin, wordsY + 20, margin + contentWidth, wordsY + 20);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  const words = paiseToWords(inv.total);
  doc.text(`Total Invoice Amount in Words: INR ${words} Only`, margin + 10, wordsY + 14, { maxWidth: contentWidth - 20 });

  // Calculate overall discount
  const totalDiscountPaise = inv.lines.reduce((acc, l) => acc + (l.discount || 0), 0);
  const grossSubtotalPaise = inv.lines.reduce((acc, l) => acc + (l.rate * l.qty), 0);

  // Bottom Summary & Banking Box (Two Columns)
  const bottomY = wordsY + 20;
  const bottomH = totalDiscountPaise > 0 ? 125 : 115;
  doc.line(margin, bottomY + bottomH, margin + contentWidth, bottomY + bottomH);
  doc.line(dividerX, bottomY, dividerX, bottomY + bottomH);

  // Left Column: Bank Details & Terms
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('BANK DETAILS FOR DIRECT REMITTANCE / RTGS / NEFT:', margin + 10, bottomY + 14);

  const bank = business.settings?.bankDetails;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Bank Name : ${bank?.bankName || 'State Bank of India'}`, margin + 10, bottomY + 27);
  doc.text(`A/c Number: ${bank?.accountNo || '382910482918'}`, margin + 10, bottomY + 39);
  doc.text(`IFSC Code : ${bank?.ifsc || 'SBIN0004921'} | Branch: ${bank?.branch || 'Ernakulam Main'}`, margin + 10, bottomY + 51);

  doc.setFont('helvetica', 'bold');
  doc.text('TERMS & CONDITIONS:', margin + 10, bottomY + 68);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('1. Goods once inspected & sold will not be returned without prior consent.', margin + 10, bottomY + 80);
  doc.text('2. Payment is due strictly as per agreed credit period.', margin + 10, bottomY + 91);
  doc.text('3. All disputes are subject to Kerala State judicial jurisdiction only.', margin + 10, bottomY + 102);

  // Right Column: Numerical Totals Table
  let calcRowY = bottomY + 13;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  if (totalDiscountPaise > 0) {
    doc.text('Gross Amount:', dividerX + 10, calcRowY);
    doc.text(`Rs. ${formatPaise(grossSubtotalPaise)}`, margin + contentWidth - 10, calcRowY, { align: 'right' });
    calcRowY += 12;

    doc.text('Trade Discount (-):', dividerX + 10, calcRowY);
    doc.text(`- Rs. ${formatPaise(totalDiscountPaise)}`, margin + contentWidth - 10, calcRowY, { align: 'right' });
    calcRowY += 12;
  }

  doc.text('Taxable Subtotal:', dividerX + 10, calcRowY);
  doc.text(`Rs. ${formatPaise(inv.subtotal)}`, margin + contentWidth - 10, calcRowY, { align: 'right' });
  calcRowY += 12;

  doc.text('Total Tax (GST):', dividerX + 10, calcRowY);
  doc.text(`Rs. ${formatPaise(inv.taxTotal)}`, margin + contentWidth - 10, calcRowY, { align: 'right' });
  calcRowY += 12;

  if (inv.roundOff !== 0) {
    doc.text('Round Off (+/-):', dividerX + 10, calcRowY);
    doc.text(`Rs. ${formatPaise(inv.roundOff)}`, margin + contentWidth - 10, calcRowY, { align: 'right' });
    calcRowY += 12;
  }

  // Grand Total Highlighted Box (Black & White Clean)
  doc.setLineWidth(1);
  doc.setFillColor(242, 242, 242);
  doc.rect(dividerX + 5, calcRowY + 2, margin + contentWidth - dividerX - 10, 20, 'FD');
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('GRAND TOTAL:', dividerX + 12, calcRowY + 16);
  doc.text(`Rs. ${formatPaise(inv.total)}`, margin + contentWidth - 12, calcRowY + 16, { align: 'right' });

  // Signature Block
  const sigY = bottomY + bottomH;
  const sigH = pageHeight - margin - sigY;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('Certified that the particulars given above are true and correct.', margin + 10, sigY + 20);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`For ${compName}:`, dividerX + 10, sigY + 20);

  doc.line(dividerX + 10, sigY + 52, margin + contentWidth - 10, sigY + 52);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Authorised Signatory', dividerX + 55, sigY + 63);

  return doc;
}

export function downloadInvoicePdf(data: InvoicePdfData, filename?: string) {
  const doc = generateInvoicePdf(data);
  const safeDocNo = (data.document.docNo || 'INVOICE').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(filename || `Tax_Invoice_${safeDocNo}.pdf`);
}

// ---------------------------------------------------------------------------
// BATCH INVOICES PRINT GENERATOR (Multi-Page PDF)
// ---------------------------------------------------------------------------
export function downloadBatchInvoicesPdf(invoices: InvoicePdfData[], filename?: string) {
  if (!invoices || invoices.length === 0) return;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

  invoices.forEach((invData, idx) => {
    if (idx > 0) {
      doc.addPage();
    }
    generateInvoicePdf(invData, doc);
  });

  const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  doc.save(filename || `Tax_Invoices_Batch_${todayStr}_(${invoices.length}_invoices).pdf`);
}

// ---------------------------------------------------------------------------
// CREDIT NOTE / DEBIT NOTE PDF GENERATOR (Corporate Black & White)
// ---------------------------------------------------------------------------
export interface CreditNotePdfData {
  business: {
    name: string;
    gstin?: string;
    address?: string;
    stateCode?: string;
  };
  note: {
    docType: 'credit_note' | 'debit_note';
    docNo: string;
    docDate: string;
    originalDocNo?: string | null;
    originalDocDate?: string | null;
    returnReason?: string | null;
    placeOfSupply: string;
    subtotal: number;
    taxTotal: number;
    roundOff: number;
    total: number;
    lines: Array<{
      description: string;
      hsnSac?: string;
      qty: number;
      unit: string;
      rate: number;
      gstRate: number;
      cgst: number;
      sgst: number;
      igst: number;
      lineTotal: number;
    }>;
  };
  party?: {
    name: string;
    gstin?: string;
    address?: string;
    phone?: string;
  };
}

export function downloadCreditNotePdf(data: CreditNotePdfData, filename?: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const { business, note, party } = data;
  const isCredit = note.docType === 'credit_note';
  const title = isCredit ? 'CREDIT NOTE (SALES RETURN)' : 'DEBIT NOTE (PURCHASE RETURN)';

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 28;
  const contentWidth = pageWidth - margin * 2;

  // Outer Corporate Border
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(1);
  doc.rect(margin, margin, contentWidth, pageHeight - margin * 2);

  // Top Title Bar
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, margin, contentWidth, 24, 'F');
  doc.line(margin, margin + 24, margin + contentWidth, margin + 24);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, margin + 16, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('(Issued under Section 34 of CGST Act, 2017)', margin + 10, margin + 16);
  doc.text('ORIGINAL FOR RECIPIENT', margin + contentWidth - 10, margin + 16, { align: 'right' });

  // Header Box
  const headerBoxY = margin + 24;
  const headerBoxH = 80;
  doc.line(margin, headerBoxY + headerBoxH, margin + contentWidth, headerBoxY + headerBoxH);
  const dividerX = margin + 310;
  doc.line(dividerX, headerBoxY, dividerX, headerBoxY + headerBoxH);

  // Supplier
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const compName = (business.name || 'DISTRIBUTOR FIRM').toUpperCase();
  doc.text(compName, margin + 10, headerBoxY + 18);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(business.address || 'Kerala', margin + 10, headerBoxY + 32);
  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN: ${business.gstin || 'Unregistered'}`, margin + 10, headerBoxY + 46);
  doc.setFont('helvetica', 'normal');
  doc.text(`State: Kerala (Code: 32)`, margin + 10, headerBoxY + 58);
  doc.text(`Nature of Document: Tax Accounting Reversal`, margin + 10, headerBoxY + 70);

  // Note Meta
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Note #: ${note.docNo}`, dividerX + 10, headerBoxY + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${note.docDate}`, dividerX + 10, headerBoxY + 30);
  doc.setFont('helvetica', 'bold');
  doc.text(`Against Original Invoice:`, dividerX + 10, headerBoxY + 44);
  doc.setFont('helvetica', 'normal');
  doc.text(note.originalDocNo || 'Original Bill Referenced', dividerX + 125, headerBoxY + 44);
  doc.text(`Reason for Return:`, dividerX + 10, headerBoxY + 58);
  doc.text(note.returnReason || 'Goods Return / Rate Adjustment', dividerX + 100, headerBoxY + 58);
  doc.text(`Place of Supply: 32 - Kerala`, dividerX + 10, headerBoxY + 70);

  // Party Details
  const partyBoxY = headerBoxY + headerBoxH;
  const partyBoxH = 50;
  doc.line(margin, partyBoxY + partyBoxH, margin + contentWidth, partyBoxY + partyBoxH);
  doc.setFillColor(248, 248, 248);
  doc.rect(margin, partyBoxY, contentWidth, 14, 'F');
  doc.line(margin, partyBoxY + 14, margin + contentWidth, partyBoxY + 14);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(isCredit ? 'CREDIT ISSUED TO (CUSTOMER DETAILS):' : 'DEBIT ISSUED TO (VENDOR DETAILS):', margin + 10, partyBoxY + 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(party?.name || 'Party Account', margin + 10, partyBoxY + 26);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${party?.address || 'Kerala'} | GSTIN: ${party?.gstin || 'Unregistered'} | Phone: ${party?.phone || '-'}`, margin + 10, partyBoxY + 39);

  // Returned Line Items Table
  const tableRows = note.lines.map((l, index) => {
    const taxable = (l.rate * l.qty);
    const tax = (l.cgst || 0) + (l.sgst || 0) + (l.igst || 0);
    return [
      index + 1,
      l.description,
      l.hsnSac || '-',
      l.qty,
      l.unit || 'PCS',
      formatPaise(l.rate),
      formatPaise(taxable),
      `${l.gstRate || 0}%`,
      formatPaise(tax),
      formatPaise(l.lineTotal || (taxable + tax)),
    ];
  });

  autoTable(doc, {
    startY: partyBoxY + partyBoxH,
    head: [[
      '#',
      'Returned Item Description',
      'HSN/SAC',
      'Qty',
      'Unit',
      'Rate (Rs)',
      'Taxable Value (Rs)',
      'GST %',
      'Tax Reversal (Rs)',
      'Net Amount (Rs)',
    ]],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [0, 0, 0],
      lineColor: [60, 60, 60],
      lineWidth: 0.5,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      lineColor: [60, 60, 60],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 152, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 45, halign: 'center' },
      3: { cellWidth: 35, halign: 'center' },
      4: { cellWidth: 32, halign: 'center' },
      5: { cellWidth: 50, halign: 'right' },
      6: { cellWidth: 58, halign: 'right' },
      7: { cellWidth: 35, halign: 'center' },
      8: { cellWidth: 50, halign: 'right' },
      9: { cellWidth: 60, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 360;

  // Words Bar
  doc.line(margin, finalY, margin + contentWidth, finalY);
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, finalY, contentWidth, 20, 'F');
  doc.line(margin, finalY + 20, margin + contentWidth, finalY + 20);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Note Amount in Words: INR ${paiseToWords(note.total)} Only`, margin + 10, finalY + 14);

  // Bottom Totals & Signature
  const bottomY = finalY + 20;
  const bottomH = 90;
  doc.line(margin, bottomY + bottomH, margin + contentWidth, bottomY + bottomH);
  doc.line(dividerX, bottomY, dividerX, bottomY + bottomH);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('STATUTORY DECLARATION:', margin + 10, bottomY + 14);
  doc.setFont('helvetica', 'normal');
  doc.text('This credit/debit note reflects genuine return of goods or mutual price difference.', margin + 10, bottomY + 27);
  doc.text('The tax invoice debited/credited has been adjusted in corresponding GSTR returns.', margin + 10, bottomY + 39);

  // Numerical Totals
  doc.setFontSize(8.5);
  doc.text('Taxable Reversal:', dividerX + 10, bottomY + 14);
  doc.text(`Rs. ${formatPaise(note.subtotal)}`, margin + contentWidth - 10, bottomY + 14, { align: 'right' });

  doc.text('Tax Reversal (GST):', dividerX + 10, bottomY + 28);
  doc.text(`Rs. ${formatPaise(note.taxTotal)}`, margin + contentWidth - 10, bottomY + 28, { align: 'right' });

  doc.setFillColor(242, 242, 242);
  doc.rect(dividerX + 5, bottomY + 38, margin + contentWidth - dividerX - 10, 22, 'FD');
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL ADJUSTED VALUE:', dividerX + 12, bottomY + 52);
  doc.text(`Rs. ${formatPaise(note.total)}`, margin + contentWidth - 12, bottomY + 52, { align: 'right' });

  // Signature
  const sigY = bottomY + bottomH;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`For ${compName}:`, dividerX + 10, sigY + 20);
  doc.line(dividerX + 10, sigY + 50, margin + contentWidth - 10, sigY + 50);
  doc.setFontSize(8);
  doc.text('Authorised Signatory', dividerX + 55, sigY + 62);

  const safeDocNo = note.docNo.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(filename || `${isCredit ? 'Credit_Note' : 'Debit_Note'}_${safeDocNo}.pdf`);
}

// ---------------------------------------------------------------------------
// PRODUCT SALE REPORT (PSR) PDF EXPORT
// ---------------------------------------------------------------------------
export interface PsrPdfData {
  business: {
    name: string;
    gstin?: string;
    address?: string;
    stateCode?: string;
  };
  filters: {
    fromDate?: string;
    toDate?: string;
  };
  summary: {
    distinctProducts: number;
    totalQty: number;
    totalTaxable: number;
    totalTax: number;
    totalSales: number;
    totalInvoices: number;
  };
  items: Array<{
    slNo: number;
    name: string;
    hsnSac: string;
    unit: string;
    totalQty: number;
    avgRate: number;
    taxableValue: number;
    taxAmount: number;
    totalSales: number;
    percentContribution: string;
  }>;
}

export function downloadPsrPdf(data: PsrPdfData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const { business, filters, summary, items } = data;

  // Slate-900 Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 842, 68, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const bizName = (business.name || 'DISTRIBUTOR FIRM').toUpperCase();
  doc.text(bizName, 25, 28);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const info = `GSTIN: ${business.gstin || 'Unregistered'} | State: ${business.stateCode || '32'} - Kerala | Address: ${business.address || 'Kerala'}`;
  doc.text(info.substring(0, 100), 25, 45);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUCT SALE REPORT (PSR)', 550, 28);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text(`Period: ${filters.fromDate || 'All Time'} to ${filters.toDate || 'Present'} | ${summary.distinctProducts} Products`, 550, 45);

  // 4 KPI Summary Cards
  const cardY = 76;
  const cardH = 44;

  // Box 1: Products Count
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1);
  doc.roundedRect(25, cardY, 190, cardH, 3, 3, 'FD');
  doc.setFillColor(79, 70, 229);
  doc.rect(25, cardY, 190, 3, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DISTINCT PRODUCTS SOLD', 35, cardY + 16);
  doc.setTextColor(67, 56, 202);
  doc.setFontSize(12);
  doc.text(`${summary.distinctProducts} Items`, 35, cardY + 34);

  // Box 2: Total Volume Sold
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(225, cardY, 190, cardH, 3, 3, 'FD');
  doc.setFillColor(37, 99, 235);
  doc.rect(225, cardY, 190, 3, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL QUANTITY / VOLUME', 235, cardY + 16);
  doc.setTextColor(29, 78, 216);
  doc.setFontSize(12);
  doc.text(`${summary.totalQty.toLocaleString('en-IN')} Units`, 235, cardY + 34);

  // Box 3: Total Sales Revenue
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(425, cardY, 195, cardH, 3, 3, 'FD');
  doc.setFillColor(16, 185, 129);
  doc.rect(425, cardY, 195, 3, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PRODUCT REVENUE (GROSS)', 435, cardY + 16);
  doc.setTextColor(5, 150, 105);
  doc.setFontSize(12);
  doc.text(`Rs. ${formatPaise(summary.totalSales)}`, 435, cardY + 34);

  // Box 4: Total Tax Collected
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(630, cardY, 187, cardH, 3, 3, 'FD');
  doc.setFillColor(217, 119, 6);
  doc.rect(630, cardY, 187, 3, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL GST / TAX ON PRODUCTS', 640, cardY + 16);
  doc.setTextColor(180, 83, 9);
  doc.setFontSize(12);
  doc.text(`Rs. ${formatPaise(summary.totalTax)}`, 640, cardY + 34);

  // Grid Table
  const tableRows = items.map((i) => [
    i.slNo,
    i.name,
    i.hsnSac,
    `${i.totalQty} ${i.unit}`,
    formatPaise(i.avgRate),
    formatPaise(i.taxableValue),
    formatPaise(i.taxAmount),
    formatPaise(i.totalSales),
    `${i.percentContribution}%`,
  ]);

  autoTable(doc, {
    startY: cardY + cardH + 10,
    head: [[
      '#',
      'Product Name / Description',
      'HSN/SAC',
      'Total Qty',
      'Avg Rate (Rs)',
      'Taxable Value (Rs)',
      'GST Tax (Rs)',
      'Total Sales Revenue (Rs)',
      'Share %',
    ]],
    body: tableRows.length > 0 ? tableRows : [['-', 'No product sales recorded in period', '-', '0', '0.00', '0.00', '0.00', '0.00', '0%']],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 210, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 55, halign: 'center' },
      3: { cellWidth: 65, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 70, halign: 'right' },
      5: { cellWidth: 80, halign: 'right' },
      6: { cellWidth: 70, halign: 'right' },
      7: { cellWidth: 85, halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
      8: { cellWidth: 42, halign: 'center', fontStyle: 'bold' },
    },
    foot: [
      [
        { content: `TOTALS (${items.length} PRODUCTS)`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: `${summary.totalQty.toLocaleString('en-IN')}`, styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: '-', styles: { halign: 'center', fillColor: [241, 245, 249] } },
        { content: formatPaise(summary.totalTaxable), styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: formatPaise(summary.totalTax), styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: formatPaise(summary.totalSales), styles: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105], fillColor: [209, 250, 229] } },
        { content: '100%', styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
      ],
    ],
    footStyles: {
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    },
    margin: { left: 20, right: 20 },
  });

  const safeBiz = (business.name || 'Distributor').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Product_Sale_Report_PSR_${safeBiz}.pdf`);
}

export function downloadChequeVoucherPdf(cheque: any, business: any) {
  const doc = new jsPDF({ unit: 'pt', format: 'a5', orientation: 'landscape' });

  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, 595, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CHEQUE VOUCHER / RECEIPT', 30, 28);
  doc.setFontSize(10);
  doc.text(business.name, 400, 28);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Voucher Date: ${new Date().toISOString().split('T')[0]}`, 30, 70);
  doc.text(`Cheque Direction: ${cheque.direction?.toUpperCase()}`, 300, 70);

  autoTable(doc, {
    startY: 85,
    head: [['Field', 'Details']],
    body: [
      ['Cheque No', cheque.chequeNo],
      ['Party Name', cheque.partyName || 'N/A'],
      ['Cheque Date', cheque.chequeDate],
      ['Bank & Branch', `${cheque.bankName || ''} - ${cheque.branch || ''}`],
      ['Amount', `₹ ${formatPaise(cheque.amount)}`],
      ['Amount in Words', paiseToWords(cheque.amount)],
      ['Current Status', cheque.status?.toUpperCase()],
      ['Remarks', cheque.remarks || '-'],
    ],
    theme: 'plain',
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 120, fontStyle: 'bold' }, 1: { cellWidth: 380 } },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 280;
  doc.setFontSize(9);
  doc.text('Receiver / Depositor Signature', 40, finalY + 40);
  doc.text('Authorized Signatory', 400, finalY + 40);

  doc.save(`Cheque_Voucher_${cheque.chequeNo}.pdf`);
}

export interface DetailedTradingPdfData {
  distributor: {
    name: string;
    gstin?: string;
    address?: string;
    stateCode?: string;
  };
  filters: {
    fromDate?: string;
    toDate?: string;
    type?: string;
  };
  summary: {
    totalPurchasesDebit: number;
    totalSalesCredit: number;
    netProfit: number;
    totalTax: number;
    totalQty: number;
    totalEntries: number;
  };
  entries: Array<{
    docDate: string;
    docNo: string;
    typeLabel: string;
    category: string;
    partyName: string;
    description: string;
    hsnSac?: string;
    qty: number;
    unit: string;
    rate: number;
    taxAmount: number;
    debit: number;
    credit: number;
    runningBalance: number;
  }>;
}

export function downloadDetailedTradingPdf(data: DetailedTradingPdfData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const { distributor, filters, summary, entries } = data;

  // 1. Executive Top Header Banner (slate-900)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 842, 68, 'F');

  // Distributor Name at top (Bold White, 16pt)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const distName = (distributor.name || 'DISTRIBUTOR FIRM').toUpperCase();
  doc.text(distName, 25, 28);

  // Distributor Tax & Address Info (White / Light-Slate, 8.5pt)
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240); // slate-200
  const distInfo = `GSTIN: ${distributor.gstin || 'Unregistered'} | State: ${distributor.stateCode || '32'} - Kerala | Address: ${distributor.address || 'Kerala'}`;
  doc.text(distInfo.substring(0, 105), 25, 45);

  // Report Title on Right
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAILED TRADING & P&L REGISTER', 530, 28);

  // Period on Right
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const dateRangeStr = `Period: ${filters.fromDate || 'All Time'} to ${filters.toDate || 'Present'} | Lines: ${entries.length}`;
  doc.text(dateRangeStr, 530, 45);

  // 2. High-Contrast KPI Cards (Crisp White Backgrounds, Light Borders, Bold Readable Text)
  const startY = 76;
  const cardHeight = 44;
  const cardY = startY;

  // Box 1: Purchases (Debit) - Crisp White Card with Amber Accent
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(1);
  doc.roundedRect(25, cardY, 190, cardHeight, 3, 3, 'FD');
  // Amber top accent bar
  doc.setFillColor(217, 119, 6); // amber-600
  doc.rect(25, cardY, 190, 3, 'F');
  // Label
  doc.setTextColor(71, 85, 105); // slate-600
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PURCHASES (DEBIT)', 35, cardY + 16);
  // Value
  doc.setTextColor(180, 83, 9); // amber-700
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rs. ${formatPaise(summary.totalPurchasesDebit)}`, 35, cardY + 34);

  // Box 2: Sales (Credit) - Crisp White Card with Emerald Accent
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1);
  doc.roundedRect(225, cardY, 190, cardHeight, 3, 3, 'FD');
  // Emerald top accent bar
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(225, cardY, 190, 3, 'F');
  // Label
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL SALES BILLED (CREDIT)', 235, cardY + 16);
  // Value
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rs. ${formatPaise(summary.totalSalesCredit)}`, 235, cardY + 34);

  // Box 3: Net Trading Profit - Crisp White Card with Blue Accent
  const isProfit = summary.netProfit >= 0;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1);
  doc.roundedRect(425, cardY, 195, cardHeight, 3, 3, 'FD');
  // Blue top accent bar
  doc.setFillColor(isProfit ? 37 : 220, isProfit ? 99 : 38, isProfit ? 235 : 38);
  doc.rect(425, cardY, 195, 3, 'F');
  // Label
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(isProfit ? 'NET TRADING MARGIN (CREDIT - DEBIT)' : 'NET TRADING DEFICIT (LOSS)', 435, cardY + 16);
  // Value
  doc.setTextColor(isProfit ? 29 : 185, isProfit ? 78 : 28, isProfit ? 216 : 28);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rs. ${formatPaise(Math.abs(summary.netProfit))}${!isProfit ? ' (Loss)' : ''}`, 435, cardY + 34);

  // Box 4: Volume & Tax - Crisp White Card with Slate Accent
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1);
  doc.roundedRect(630, cardY, 187, cardHeight, 3, 3, 'FD');
  // Slate top accent bar
  doc.setFillColor(71, 85, 105);
  doc.rect(630, cardY, 187, 3, 'F');
  // Label
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL ITEM QTY & TAX (GST)', 640, cardY + 16);
  // Value
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Qty: ${summary.totalQty.toLocaleString('en-IN')} | Tax: Rs. ${formatPaise(summary.totalTax)}`, 640, cardY + 34);

  // 3. Grid Table with Crisp Visible Borders and Balanced Column Widths
  const tableRows = entries.map((e, idx) => [
    idx + 1,
    e.docDate,
    e.docNo,
    e.category,
    e.partyName || '-',
    e.description || '-',
    e.hsnSac || '-',
    `${e.qty} ${e.unit || 'KG'}`,
    formatPaise(e.rate),
    formatPaise(e.taxAmount),
    e.debit > 0 ? formatPaise(e.debit) : '-',
    e.credit > 0 ? formatPaise(e.credit) : '-',
    formatPaise(e.runningBalance),
  ]);

  autoTable(doc, {
    startY: cardY + cardHeight + 10,
    head: [[
      '#',
      'Date',
      'Voucher / Doc #',
      'Type',
      'Party (Customer / Vendor)',
      'Item Description',
      'HSN',
      'Qty & Unit',
      'Rate (Rs)',
      'Tax (Rs)',
      'Debit [Purchases] (Rs)',
      'Credit [Sales] (Rs)',
      'Net Balance (Rs)',
    ]],
    body: tableRows,
    theme: 'grid', // High-contrast clean grid lines on every cell
    styles: {
      fontSize: 7.5,
      cellPadding: 4,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225], // Crisp visible slate-300 borders
      lineWidth: 0.5,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [30, 41, 59], // Executive Slate-800
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      lineColor: [51, 65, 85],
      lineWidth: 0.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50 subtle zebra striping
    },
    columnStyles: {
      0: { cellWidth: 24, halign: 'center' }, // #
      1: { cellWidth: 54, halign: 'center' }, // Date (e.g. 27-11-2026)
      2: { cellWidth: 84, halign: 'left', fontStyle: 'bold' }, // Voucher # (fits BILL/2026-27/0002 without wrapping!)
      3: { cellWidth: 46, halign: 'center' }, // Type (Purchase / Sale)
      4: { cellWidth: 110, halign: 'left' }, // Party Name
      5: { cellWidth: 120, halign: 'left', fontStyle: 'bold' }, // Item Description
      6: { cellWidth: 38, halign: 'center' }, // HSN
      7: { cellWidth: 58, halign: 'center', fontStyle: 'bold' }, // Qty & Unit
      8: { cellWidth: 50, halign: 'right' }, // Rate
      9: { cellWidth: 42, halign: 'right' }, // Tax
      10: { cellWidth: 58, halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] }, // Debit (Purchases)
      11: { cellWidth: 58, halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] }, // Credit (Sales)
      12: { cellWidth: 60, halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] }, // Net Balance
    },
    foot: [
      [
        {
          content: `GRAND TOTALS (${entries.length} ITEMS)`,
          colSpan: 6,
          styles: {
            halign: 'right',
            fontStyle: 'bold',
            fontSize: 8,
            textColor: [15, 23, 42],
            fillColor: [241, 245, 249],
          },
        },
        { content: '-', styles: { halign: 'center', fillColor: [241, 245, 249] } },
        {
          content: `${summary.totalQty.toLocaleString('en-IN')}`,
          styles: {
            halign: 'center',
            fontStyle: 'bold',
            textColor: [29, 78, 216],
            fillColor: [241, 245, 249],
          },
        },
        { content: '-', styles: { halign: 'center', fillColor: [241, 245, 249] } },
        {
          content: formatPaise(summary.totalTax),
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] },
        },
        {
          content: formatPaise(summary.totalPurchasesDebit),
          styles: {
            halign: 'right',
            fontStyle: 'bold',
            textColor: [180, 83, 9],
            fillColor: [254, 243, 199], // Light amber highlight
          },
        },
        {
          content: formatPaise(summary.totalSalesCredit),
          styles: {
            halign: 'right',
            fontStyle: 'bold',
            textColor: [4, 120, 87],
            fillColor: [209, 250, 229], // Light emerald highlight
          },
        },
        {
          content: formatPaise(summary.netProfit),
          styles: {
            halign: 'right',
            fontStyle: 'bold',
            textColor: [15, 23, 42],
            fillColor: [238, 242, 255], // Light blue highlight
          },
        },
      ],
    ],
    footStyles: {
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Distributor: ${distributor.name} | Period: ${filters.fromDate || 'All'} to ${filters.toDate || 'All'} | Page ${data.pageNumber} of ${pageCount}`,
        25,
        580
      );
    },
    margin: { left: 20, right: 20, bottom: 25 },
  });

  const safeDistName = (distributor.name || 'Distributor').replace(/[^a-zA-Z0-9]/g, '_');
  const safeFrom = (filters.fromDate || 'start').replace(/-/g, '');
  const safeTo = (filters.toDate || 'end').replace(/-/g, '');
  doc.save(`Detailed_Trading_Report_${safeDistName}_${safeFrom}_to_${safeTo}.pdf`);
}

// ---------------------------------------------------------------------------
// 5. PROFIT & LOSS STATEMENT PDF EXPORT
// ---------------------------------------------------------------------------
export interface PnlPdfData {
  business: {
    name: string;
    gstin?: string;
    address?: string;
    stateCode?: string;
  };
  pnl: {
    incomeRows: Array<{ id: string; name: string; amount: number }>;
    expenseRows: Array<{ id: string; name: string; amount: number }>;
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
  };
}

export function downloadPnlPdf(data: PnlPdfData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const { business, pnl } = data;

  // Header Banner (Slate-900)
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 595, 68, 'F');

  // Business Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  const bizName = (business.name || 'DISTRIBUTOR FIRM').toUpperCase();
  doc.text(bizName, 25, 28);

  // Address & GSTIN
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const bizInfo = `GSTIN: ${business.gstin || 'Unregistered'} | State: ${business.stateCode || '32'} - Kerala | Address: ${business.address || 'Kerala'}`;
  doc.text(bizInfo.substring(0, 80), 25, 45);

  // Report Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PROFIT & LOSS STATEMENT', 380, 28);

  // Subtitle / Date
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const todayStr = new Date().toLocaleDateString('en-GB');
  doc.text(`Financial Summary | As on ${todayStr}`, 380, 45);

  // KPI Summary Cards
  const cardY = 78;
  const cardH = 46;

  // Card 1: Total Revenue (Emerald)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1);
  doc.roundedRect(25, cardY, 170, cardH, 3, 3, 'FD');
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(25, cardY, 170, 3, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL REVENUE / INCOME', 35, cardY + 16);
  doc.setTextColor(5, 150, 105);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rs. ${formatPaise(pnl.totalIncome)}`, 35, cardY + 35);

  // Card 2: Total Expenses (Red)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(212, cardY, 170, cardH, 3, 3, 'FD');
  doc.setFillColor(239, 68, 68); // red-500
  doc.rect(212, cardY, 170, 3, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL EXPENSES & PURCHASES', 222, cardY + 16);
  doc.setTextColor(220, 38, 38);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rs. ${formatPaise(pnl.totalExpense)}`, 222, cardY + 35);

  // Card 3: Net Profit (Blue / Violet)
  const isProfit = pnl.netProfit >= 0;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(400, cardY, 170, cardH, 3, 3, 'FD');
  doc.setFillColor(isProfit ? 37 : 220, isProfit ? 99 : 38, isProfit ? 235 : 38);
  doc.rect(400, cardY, 170, 3, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(isProfit ? 'NET TRADING PROFIT' : 'NET DEFICIT (LOSS)', 410, cardY + 16);
  doc.setTextColor(isProfit ? 29 : 185, isProfit ? 78 : 28, isProfit ? 216 : 28);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rs. ${formatPaise(Math.abs(pnl.netProfit))}${!isProfit ? ' (Loss)' : ''}`, 410, cardY + 35);

  // Table 1: Revenue / Income Breakdown
  const incomeRows = pnl.incomeRows.map((r, idx) => [
    idx + 1,
    r.name,
    formatPaise(r.amount),
  ]);

  autoTable(doc, {
    startY: cardY + cardH + 12,
    head: [['#', 'Income / Revenue Account', 'Amount (INR)']],
    body: incomeRows.length > 0 ? incomeRows : [['-', 'No revenue entries recorded', '0.00']],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4.5,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [5, 150, 105], // emerald-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      1: { cellWidth: 380, halign: 'left' },
      2: { cellWidth: 135, halign: 'right', fontStyle: 'bold' },
    },
    foot: [
      [
        { content: 'TOTAL INCOME / REVENUE', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [209, 250, 229] } },
        { content: `Rs. ${formatPaise(pnl.totalIncome)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105], fillColor: [209, 250, 229] } },
      ],
    ],
    margin: { left: 25, right: 25 },
  });

  const afterIncomeY = (doc as any).lastAutoTable?.finalY || 240;

  // Table 2: Expenses & Purchases Breakdown
  const expenseRows = pnl.expenseRows.map((r, idx) => [
    idx + 1,
    r.name,
    formatPaise(r.amount),
  ]);

  autoTable(doc, {
    startY: afterIncomeY + 12,
    head: [['#', 'Expenses & Purchases Account', 'Amount (INR)']],
    body: expenseRows.length > 0 ? expenseRows : [['-', 'No expense entries recorded', '0.00']],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4.5,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [220, 38, 38], // red-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      1: { cellWidth: 380, halign: 'left' },
      2: { cellWidth: 135, halign: 'right', fontStyle: 'bold' },
    },
    foot: [
      [
        { content: 'TOTAL EXPENSES & PURCHASES', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [254, 226, 226] } },
        { content: `Rs. ${formatPaise(pnl.totalExpense)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38], fillColor: [254, 226, 226] } },
      ],
    ],
    margin: { left: 25, right: 25 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 380;

  // Bottom Net Profit Summary Box
  doc.setFillColor(isProfit ? 238 : 254, isProfit ? 242 : 242, isProfit ? 255 : 242);
  doc.setDrawColor(isProfit ? 199 : 254, isProfit ? 210 : 202, isProfit ? 254 : 202);
  doc.roundedRect(25, finalY + 14, 545, 36, 4, 4, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isProfit ? 30 : 185, isProfit ? 58 : 28, isProfit ? 138 : 28);
  doc.text('NET PROFIT / (LOSS) FOR THE FINANCIAL PERIOD:', 40, finalY + 36);

  doc.setFontSize(14);
  doc.text(`Rs. ${formatPaise(pnl.netProfit)}`, 550, finalY + 36, { align: 'right' });

  const safeBiz = (business.name || 'Distributor').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Profit_and_Loss_Report_${safeBiz}_${todayStr.replace(/\//g, '')}.pdf`);
}

// ---------------------------------------------------------------------------
// 6. TRIAL BALANCE PDF EXPORT
// ---------------------------------------------------------------------------
export interface TrialBalancePdfData {
  business: {
    name: string;
    gstin?: string;
    address?: string;
    stateCode?: string;
  };
  tb: {
    rows: Array<{ id: string; code: string; name: string; type: string; closingDebit: number; closingCredit: number }>;
    totalDebit: number;
    totalCredit: number;
    isBalanced: boolean;
  };
}

export function downloadTrialBalancePdf(data: TrialBalancePdfData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const { business, tb } = data;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 595, 68, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  const bizName = (business.name || 'DISTRIBUTOR FIRM').toUpperCase();
  doc.text(bizName, 25, 28);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const bizInfo = `GSTIN: ${business.gstin || 'Unregistered'} | State: ${business.stateCode || '32'} - Kerala | Address: ${business.address || 'Kerala'}`;
  doc.text(bizInfo.substring(0, 80), 25, 45);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('TRIAL BALANCE', 440, 28);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const todayStr = new Date().toLocaleDateString('en-GB');
  doc.text(`As on ${todayStr}`, 440, 45);

  // Status Badge (Balanced / Unbalanced)
  const badgeY = 78;
  doc.setFillColor(tb.isBalanced ? 240 : 254, tb.isBalanced ? 253 : 242, tb.isBalanced ? 244 : 242);
  doc.setDrawColor(tb.isBalanced ? 187 : 254, tb.isBalanced ? 247 : 202, tb.isBalanced ? 208 : 202);
  doc.setLineWidth(1);
  doc.roundedRect(25, badgeY, 545, 28, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(tb.isBalanced ? 22 : 185, tb.isBalanced ? 101 : 28, tb.isBalanced ? 52 : 28);
  const badgeText = tb.isBalanced
    ? `✓ TRIAL BALANCE BALANCED — Total Debits (Rs. ${formatPaise(tb.totalDebit)}) = Total Credits (Rs. ${formatPaise(tb.totalCredit)})`
    : `⚠ TRIAL BALANCE OUT OF BALANCE — Total Debits (Rs. ${formatPaise(tb.totalDebit)}) ≠ Total Credits (Rs. ${formatPaise(tb.totalCredit)})`;
  doc.text(badgeText, 35, badgeY + 18);

  // Rows Table
  const tableRows = tb.rows.map((r) => [
    r.code,
    r.name,
    r.type.toUpperCase(),
    r.closingDebit > 0 ? formatPaise(r.closingDebit) : '-',
    r.closingCredit > 0 ? formatPaise(r.closingCredit) : '-',
  ]);

  autoTable(doc, {
    startY: badgeY + 36,
    head: [['Account Code', 'Account Name', 'Type', 'Debit Balance (INR)', 'Credit Balance (INR)']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4.5,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 70, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 220, halign: 'left' },
      2: { cellWidth: 75, halign: 'center' },
      3: { cellWidth: 90, halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] },
      4: { cellWidth: 90, halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
    },
    foot: [
      [
        { content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fontSize: 9, fillColor: [241, 245, 249] } },
        { content: `Rs. ${formatPaise(tb.totalDebit)}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 9, textColor: [180, 83, 9], fillColor: [254, 243, 199] } },
        { content: `Rs. ${formatPaise(tb.totalCredit)}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 9, textColor: [4, 120, 87], fillColor: [209, 250, 229] } },
      ],
    ],
    footStyles: {
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    },
    margin: { left: 25, right: 25 },
  });

  const safeBiz = (business.name || 'Distributor').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Trial_Balance_${safeBiz}_${todayStr.replace(/\//g, '')}.pdf`);
}

// ---------------------------------------------------------------------------
// 7. BALANCE SHEET PDF EXPORT
// ---------------------------------------------------------------------------
export interface BalanceSheetPdfData {
  business: {
    name: string;
    gstin?: string;
    address?: string;
    stateCode?: string;
  };
  bs: {
    assetRows: Array<{ id: string; name: string; amount: number }>;
    liabilityRows: Array<{ id: string; name: string; amount: number }>;
    equityRows: Array<{ id: string; name: string; amount: number }>;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    currentPeriodProfit: number;
    isBalanced: boolean;
  };
}

export function downloadBalanceSheetPdf(data: BalanceSheetPdfData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const { business, bs } = data;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 595, 68, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  const bizName = (business.name || 'DISTRIBUTOR FIRM').toUpperCase();
  doc.text(bizName, 25, 28);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const bizInfo = `GSTIN: ${business.gstin || 'Unregistered'} | State: ${business.stateCode || '32'} - Kerala | Address: ${business.address || 'Kerala'}`;
  doc.text(bizInfo.substring(0, 80), 25, 45);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('BALANCE SHEET', 430, 28);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const todayStr = new Date().toLocaleDateString('en-GB');
  doc.text(`Financial Position | As on ${todayStr}`, 430, 45);

  // Status Badge
  const badgeY = 78;
  doc.setFillColor(bs.isBalanced ? 240 : 254, bs.isBalanced ? 253 : 242, bs.isBalanced ? 244 : 242);
  doc.setDrawColor(bs.isBalanced ? 187 : 254, bs.isBalanced ? 247 : 202, bs.isBalanced ? 208 : 202);
  doc.setLineWidth(1);
  doc.roundedRect(25, badgeY, 545, 28, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(bs.isBalanced ? 22 : 185, bs.isBalanced ? 101 : 28, bs.isBalanced ? 52 : 28);
  const badgeText = bs.isBalanced
    ? `✓ EQUILIBRIUM ACHIEVED — Total Assets (Rs. ${formatPaise(bs.totalAssets)}) = Total Liabilities & Equity (Rs. ${formatPaise(bs.totalLiabilities + bs.totalEquity)})`
    : `⚠ BALANCE SHEET DISCREPANCY — Total Assets ≠ Total Liabilities & Equity`;
  doc.text(badgeText, 35, badgeY + 18);

  // Table 1: Assets
  const assetRows = bs.assetRows.map((r, idx) => [
    idx + 1,
    r.name,
    formatPaise(r.amount),
  ]);

  autoTable(doc, {
    startY: badgeY + 36,
    head: [['#', 'Asset Account / Category', 'Amount (INR)']],
    body: assetRows.length > 0 ? assetRows : [['-', 'No asset accounts recorded', '0.00']],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4.5,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [37, 99, 235], // blue-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      1: { cellWidth: 380, halign: 'left' },
      2: { cellWidth: 135, halign: 'right', fontStyle: 'bold' },
    },
    foot: [
      [
        { content: 'TOTAL ASSETS', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [219, 234, 254] } },
        { content: `Rs. ${formatPaise(bs.totalAssets)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [29, 78, 216], fillColor: [219, 234, 254] } },
      ],
    ],
    margin: { left: 25, right: 25 },
  });

  const afterAssetsY = (doc as any).lastAutoTable?.finalY || 240;

  // Table 2: Liabilities & Equity
  const liabAndEquityRows: any[] = [];
  bs.liabilityRows.forEach((r, idx) => {
    liabAndEquityRows.push([idx + 1, `${r.name} (Liability)`, formatPaise(r.amount)]);
  });
  bs.equityRows.forEach((r, idx) => {
    liabAndEquityRows.push([bs.liabilityRows.length + idx + 1, `${r.name} (Equity)`, formatPaise(r.amount)]);
  });
  liabAndEquityRows.push([
    liabAndEquityRows.length + 1,
    'Current Period Profit / (Loss)',
    formatPaise(bs.currentPeriodProfit),
  ]);

  autoTable(doc, {
    startY: afterAssetsY + 12,
    head: [['#', 'Liabilities & Equity Account', 'Amount (INR)']],
    body: liabAndEquityRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4.5,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [124, 58, 237], // purple-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      1: { cellWidth: 380, halign: 'left' },
      2: { cellWidth: 135, halign: 'right', fontStyle: 'bold' },
    },
    foot: [
      [
        { content: 'TOTAL LIABILITIES & EQUITY', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fontSize: 9, fillColor: [243, 232, 255] } },
        { content: `Rs. ${formatPaise(bs.totalLiabilities + bs.totalEquity)}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 9, textColor: [109, 40, 217], fillColor: [243, 232, 255] } },
      ],
    ],
    margin: { left: 25, right: 25 },
  });

  const safeBiz = (business.name || 'Distributor').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Balance_Sheet_${safeBiz}_${todayStr.replace(/\//g, '')}.pdf`);
}

// ---------------------------------------------------------------------------
// 8. GST TAX SUMMARY & REGISTER PDF EXPORT
// ---------------------------------------------------------------------------
export interface GstReportPdfData {
  business: {
    name: string;
    gstin?: string;
    address?: string;
    stateCode?: string;
  };
  gst: {
    output: { total: number; cgst: number; sgst: number; igst: number };
    input: { total: number; cgst: number; sgst: number; igst: number };
    netGstPayable: number;
    salesRegister?: Array<{
      invoiceNo: string;
      date: string;
      customerName: string;
      customerGstin: string;
      placeOfSupply: string;
      taxableValue: number;
      cgst: number;
      sgst: number;
      igst: number;
      totalInvoiceValue: number;
    }>;
  };
}

export function downloadGstReportPdf(data: GstReportPdfData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const { business, gst } = data;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 842, 68, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const bizName = (business.name || 'DISTRIBUTOR FIRM').toUpperCase();
  doc.text(bizName, 25, 28);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const bizInfo = `GSTIN: ${business.gstin || 'Unregistered'} | State: ${business.stateCode || '32'} - Kerala | Address: ${business.address || 'Kerala'}`;
  doc.text(bizInfo.substring(0, 100), 25, 45);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('GST SUMMARY & GSTR-1 REGISTER', 550, 28);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  const todayStr = new Date().toLocaleDateString('en-GB');
  doc.text(`Tax Period Filing Summary | Generated ${todayStr}`, 550, 45);

  // 3 KPI Cards
  const cardY = 76;
  const cardH = 50;

  // Box 1: Output GST
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1);
  doc.roundedRect(25, cardY, 255, cardH, 3, 3, 'FD');
  doc.setFillColor(239, 68, 68); // red
  doc.rect(25, cardY, 255, 3, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('OUTPUT GST (TAX ON SALES)', 35, cardY + 16);
  doc.setTextColor(220, 38, 38);
  doc.setFontSize(12);
  doc.text(`Rs. ${formatPaise(gst.output.total)}`, 35, cardY + 34);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`CGST: Rs. ${formatPaise(gst.output.cgst)} | SGST: Rs. ${formatPaise(gst.output.sgst)} | IGST: Rs. ${formatPaise(gst.output.igst)}`, 35, cardY + 45);

  // Box 2: Input Tax Credit
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(293, cardY, 255, cardH, 3, 3, 'FD');
  doc.setFillColor(16, 185, 129); // emerald
  doc.rect(293, cardY, 255, 3, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('INPUT TAX CREDIT (ITC ON PURCHASES)', 303, cardY + 16);
  doc.setTextColor(5, 150, 105);
  doc.setFontSize(12);
  doc.text(`Rs. ${formatPaise(gst.input.total)}`, 303, cardY + 34);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`CGST: Rs. ${formatPaise(gst.input.cgst)} | SGST: Rs. ${formatPaise(gst.input.sgst)} | IGST: Rs. ${formatPaise(gst.input.igst)}`, 303, cardY + 45);

  // Box 3: Net GST Payable
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(561, cardY, 256, cardH, 3, 3, 'FD');
  doc.setFillColor(37, 99, 235); // blue
  doc.rect(561, cardY, 256, 3, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('NET GST PAYABLE TO GOVERNMENT', 571, cardY + 16);
  doc.setTextColor(29, 78, 216);
  doc.setFontSize(13);
  doc.text(`Rs. ${formatPaise(gst.netGstPayable)}`, 571, cardY + 34);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Output Tax minus eligible ITC', 571, cardY + 45);

  // Sales Register Table
  const sales = gst.salesRegister || [];
  let totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0, totalInvVal = 0;

  const tableRows = sales.map((s, idx) => {
    totalTaxable += s.taxableValue || 0;
    totalCgst += s.cgst || 0;
    totalSgst += s.sgst || 0;
    totalIgst += s.igst || 0;
    totalInvVal += s.totalInvoiceValue || 0;

    return [
      idx + 1,
      s.invoiceNo,
      s.date,
      s.customerName,
      s.customerGstin || 'Unregistered',
      s.placeOfSupply,
      formatPaise(s.taxableValue),
      formatPaise(s.cgst),
      formatPaise(s.sgst),
      formatPaise(s.igst),
      formatPaise(s.totalInvoiceValue),
    ];
  });

  autoTable(doc, {
    startY: cardY + cardH + 12,
    head: [[
      '#',
      'Invoice #',
      'Date',
      'Customer Name',
      'Customer GSTIN',
      'POS',
      'Taxable Value (Rs)',
      'CGST (Rs)',
      'SGST (Rs)',
      'IGST (Rs)',
      'Total Value (Rs)',
    ]],
    body: tableRows.length > 0 ? tableRows : [['-', '-', '-', 'No B2B/B2C sales invoices recorded', '-', '-', '0.00', '0.00', '0.00', '0.00', '0.00']],
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 4,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 85, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 55, halign: 'center' },
      3: { cellWidth: 120, halign: 'left' },
      4: { cellWidth: 95, halign: 'center' },
      5: { cellWidth: 40, halign: 'center' },
      6: { cellWidth: 72, halign: 'right' },
      7: { cellWidth: 58, halign: 'right' },
      8: { cellWidth: 58, halign: 'right' },
      9: { cellWidth: 58, halign: 'right' },
      10: { cellWidth: 76, halign: 'right', fontStyle: 'bold', textColor: [29, 78, 216] },
    },
    foot: [
      [
        { content: `TOTALS (${sales.length} INVOICES)`, colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', fontSize: 8, fillColor: [241, 245, 249] } },
        { content: formatPaise(totalTaxable), styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: formatPaise(totalCgst), styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: formatPaise(totalSgst), styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: formatPaise(totalIgst), styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: formatPaise(totalInvVal), styles: { halign: 'right', fontStyle: 'bold', textColor: [29, 78, 216], fillColor: [238, 242, 255] } },
      ],
    ],
    footStyles: {
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    },
    margin: { left: 20, right: 20 },
  });

  const safeBiz = (business.name || 'Distributor').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`GST_Summary_Report_${safeBiz}_${todayStr.replace(/\//g, '')}.pdf`);
}
