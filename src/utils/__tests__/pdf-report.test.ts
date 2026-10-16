import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildBuyerBillHtml,
  buildBuyersDirectoryHtml,
  buildExpenseReportHtml,
  buildFinancialReportHtml,
  buildMilkSalesReportHtml,
  escapeHtml,
  fmtDate,
  fmtNum,
  fmtPeriod,
  fmtRs,
  monthRangeOf,
  reportFileName,
  shiftMonthRange,
} from '../pdf-report.ts';

const brand = { farmName: 'Green Valley <Dairy>', ownerName: 'Ali & Sons', phone: '0300 1112233', email: 'a@b.test' };
const when = new Date(2026, 9, 16, 9, 5);

// The module only reads these fields, so partial fixtures are enough.
const entry = (over: Record<string, unknown> = {}): any => ({
  id: 1,
  date: '2026-10-09',
  shift: 'Morning',
  liters: 50,
  fat_percentage: 4.5,
  rate_per_liter: 200,
  total_amount: 10000,
  buyer_id: 1,
  buyer_name: 'Ahmed Milk Centre',
  notes: null,
  created_at: '',
  ...over,
});

describe('formatting', () => {
  test('fmtNum groups thousands and avoids -0', () => {
    assert.equal(fmtNum(1234567), '1,234,567');
    assert.equal(fmtNum(1234.5, 1), '1,234.5');
    assert.equal(fmtNum(-1500), '-1,500');
    assert.equal(fmtNum(-0.0001, 1), '0.0');
    assert.equal(fmtNum(Number.NaN), '0');
  });

  test('fmtRs puts the sign before the currency', () => {
    assert.equal(fmtRs(13000), 'Rs 13,000');
    assert.equal(fmtRs(-2500.4), '-Rs 2,500');
    assert.equal(fmtRs(0), 'Rs 0');
  });

  test('dates are locale independent', () => {
    assert.equal(fmtDate('2026-10-15'), '15 Oct 2026');
    assert.equal(fmtPeriod('2026-10-09', '2026-10-15'), '9 Oct 2026 – 15 Oct 2026');
    assert.equal(fmtPeriod('2026-10-09', '2026-10-09'), '9 Oct 2026');
  });

  test('escapeHtml neutralises markup', () => {
    assert.equal(escapeHtml(`<img src=x onerror="a()">&'`), '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;');
    assert.equal(escapeHtml(null), '');
  });
});

describe('month helpers', () => {
  test('monthRangeOf handles 30/31-day months and leap years', () => {
    assert.deepEqual(monthRangeOf('2026-10-15'), { start: '2026-10-01', end: '2026-10-31' });
    assert.deepEqual(monthRangeOf('2026-02-10'), { start: '2026-02-01', end: '2026-02-28' });
    assert.deepEqual(monthRangeOf('2028-02-10'), { start: '2028-02-01', end: '2028-02-29' });
    assert.deepEqual(monthRangeOf('2026-04-30'), { start: '2026-04-01', end: '2026-04-30' });
  });

  test('shiftMonthRange crosses year boundaries', () => {
    assert.deepEqual(shiftMonthRange('2026-01-20', -1), { start: '2025-12-01', end: '2025-12-31' });
    assert.deepEqual(shiftMonthRange('2026-12-20', 1), { start: '2027-01-01', end: '2027-01-31' });
  });

  test('reportFileName is filesystem safe', () => {
    assert.equal(reportFileName('Weekly Report', '2026-10-09', '2026-10-15'), 'dairyflow_weekly_report_2026-10-09_to_2026-10-15.pdf');
    assert.equal(reportFileName('bill', '2026-10-09', '2026-10-09'), 'dairyflow_bill_2026-10-09.pdf');
    assert.equal(reportFileName('x'), 'dairyflow_x.pdf');
  });
});

describe('financial report', () => {
  const report: any = {
    startDate: '2026-10-09',
    endDate: '2026-10-15',
    totalMilkLiters: 300,
    morningLiters: 200,
    eveningLiters: 100,
    avgDailyLiters: 42.9,
    totalMilkRevenue: 60000,
    totalExpenses: 20000,
    feedExpenses: 15000,
    otherExpenses: 5000,
    netOperatingProfit: 40000,
    totalCollections: 45000,
    totalReceivables: 23000,
    expenseCategories: [
      { category: 'Feed', amount: 15000, percentage: 75 },
      { category: 'Labour', amount: 5000, percentage: 25 },
      { category: 'Other', amount: 0, percentage: 0 },
    ],
    entriesCount: 6,
    expensesCount: 3,
  };

  test('renders title, escaped farm name, key figures', () => {
    const html = buildFinancialReportHtml({ brand, lang: 'en', report, generatedAt: when });
    assert.match(html, /Weekly Financial Report/);
    assert.match(html, /Green Valley &lt;Dairy&gt;/);
    assert.doesNotMatch(html, /Green Valley <Dairy>/);
    assert.match(html, /Rs 40,000/);
    assert.match(html, /Net operating profit/);
    assert.match(html, /9 Oct 2026 – 15 Oct 2026/);
    assert.match(html, /16 Oct 2026, 09:05/);
  });

  test('zero-amount categories are hidden and a loss is labelled as a loss', () => {
    const html = buildFinancialReportHtml({
      brand,
      lang: 'en',
      report: { ...report, netOperatingProfit: -3000 },
      generatedAt: when,
    });
    assert.match(html, /Net operating loss/);
    assert.match(html, /-Rs 3,000/);
    assert.doesNotMatch(html, /<td>Other<\/td>/);
  });

  test('monthly kind changes the title; Urdu switches to RTL', () => {
    const monthly = buildFinancialReportHtml({ brand, lang: 'en', report, kind: 'monthly', generatedAt: when });
    assert.match(monthly, /Monthly Financial Report/);
    const ur = buildFinancialReportHtml({ brand, lang: 'ur', report, generatedAt: when });
    assert.match(ur, /dir="rtl"/);
    assert.match(ur, /ہفتہ وار مالی رپورٹ/);
  });
});

describe('milk sales report', () => {
  const entries = [
    entry({ id: 2, date: '2026-10-10', shift: 'Evening', liters: 20, total_amount: 4000, buyer_name: 'Bilal Dairy' }),
    entry({ id: 1, date: '2026-10-09', notes: '<b>hot</b>' }),
    entry({ id: 3, date: '2026-10-10', shift: 'Morning', liters: 30, total_amount: 6000 }),
  ];

  test('totals, buyer split, chronological order with Morning before Evening', () => {
    const html = buildMilkSalesReportHtml({ brand, lang: 'en', entries, periodLabel: 'This month', generatedAt: when });
    assert.match(html, /Rs 20,000/); // 10000 + 4000 + 6000
    assert.match(html, /100\.0 L/);
    assert.match(html, /This month · 9 Oct 2026 – 10 Oct 2026/);
    assert.ok(html.indexOf('Fri, 9 Oct') < html.indexOf('Sat, 10 Oct'));
    const day2 = html.slice(html.indexOf('Sat, 10 Oct'));
    assert.ok(day2.indexOf('Morning') < day2.indexOf('Evening'));
  });

  test('notes are escaped and an empty period is explained', () => {
    const html = buildMilkSalesReportHtml({ brand, lang: 'en', entries, periodLabel: 'x', generatedAt: when });
    assert.match(html, /&lt;b&gt;hot&lt;\/b&gt;/);
    const empty = buildMilkSalesReportHtml({ brand, lang: 'en', entries: [], periodLabel: 'Today', generatedAt: when });
    assert.match(empty, /No records in this period/);
    assert.match(empty, /Rs 0/);
  });
});

describe('expense report', () => {
  const expenses: any[] = [
    { id: 1, date: '2026-10-10', category: 'Feed', title: 'Wanda', amount: 32000, quantity: 40, unit: 'bag', unit_price: 800, supplier_or_payee: 'Punjab Feeds', payment_method: 'Cash', notes: null },
    { id: 2, date: '2026-10-12', category: 'Labour', title: 'Wages <script>', amount: 10000, quantity: null, unit: null, unit_price: null, supplier_or_payee: null, payment_method: null, notes: null },
  ];

  test('totals, feed share, quantity × price and escaping', () => {
    const html = buildExpenseReportHtml({ brand, lang: 'en', expenses, periodLabel: 'This month', generatedAt: when });
    assert.match(html, /Rs 42,000/);
    assert.match(html, /40 bag × 800/);
    assert.match(html, /76\.2%/); // 32000 / 42000
    assert.match(html, /Wages &lt;script&gt;/);
  });

  test('category filter appears in the header', () => {
    const html = buildExpenseReportHtml({ brand, lang: 'en', expenses, periodLabel: 'x', categoryFilter: 'Feed', generatedAt: when });
    assert.match(html, /<span class="k">Category<\/span>Feed/);
  });
});

describe('buyer bill', () => {
  const ledger: any = {
    buyer: { id: 1, name: 'Ahmed Milk Centre', phone: '0300 762 1890', address: 'Sheikhupura' },
    openingBalance: 8000,
    totalSalesVolume: 100,
    totalSalesAmount: 20000,
    totalPaymentsReceived: 5000,
    outstandingBalance: 23000,
    payments: [{ id: 1, date: '2026-10-12', amount: 5000, payment_method: 'Cash', received_by: 'Usman' }],
    entries: [entry()],
  };

  test('shows the invoice maths and a DUE stamp', () => {
    const html = buildBuyerBillHtml({ brand, lang: 'en', ledger, billNumber: 'DF-261009-AM', startDate: '2026-10-09', endDate: '2026-10-15', generatedAt: when });
    assert.match(html, /Rs 28,000/); // gross payable 8000 + 20000
    assert.match(html, /Rs 23,000/);
    assert.match(html, /stamp due/);
    assert.match(html, /DF-261009-AM/);
    assert.match(html, /Usman/);
  });

  test('a cleared balance is stamped PAID', () => {
    const html = buildBuyerBillHtml({ brand, lang: 'en', ledger: { ...ledger, outstandingBalance: 0, payments: [] }, billNumber: 'X', startDate: '2026-10-09', endDate: '2026-10-15', generatedAt: when });
    assert.match(html, /stamp paid/);
    assert.doesNotMatch(html, /Payments received<\/div>/);
  });
});

describe('buyers directory', () => {
  test('lists buyers by revenue with totals', () => {
    const buyers: any[] = [
      { id: 1, name: 'A', phone: null, address: null, totalLiters: 10, totalRevenue: 2000, entriesCount: 1, lastSaleDate: '2026-10-01' },
      { id: 2, name: 'B', phone: '1', address: 'X', totalLiters: 30, totalRevenue: 6000, entriesCount: 2, lastSaleDate: null },
    ];
    const html = buildBuyersDirectoryHtml({ brand, lang: 'en', buyers, generatedAt: when });
    assert.ok(html.indexOf('<td>B</td>') < html.indexOf('<td>A</td>'));
    assert.match(html, /Rs 8,000/);
  });
});
