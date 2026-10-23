/**
 * Supplier payable is derived, not trusted from the cached balance column.
 *
 *   milk purchased (saved collection totals)
 *   + ledger lines that are not milk_collection (payments are negative)
 *   = remaining payable
 *
 * A milk row is not a payment. milk_collection ledger lines are ignored here
 * so the same milk is not added twice. Friday–Thursday weeks come from
 * getFridayToThursdayWeek. This module only splits an already-known period.
 *
 * roundMoney is copied from money.ts so Node's unit runner can load this file.
 */
function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export interface StatementLine {
  date: string;
  entryType: string;
  amount: number;
}

export interface PeriodStatement {
  opening: number;
  milk: number;
  /** Signed. A payment to the supplier is negative. */
  payments: number;
  other: number;
  closing: number;
}

export function payableBalance(milkAmount: number, ledger: StatementLine[]): number {
  const other = ledger
    .filter((line) => line.entryType !== 'milk_collection')
    .reduce((sum, line) => sum + line.amount, 0);
  return roundMoney(milkAmount + other);
}

export function statementForPeriod(
  priorMilk: number,
  priorLedger: StatementLine[],
  periodMilk: number,
  periodLedger: StatementLine[]
): PeriodStatement {
  const opening = payableBalance(priorMilk, priorLedger);
  const payments = roundMoney(
    periodLedger
      .filter((line) => line.entryType === 'settlement_payout')
      .reduce((sum, line) => sum + line.amount, 0)
  );
  const other = roundMoney(
    periodLedger
      .filter((line) => line.entryType !== 'milk_collection' && line.entryType !== 'settlement_payout')
      .reduce((sum, line) => sum + line.amount, 0)
  );
  const milk = roundMoney(periodMilk);
  return {
    opening,
    milk,
    payments,
    other,
    closing: roundMoney(opening + milk + payments + other),
  };
}
