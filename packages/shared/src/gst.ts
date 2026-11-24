import { INDIAN_STATES } from './constants';

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGSTIN(gstin?: string | null): boolean {
  if (!gstin) return false;
  const upper = gstin.trim().toUpperCase();
  if (!GSTIN_REGEX.test(upper)) return false;
  const stateCode = upper.substring(0, 2);
  return Boolean(INDIAN_STATES[stateCode]);
}

export function getStateCodeFromGSTIN(gstin?: string | null): string | null {
  if (!gstin) return null;
  const upper = gstin.trim().toUpperCase();
  if (upper.length >= 2 && INDIAN_STATES[upper.substring(0, 2)]) {
    return upper.substring(0, 2);
  }
  return null;
}

export interface TaxLineCalculationInput {
  taxableAmount: bigint; // in paise
  gstRate: number; // e.g. 18.0
  isTaxInclusive?: boolean;
  isInterState: boolean;
}

export interface TaxLineCalculationResult {
  taxableAmount: bigint;
  cgst: bigint;
  sgst: bigint;
  igst: bigint;
  totalTax: bigint;
  lineTotal: bigint;
}

/**
 * Calculates CGST, SGST, IGST for an item line in paise.
 */
export function calculateLineTax(input: TaxLineCalculationInput): TaxLineCalculationResult {
  const { gstRate, isTaxInclusive = false, isInterState } = input;
  let taxable = input.taxableAmount;

  if (gstRate <= 0) {
    return {
      taxableAmount: taxable,
      cgst: 0n,
      sgst: 0n,
      igst: 0n,
      totalTax: 0n,
      lineTotal: taxable,
    };
  }

  let totalTax: bigint;
  if (isTaxInclusive) {
    // If inclusive: taxable = total / (1 + rate/100)
    // totalTax = total - taxable
    const rateBps = BigInt(Math.round(gstRate * 100)); // basis points
    const taxableCalc = (taxable * 10000n) / (10000n + rateBps);
    totalTax = taxable - taxableCalc;
    taxable = taxableCalc;
  } else {
    // exclusive: totalTax = taxable * rate / 100
    const rateBps = BigInt(Math.round(gstRate * 100));
    totalTax = (taxable * rateBps) / 10000n;
  }

  let cgst = 0n;
  let sgst = 0n;
  let igst = 0n;

  if (isInterState) {
    igst = totalTax;
  } else {
    // Split equally into CGST and SGST
    cgst = totalTax / 2n;
    sgst = totalTax - cgst; // handles odd paise rounding cleanly
  }

  const lineTotal = taxable + totalTax;

  return {
    taxableAmount: taxable,
    cgst,
    sgst,
    igst,
    totalTax,
    lineTotal,
  };
}

/**
 * Calculate round-off to the nearest Rupee (100 paise).
 * E.g. total 12345 paise -> nearest rupee is 12300 or 12400 (12300 here, diff -45 paise).
 */
export function calculateRoundOff(totalPaise: bigint): { roundOff: bigint; finalTotal: bigint } {
  const rem = totalPaise % 100n;
  if (rem === 0n) {
    return { roundOff: 0n, finalTotal: totalPaise };
  }

  // If remainder >= 50 paise, round up; else round down
  let roundOff = 0n;
  if (rem >= 50n) {
    roundOff = 100n - rem;
  } else if (rem <= -50n) {
    roundOff = -(100n + rem);
  } else {
    roundOff = -rem;
  }

  return {
    roundOff,
    finalTotal: totalPaise + roundOff,
  };
}
