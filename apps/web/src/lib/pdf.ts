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
      rate: number;
      discount: number;
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

export function generateInvoicePdf(data: InvoicePdfData) {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
  });

  const { business, document: inv, party } = data;
  const isInvoice = inv.docType === 'sales_invoice';
  const title = isInvoice ? 'TAX INVOICE' : 'PURCHASE BILL';

  // 1. Header Box
  doc.setFillColor(30, 64, 175); // Primary Blue
  doc.rect(0, 0, 595, 70, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(business.name, 40, 35);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const bizSub = `${business.address || ''} | GSTIN: ${business.gstin || 'N/A'}`;
  doc.text(bizSub.substring(0, 80), 40, 52);

  // Document Title & Number
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 430, 35);
  doc.setFontSize(11);
  doc.text(`# ${inv.docNo}`, 430, 52);

  // 2. Info Section
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);

  // Left: Bill To
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To (Customer):', 40, 100);
  doc.setFont('helvetica', 'normal');
  doc.text(party?.name || 'Cash Customer', 40, 115);
  if (party?.address) doc.text(party.address.substring(0, 45), 40, 128);
  if (party?.gstin) doc.text(`GSTIN: ${party.gstin}`, 40, 141);
  if (party?.phone) doc.text(`Phone: ${party.phone}`, 40, 154);

  // Right: Dates & Place of Supply
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Details:', 380, 100);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${inv.docDate}`, 380, 115);
  if (inv.dueDate) doc.text(`Due Date: ${inv.dueDate}`, 380, 128);
  doc.text(`Place of Supply: State Code ${inv.placeOfSupply}`, 380, 141);

  // 3. Line Items Table
  const tableRows = inv.lines.map((l, index) => [
    index + 1,
    l.description,
    l.hsnSac || '-',
    l.qty,
    formatPaise(l.rate),
    `${l.gstRate}%`,
    formatPaise(l.cgst + l.sgst + l.igst),
    formatPaise(l.lineTotal),
  ]);

  autoTable(doc, {
    startY: 175,
    head: [['#', 'Item / Description', 'HSN/SAC', 'Qty', 'Rate (₹)', 'GST %', 'Tax (₹)', 'Amount (₹)']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 160 },
      2: { cellWidth: 55, halign: 'center' },
      3: { cellWidth: 40, halign: 'center' },
      4: { cellWidth: 60, halign: 'right' },
      5: { cellWidth: 45, halign: 'center' },
      6: { cellWidth: 60, halign: 'right' },
      7: { cellWidth: 70, halign: 'right' },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 350;

  // 4. Totals & Amount in Words
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Amount in Words:', 40, finalY + 25);
  doc.setFont('helvetica', 'normal');
  const words = paiseToWords(inv.total);
  doc.text(words, 40, finalY + 40, { maxWidth: 300 });

  // Bank Details
  const bank = business.settings?.bankDetails;
  if (bank) {
    doc.setFont('helvetica', 'bold');
    doc.text('Bank Details for Payment:', 40, finalY + 70);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bank: ${bank.bankName} | A/c No: ${bank.accountNo}`, 40, finalY + 85);
    doc.text(`IFSC: ${bank.ifsc} | Branch: ${bank.branch}`, 40, finalY + 98);
  }

  // Right Totals Box
  const summaryX = 380;
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', summaryX, finalY + 25);
  doc.text(`₹ ${formatPaise(inv.subtotal)}`, 515, finalY + 25, { align: 'right' });

  doc.text('Total Tax (GST):', summaryX, finalY + 40);
  doc.text(`₹ ${formatPaise(inv.taxTotal)}`, 515, finalY + 40, { align: 'right' });

  if (inv.roundOff !== 0) {
    doc.text('Round Off:', summaryX, finalY + 55);
    doc.text(`₹ ${formatPaise(inv.roundOff)}`, 515, finalY + 55, { align: 'right' });
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(241, 245, 249);
  doc.rect(summaryX - 10, finalY + 68, 155, 26, 'F');
  doc.text('Grand Total:', summaryX, finalY + 85);
  doc.text(`₹ ${formatPaise(inv.total)}`, 515, finalY + 85, { align: 'right' });

  // Signature area
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`For ${business.name}:`, 420, finalY + 140);
  doc.line(420, finalY + 180, 520, finalY + 180);
  doc.text('Authorized Signatory', 425, finalY + 195);

  return doc;
}

export function downloadInvoicePdf(data: InvoicePdfData, filename?: string) {
  const doc = generateInvoicePdf(data);
  doc.save(filename || `${data.document.docNo.replace(/\//g, '_')}.pdf`);
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

  // Header banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 842, 65, 'F');

  // Distributor Name at top
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text((distributor.name || 'DISTRIBUTOR FIRM').toUpperCase(), 30, 28);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const distInfo = `GSTIN: ${distributor.gstin || 'Unregistered'} | State: ${distributor.stateCode || '32'} | Address: ${distributor.address || 'Kerala'}`;
  doc.text(distInfo.substring(0, 110), 30, 44);

  // Title on right
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAILED TRADING & P&L REGISTER', 520, 28);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const dateRangeStr = `Period: ${filters.fromDate || 'All Time'} to ${filters.toDate || 'Present'} | Entries: ${entries.length}`;
  doc.text(dateRangeStr, 520, 44);

  // Summary KPI Cards row
  const startY = 75;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);

  // Purchases (Debit) box
  doc.roundedRect(30, startY, 180, 40, 4, 4, 'FD');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PURCHASES (DEBIT)', 40, startY + 14);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.setFontSize(11);
  doc.text(`Rs. ${formatPaise(summary.totalPurchasesDebit)}`, 40, startY + 30);

  // Sales (Credit) box
  doc.roundedRect(220, startY, 180, 40, 4, 4, 'FD');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.text('TOTAL SALES (CREDIT)', 230, startY + 14);
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.setFontSize(11);
  doc.text(`Rs. ${formatPaise(summary.totalSalesCredit)}`, 230, startY + 30);

  // Net Profit / Margin box
  const isProfit = summary.netProfit >= 0;
  doc.roundedRect(410, startY, 190, 40, 4, 4, 'FD');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.text(isProfit ? 'NET TRADING PROFIT (CREDIT - DEBIT)' : 'NET TRADING LOSS (DEFICIT)', 420, startY + 14);
  doc.setTextColor(isProfit ? 29 : 185, isProfit ? 78 : 28, isProfit ? 216 : 28);
  doc.setFontSize(11);
  doc.text(`Rs. ${formatPaise(Math.abs(summary.netProfit))}${!isProfit ? ' (Loss)' : ''}`, 420, startY + 30);

  // Total Tax & Qty box
  doc.roundedRect(610, startY, 202, 40, 4, 4, 'FD');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.text('TAX & TOTAL QUANTITY', 620, startY + 14);
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.text(`Tax: Rs. ${formatPaise(summary.totalTax)} | Qty: ${summary.totalQty}`, 620, startY + 30);

  // Table rows
  const tableRows = entries.map((e, idx) => [
    idx + 1,
    e.docDate,
    e.docNo,
    e.category,
    e.partyName.length > 22 ? e.partyName.substring(0, 20) + '..' : e.partyName,
    e.description.length > 26 ? e.description.substring(0, 24) + '..' : e.description,
    e.hsnSac || '-',
    `${e.qty} ${e.unit}`,
    formatPaise(e.rate),
    formatPaise(e.taxAmount),
    e.debit > 0 ? formatPaise(e.debit) : '-',
    e.credit > 0 ? formatPaise(e.credit) : '-',
    formatPaise(e.runningBalance),
  ]);

  autoTable(doc, {
    startY: startY + 50,
    head: [[
      '#',
      'Date',
      'Voucher #',
      'Type',
      'Party (Customer / Vendor)',
      'Item Description',
      'HSN',
      'Qty',
      'Rate (Rs)',
      'Tax (Rs)',
      'Debit [Purchases] (Rs)',
      'Credit [Sales] (Rs)',
      'Net Balance (Rs)',
    ]],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 3.5,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 50, halign: 'center' },
      2: { cellWidth: 58, fontStyle: 'bold' },
      3: { cellWidth: 44, halign: 'center' },
      4: { cellWidth: 105 },
      5: { cellWidth: 110, fontStyle: 'bold' },
      6: { cellWidth: 40, halign: 'center' },
      7: { cellWidth: 48, halign: 'center' },
      8: { cellWidth: 48, halign: 'right' },
      9: { cellWidth: 48, halign: 'right' },
      10: { cellWidth: 70, halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] },
      11: { cellWidth: 70, halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
      12: { cellWidth: 70, halign: 'right', fontStyle: 'bold' },
    },
    foot: [[
      'TOTALS',
      '',
      '',
      '',
      '',
      `${entries.length} items`,
      '',
      `${summary.totalQty}`,
      '',
      formatPaise(summary.totalTax),
      formatPaise(summary.totalPurchasesDebit),
      formatPaise(summary.totalSalesCredit),
      formatPaise(summary.netProfit),
    ]],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'right',
    },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Distributor: ${distributor.name} | Period: ${filters.fromDate || 'All'} to ${filters.toDate || 'All'} | Page ${data.pageNumber} of ${pageCount}`,
        30,
        580
      );
    },
    margin: { left: 25, right: 25, bottom: 25 },
  });

  const safeDistName = (distributor.name || 'Distributor').replace(/[^a-zA-Z0-9]/g, '_');
  const safeFrom = (filters.fromDate || 'start').replace(/-/g, '');
  const safeTo = (filters.toDate || 'end').replace(/-/g, '');
  doc.save(`Detailed_Trading_Report_${safeDistName}_${safeFrom}_to_${safeTo}.pdf`);
}
