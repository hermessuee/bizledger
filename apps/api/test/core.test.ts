import { describe, it, expect } from 'vitest';
import {
  rupeesToPaise,
  paiseToRupees,
  formatPaise,
  paiseToWords,
  calculateLineTax,
  calculateRoundOff,
  isValidGSTIN,
} from '@bizledger/shared';
import { hashPassword, verifyPassword } from '../src/crypto';
import { MemoryStore } from '../src/store';

describe('Accounting & Domain Logic Tests', () => {
  it('correctly converts rupees to paise and formats in Indian numbering', () => {
    expect(rupeesToPaise(1234567.89)).toBe(123456789n);
    expect(paiseToRupees(123456789n)).toBe(1234567.89);

    const formatted = formatPaise(123456789n, { showSymbol: true });
    expect(formatted).toBe('₹ 12,34,567.89');

    const formattedSmall = formatPaise(50000n);
    expect(formattedSmall).toBe('500.00');
  });

  it('converts paise to words using Indian numbering (Lakhs & Crores)', () => {
    const words = paiseToWords(123456789n);
    expect(words).toContain('Twelve Lakh Thirty-Four Thousand Five Hundred and Sixty-Seven Rupees');
    expect(words).toContain('Eighty-Nine Paise Only');

    const singleRupee = paiseToWords(100n);
    expect(singleRupee).toBe('One Rupees Only');
  });

  it('validates 15-character Indian GSTIN', () => {
    expect(isValidGSTIN('27AAPCA1234M1Z5')).toBe(true); // Maharashtra (27)
    expect(isValidGSTIN('29AAGCT5544R1Z0')).toBe(true); // Karnataka (29)
    expect(isValidGSTIN('99INVALID123')).toBe(false);
    expect(isValidGSTIN('ABCDE1234F')).toBe(false);
  });

  it('calculates intra-state GST (CGST + SGST split) accurately', () => {
    // ₹10,000 taxable at 18% GST -> CGST 9%, SGST 9%
    const taxablePaise = 1000000n; // 10,000.00 in paise
    const result = calculateLineTax({
      taxableAmount: taxablePaise,
      gstRate: 18,
      isInterState: false,
    });

    expect(result.taxableAmount).toBe(1000000n);
    expect(result.cgst).toBe(90000n); // ₹900.00
    expect(result.sgst).toBe(90000n); // ₹900.00
    expect(result.igst).toBe(0n);
    expect(result.lineTotal).toBe(1180000n); // ₹11,800.00
  });

  it('calculates inter-state GST (IGST) accurately', () => {
    const taxablePaise = 1000000n;
    const result = calculateLineTax({
      taxableAmount: taxablePaise,
      gstRate: 18,
      isInterState: true,
    });

    expect(result.cgst).toBe(0n);
    expect(result.sgst).toBe(0n);
    expect(result.igst).toBe(180000n); // ₹1,800.00
    expect(result.lineTotal).toBe(1180000n);
  });

  it('calculates round-off to nearest rupee correctly', () => {
    // 12345 paise -> nearest rupee is 12300 (diff -45 paise)
    const res1 = calculateRoundOff(12345n);
    expect(res1.roundOff).toBe(-45n);
    expect(res1.finalTotal).toBe(12300n);

    // 12365 paise -> nearest rupee is 12400 (diff +35 paise)
    const res2 = calculateRoundOff(12365n);
    expect(res2.roundOff).toBe(35n);
    expect(res2.finalTotal).toBe(12400n);
  });

  it('hashes passwords with PBKDF2-SHA256 and verifies securely', async () => {
    const password = 'TestSecurePassword@2026';
    const hash = await hashPassword(password, 210000);

    expect(hash.startsWith('pbkdf2$210000$')).toBe(true);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('WrongPassword', hash);
    expect(isInvalid).toBe(false);
  });

  it('strictly enforces double-entry balancing (rejects unbalanced journal entries)', () => {
    const store = new MemoryStore();
    const acct1 = store.accounts[0].id;
    const acct2 = store.accounts[1].id;

    // Balanced entry: Debit 5000, Credit 5000 -> succeeds
    expect(() => {
      store.createJournalEntry({
        businessId: store.business.id,
        entryDate: '2026-04-01',
        narration: 'Balanced test',
        lines: [
          { accountId: acct1, debit: 500000, credit: 0 },
          { accountId: acct2, debit: 0, credit: 500000 },
        ],
      });
    }).not.toThrow();

    // Unbalanced entry: Debit 5000, Credit 4000 -> throws error
    expect(() => {
      store.createJournalEntry({
        businessId: store.business.id,
        entryDate: '2026-04-01',
        narration: 'Unbalanced test',
        lines: [
          { accountId: acct1, debit: 500000, credit: 0 },
          { accountId: acct2, debit: 0, credit: 400000 },
        ],
      });
    }).toThrow(/Unbalanced journal entry/);
  });
});
