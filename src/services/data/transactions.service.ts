import { getFileSystemAdapter } from '@/services/filesystem'
import type { TransactionsFile, Transaction, ConflictInfo } from '@/types'

interface LoadMonthResult {
  transactions: Transaction[]
  conflict: ConflictInfo | null
}

const _lastKnownModified = new Map<string, string>()

export const transactionsService = {
  async loadMonth(month: string): Promise<LoadMonthResult | null> {
    const fs = await getFileSystemAdapter()
    const path = `transactions/${month}.json`
    const result = await fs.readJson<TransactionsFile>(path)
    if (!result) return null

    let conflict: ConflictInfo | null = null
    const lastKnown = _lastKnownModified.get(path)
    if (lastKnown && result.modifiedAt > lastKnown) {
      conflict = {
        file: path,
        localUpdatedAt: lastKnown,
        diskModifiedAt: result.modifiedAt,
        resolvedBy: 'disk',
      }
    }
    _lastKnownModified.set(path, result.modifiedAt)
    return {
      transactions: result.data.transactions.filter(t => !t.isDeleted),
      conflict,
    }
  },

  async saveMonth(month: string, transactions: Transaction[]): Promise<void> {
    const fs = await getFileSystemAdapter()
    const file: TransactionsFile = { month, transactions }
    await fs.writeJson(`transactions/${month}.json`, file)
    _lastKnownModified.set(`transactions/${month}.json`, new Date().toISOString())
  },

  async listMonths(): Promise<string[]> {
    const fs = await getFileSystemAdapter()
    const files = await fs.listFiles('transactions')
    return files
      .filter(f => /^\d{4}-\d{2}\.json$/.test(f))
      .map(f => f.replace('.json', ''))
      .sort()
      .reverse()
  },
}
