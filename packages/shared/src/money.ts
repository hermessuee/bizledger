/**
 * Money utilities:
 * Amounts are represented as integer paise (1 Rupee = 100 paise) using bigint or number.
 */

export function rupeesToPaise(rupees: number | string): bigint {
  if (typeof rupees === 'number') {
    return BigInt(Math.round(rupees * 100));
  }
  const clean = rupees.trim().replace(/,/g, '');
  if (!clean) return 0n;
  const num = parseFloat(clean);
  if (isNaN(num)) return 0n;
  return BigInt(Math.round(num * 100));
}

export function paiseToRupees(paise: bigint | number): number {
  const p = typeof paise === 'bigint' ? Number(paise) : paise;
  return p / 100;
}

/**
 * Formats a paise amount into Indian number system format (e.g. 12,34,567.89).
 */
export function formatPaise(
  paise: bigint | number,
  options?: { currencySymbol?: string; showSymbol?: boolean }
): string {
  const p = typeof paise === 'bigint' ? paise : BigInt(Math.round(paise));
  const isNegative = p < 0n;
  const absPaise = isNegative ? -p : p;

  const wholeRupees = absPaise / 100n;
  const remainderPaise = absPaise % 100n;

  const rupeesStr = wholeRupees.toString();
  const paiseStr = remainderPaise.toString().padStart(2, '0');

  // Indian numbering grouping: last 3 digits, then pairs of 2 digits
  let formattedRupees = '';
  if (rupeesStr.length <= 3) {
    formattedRupees = rupeesStr;
  } else {
    const last3 = rupeesStr.slice(-3);
    const otherDigits = rupeesStr.slice(0, -3);
    const groups: string[] = [];
    let rem = otherDigits;
    while (rem.length > 2) {
      groups.unshift(rem.slice(-2));
      rem = rem.slice(0, -2);
    }
    if (rem.length > 0) {
      groups.unshift(rem);
    }
    formattedRupees = groups.join(',') + ',' + last3;
  }

  const sign = isNegative ? '-' : '';
  const formatted = `${sign}${formattedRupees}.${paiseStr}`;
  const symbol = options?.currencySymbol ?? '₹';
  return options?.showSymbol ? `${symbol} ${formatted}` : formatted;
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o > 0 ? `${TENS[t]}-${ONES[o]}` : TENS[t];
}

function threeDigitsToWords(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h > 0 && rest > 0) {
    return `${ONES[h]} Hundred and ${twoDigitsToWords(rest)}`;
  } else if (h > 0) {
    return `${ONES[h]} Hundred`;
  }
  return twoDigitsToWords(rest);
}

/**
 * Converts paise to Indian English words.
 * Example: 123456789n -> "Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven Rupees and Eighty-Nine Paise Only"
 */
export function paiseToWords(paise: bigint | number): string {
  const p = typeof paise === 'bigint' ? paise : BigInt(Math.round(paise));
  if (p === 0n) return 'Zero Rupees Only';

  const isNegative = p < 0n;
  const absPaise = isNegative ? -p : p;

  let rupees = Number(absPaise / 100n);
  const remainderPaise = Number(absPaise % 100n);

  const parts: string[] = [];

  const crores = Math.floor(rupees / 10000000);
  rupees %= 10000000;

  const lakhs = Math.floor(rupees / 100000);
  rupees %= 100000;

  const thousands = Math.floor(rupees / 1000);
  rupees %= 1000;

  const hundreds = rupees;

  if (crores > 0) {
    parts.push(`${twoDigitsToWords(crores)} Crore`);
  }
  if (lakhs > 0) {
    parts.push(`${twoDigitsToWords(lakhs)} Lakh`);
  }
  if (thousands > 0) {
    parts.push(`${twoDigitsToWords(thousands)} Thousand`);
  }
  if (hundreds > 0) {
    parts.push(threeDigitsToWords(hundreds));
  }

  const rupeesWord = parts.length > 0 ? `${parts.join(' ')} Rupees` : '';
  const paiseWord =
    remainderPaise > 0 ? `${twoDigitsToWords(remainderPaise)} Paise` : '';

  let result = '';
  if (rupeesWord && paiseWord) {
    result = `${rupeesWord} and ${paiseWord} Only`;
  } else if (rupeesWord) {
    result = `${rupeesWord} Only`;
  } else if (paiseWord) {
    result = `${paiseWord} Only`;
  } else {
    result = 'Zero Rupees Only';
  }

  return isNegative ? `Minus ${result}` : result;
}
