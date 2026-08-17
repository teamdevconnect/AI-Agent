import type { CustomerTransaction } from '@/services/billingService';
import { formatFullDate } from '@/utils/date';
import styles from '../BillingPage.module.css';

export interface TransactionHistoryTableProps {
  transactions: CustomerTransaction[];
}

// Haive Credits only — no provider/model/cost column exists here at all,
// matching what billingService.listTransactions actually returns.
export function TransactionHistoryTable({ transactions }: TransactionHistoryTableProps) {
  if (transactions.length === 0) {
    return <p className={styles.muted}>No transactions yet.</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className={styles.transactionTable}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Tokens</th>
            <th>Credits</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td>{formatFullDate(tx.createdAt)}</td>
              <td>{tx.description}</td>
              <td>
                {tx.inputTokens !== undefined && tx.outputTokens !== undefined
                  ? `${tx.inputTokens.toLocaleString()} in / ${tx.outputTokens.toLocaleString()} out`
                  : '—'}
              </td>
              <td className={tx.amountCredits > 0 ? styles.amountPositive : styles.amountNegative}>
                {tx.amountCredits > 0 ? '+' : ''}
                {tx.amountCredits.toLocaleString()}
              </td>
              <td>{tx.balanceAfterCredits.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
