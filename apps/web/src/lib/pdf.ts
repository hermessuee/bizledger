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
