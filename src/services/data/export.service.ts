import type { Transaction, Category, Account } from '@/types'
import { getFileSystemAdapter } from '@/services/filesystem'

// ── CSV ───────────────────────────────────────────────────────────────────────

function escapeCsv(value: string | number | null | undefined): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function transactionsToCSV(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
): string {
  const accountMap = new Map(accounts.map(a => [a.id, a.name]))
  const categoryMap = new Map(categories.map(c => [c.id, c.name]))

  const header = ['Дата', 'Время', 'Тип', 'Сумма', 'Валюта', 'Счёт', 'Категория', 'Комментарий']
  const rows = transactions
    .filter(t => !t.isDeleted)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .map(t => [
      t.date,
      t.time,
      t.type === 'income' ? 'Доход' : t.type === 'expense' ? 'Расход' : 'Перевод',
      t.type === 'expense' ? -t.amount : t.amount,
      t.currency,
      accountMap.get(t.accountId) ?? t.accountId,
      categoryMap.get(t.categoryId ?? '') ?? '',
      t.comment,
    ])

  const lines = [header, ...rows].map(row => row.map(escapeCsv).join(','))
  return lines.join('\r\n')
}

// ── Export via filesystem adapter ─────────────────────────────────────────────

export async function exportTransactionsCSV(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
  fromDate?: string,
  toDate?: string,
): Promise<void> {
  const filtered = fromDate || toDate
    ? transactions.filter(t => (!fromDate || t.date >= fromDate) && (!toDate || t.date <= toDate))
    : transactions

  const csv = transactionsToCSV(filtered, accounts, categories)
  const now = new Date().toLocaleDateString('en-CA')
  const filename = `budget-export-${now}.csv`

  const fs = await getFileSystemAdapter()
  await fs.exportFile(filename, csv, 'text/csv;charset=utf-8')
}

export async function exportVaultJSON(transactions: Transaction[]): Promise<void> {
  const json = JSON.stringify({ exportedAt: new Date().toISOString(), transactions }, null, 2)
  const now = new Date().toLocaleDateString('en-CA')
  const filename = `budget-transactions-${now}.json`

  const fs = await getFileSystemAdapter()
  await fs.exportFile(filename, json, 'application/json')
}
