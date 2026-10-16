import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BUYERS_CSV_HEADERS,
  CSV_LINE_ENDING,
  CSV_UTF8_BOM,
  EXPENSES_CSV_HEADERS,
  MILK_ENTRIES_CSV_HEADERS,
  exportBuyersToCsv,
  exportExpensesToCsv,
  exportMilkEntriesToCsv,
  formatCsvRow,
  sanitizeCsvField,
} from '../csv-export.ts';

describe('sanitizeCsvField', () => {
  it('renders null/undefined as empty', () => {
    assert.equal(sanitizeCsvField(null), '');
    assert.equal(sanitizeCsvField(undefined), '');
  });

  it('keeps numbers raw, drops non-finite, maps booleans', () => {
    assert.equal(sanitizeCsvField(12.5), '12.5');
    assert.equal(sanitizeCsvField(-3), '-3'); // negative numbers are not formula-escaped
    assert.equal(sanitizeCsvField(0), '0');
    assert.equal(sanitizeCsvField(NaN), '');
    assert.equal(sanitizeCsvField(Infinity), '');
    assert.equal(sanitizeCsvField(true), '1');
    assert.equal(sanitizeCsvField(false), '0');
  });

  it('quotes fields containing commas, quotes, newlines, CR', () => {
    assert.equal(sanitizeCsvField('a,b'), '"a,b"');
    assert.equal(sanitizeCsvField('say "hi"'), '"say ""hi"""');
    assert.equal(sanitizeCsvField('line1\nline2'), '"line1\nline2"');
    assert.equal(sanitizeCsvField('a\r\nb'), '"a\r\nb"');
  });

  it('leaves plain text and unicode/Urdu untouched', () => {
    assert.equal(sanitizeCsvField('Ali Khan'), 'Ali Khan');
    assert.equal(sanitizeCsvField('دودھ فروخت'), 'دودھ فروخت');
    assert.equal(sanitizeCsvField('گائے، بھینس'), 'گائے، بھینس'); // Arabic comma U+060C is not a delimiter
    assert.equal(sanitizeCsvField('Rs ₨ 5 🐄'), 'Rs ₨ 5 🐄');
  });

  it('quotes Urdu text that contains an ASCII comma', () => {
    assert.equal(sanitizeCsvField('دودھ,دہی'), '"دودھ,دہی"');
  });

  it('neutralises formula injection in text', () => {
    assert.equal(sanitizeCsvField('=SUM(A1)'), "'=SUM(A1)");
    assert.equal(sanitizeCsvField('+1'), "'+1");
    assert.equal(sanitizeCsvField('-1'), "'-1"); // string, not number
    assert.equal(sanitizeCsvField('@cmd'), "'@cmd");
    assert.equal(sanitizeCsvField('\tx'), "'\tx");
  });

  it('applies both formula guard and quoting when needed', () => {
    assert.equal(sanitizeCsvField('=1,2'), `"'=1,2"`);
  });

  it('does not escape formula characters in the middle of text', () => {
    assert.equal(sanitizeCsvField('a=b'), 'a=b');
  });
});

describe('formatCsvRow', () => {
  it('joins with commas', () => {
    assert.equal(formatCsvRow(['a', 1, null, 'b,c']), 'a,1,,"b,c"');
  });
  it('empty input yields empty string', () => {
    assert.equal(formatCsvRow([]), '');
  });
});

const buyer = {
  id: 1,
  name: 'Ali, "Bhai" Khan',
  phone: null,
  address: 'گلی نمبر 5\nلاہور',
  is_default: 1,
  created_at: '2026-10-01T00:00:00.000Z',
};

describe('exportBuyersToCsv', () => {
  it('starts with BOM + header, ends with CRLF', () => {
    const csv = exportBuyersToCsv([buyer]);
    assert.ok(csv.startsWith(CSV_UTF8_BOM + BUYERS_CSV_HEADERS.join(',') + CSV_LINE_ENDING));
    assert.ok(csv.endsWith(CSV_LINE_ENDING));
  });

  it('header only (no trailing blank row) when empty', () => {
    assert.equal(
      exportBuyersToCsv([]),
      CSV_UTF8_BOM + BUYERS_CSV_HEADERS.join(',') + CSV_LINE_ENDING
    );
  });

  it('escapes name/address, blanks null phone and absent stats', () => {
    const csv = exportBuyersToCsv([buyer]);
    // The address contains a raw \n, so split on the full header instead of on CRLF.
    const body = csv.slice((CSV_UTF8_BOM + BUYERS_CSV_HEADERS.join(',') + CSV_LINE_ENDING).length);
    assert.equal(
      body,
      '1,"Ali, ""Bhai"" Khan",,"گلی نمبر 5\nلاہور",1,2026-10-01T00:00:00.000Z,,,,' + CSV_LINE_ENDING
    );
  });

  it('includes stats columns for BuyerWithStats', () => {
    const csv = exportBuyersToCsv([
      { ...buyer, address: null, is_default: 0, totalLiters: 10.5, totalRevenue: 1575, entriesCount: 3, lastSaleDate: null },
    ] as never);
    const row = csv.split(CSV_LINE_ENDING)[1];
    assert.ok(row.endsWith(',10.5,1575,3,'));
    assert.ok(row.includes(',0,2026'));
  });
});

describe('exportMilkEntriesToCsv', () => {
  const entry = {
    id: 7,
    date: '2026-10-15',
    shift: 'Morning' as const,
    liters: 12.25,
    fat_percentage: 5.5,
    rate_per_liter: 160,
    total_amount: 1960,
    buyer_id: 1,
    buyer_name: 'دودھ والا',
    notes: undefined,
    created_at: '2026-10-15T05:00:00.000Z',
  };

  it('has one column per header', () => {
    const csv = exportMilkEntriesToCsv([entry]);
    assert.equal(
      csv.split(CSV_LINE_ENDING)[1],
      '7,2026-10-15,Morning,12.25,5.5,160,1960,1,دودھ والا,,2026-10-15T05:00:00.000Z'
    );
    assert.equal(MILK_ENTRIES_CSV_HEADERS.length, 11);
  });

  it('never prints "null" or "undefined"', () => {
    const csv = exportMilkEntriesToCsv([{ ...entry, notes: null }]);
    assert.ok(!/null|undefined/.test(csv));
  });

  it('guards a note starting with "="', () => {
    const csv = exportMilkEntriesToCsv([{ ...entry, notes: '=HYPERLINK("x")' }]);
    assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
  });
});

describe('exportExpensesToCsv', () => {
  it('serialises optional fields as blanks and keeps decimals exact', () => {
    const csv = exportExpensesToCsv([
      {
        id: 2,
        date: '2026-10-14',
        category: 'Feed',
        title: 'Wanda, 50kg',
        amount: 4999.99,
        quantity: null,
        unit: null,
        unit_price: null,
        supplier_or_payee: null,
        payment_method: null,
        notes: null,
        created_at: '2026-10-14T10:00:00.000Z',
      },
    ]);
    assert.equal(
      csv.split(CSV_LINE_ENDING)[1],
      '2,2026-10-14,Feed,"Wanda, 50kg",4999.99,,,,,,,2026-10-14T10:00:00.000Z'
    );
    assert.equal(EXPENSES_CSV_HEADERS.length, 12);
  });
});
