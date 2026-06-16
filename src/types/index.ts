// ─── Primitives ───────────────────────────────────────────────────────────────

export type UUID = string
export type ISODate = string       // "2026-06-15"
export type ISOTimestamp = string  // "2026-06-15T14:22:00.000Z"
export type CurrencyCode = string  // "USD", "KZT"
export type HexColor = string      // "#7C3AED"

export interface SyncMeta {
  updatedAt: ISOTimestamp
  deviceId: UUID
  version: number
}

// ─── Vault metadata ───────────────────────────────────────────────────────────

export interface VaultMetadata extends SyncMeta {
  appVersion: string
  schemaVersion: number
  deviceId: UUID
  createdAt: ISOTimestamp
  vaultName: string
}

export interface VaultMetadataFile {
  metadata: VaultMetadata
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export type AccountType = 'cash' | 'bank' | 'card' | 'savings' | 'investment' | 'crypto'

export interface Account extends SyncMeta {
  id: UUID
  name: string
  type: AccountType
  currency: CurrencyCode
  initialBalance: number
  color: HexColor
  icon: string
  isArchived: boolean
  sortOrder: number
  notes: string
}

export interface AccountsFile {
  accounts: Account[]
}

// ─── Categories ───────────────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Category extends SyncMeta {
  id: UUID
  name: string
  type: TransactionType
  color: HexColor
  icon: string
  parentId: UUID | null
  isSystem: boolean
  isArchived: boolean
  sortOrder: number
}

export interface CategoriesFile {
  categories: Category[]
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface Transaction extends SyncMeta {
  id: UUID
  type: TransactionType
  amount: number
  currency: CurrencyCode
  date: ISODate
  time: string
  accountId: UUID
  toAccountId: UUID | null
  categoryId: UUID | null
  comment: string
  tags: string[]
  isRecurring: boolean
  recurringParentId: UUID | null
  recurringRule?: 'daily' | 'weekly' | 'monthly'
  isDeleted: boolean
}

export interface TransactionsFile {
  month: string
  transactions: Transaction[]
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export interface BudgetEntry extends SyncMeta {
  id: UUID
  month: string
  categoryId: UUID
  limitAmount: number
  currency: CurrencyCode
  notifyAt: number
  notifyEnabled: boolean
}

export interface BudgetsFile {
  budgets: BudgetEntry[]
}

// ─── Gamification ─────────────────────────────────────────────────────────────

export type AchievementKey =
  | 'first_transaction'
  | 'streak_7'
  | 'streak_30'
  | 'budget_keeper'
  | 'century'
  | 'category_master'

export interface Achievement {
  key: AchievementKey
  unlockedAt: ISOTimestamp | null
  progress: number
  notifiedAt: ISOTimestamp | null
}

export type Level = 'novice' | 'apprentice' | 'practitioner' | 'expert' | 'master'

export const LEVEL_THRESHOLDS: Record<Level, number> = {
  novice: 0,
  apprentice: 500,
  practitioner: 1500,
  expert: 3000,
  master: 6000,
}

export const LEVEL_LABELS: Record<Level, string> = {
  novice: 'Новичок',
  apprentice: 'Ученик',
  practitioner: 'Практик',
  expert: 'Эксперт',
  master: 'Мастер',
}

export interface GamificationState extends SyncMeta {
  xp: number
  level: Level
  currentStreak: number
  longestStreak: number
  lastLoggedDate: ISODate | null
  achievements: Achievement[]
  totalTransactions: number
  categoriesCreated: number
  budgetsKept: number
}

export interface GamificationFile {
  gamification: GamificationState
}

// ─── App settings (local only, NOT in vault) ──────────────────────────────────

export interface AppSettings {
  vaultPath: string | null
  theme: 'dark' | 'light'
  defaultCurrency: CurrencyCode
  locale: string
  notificationsEnabled: boolean
  reminderTime: string
  firstLaunch: boolean
  deviceId: UUID
  sidebarExpanded: boolean
}

// ─── Conflict info ────────────────────────────────────────────────────────────

export interface ConflictInfo {
  file: string
  localUpdatedAt: ISOTimestamp
  diskModifiedAt: ISOTimestamp
  resolvedBy: 'local' | 'disk'
}

// ─── Default categories seed ──────────────────────────────────────────────────

export interface DefaultCategorySeed {
  name: string
  type: TransactionType
  color: HexColor
  icon: string
}

export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  { name: 'Еда и рестораны', type: 'expense', color: '#F59E0B', icon: 'food' },
  { name: 'Транспорт', type: 'expense', color: '#3B82F6', icon: 'transport' },
  { name: 'Жильё', type: 'expense', color: '#8B5CF6', icon: 'home' },
  { name: 'Здоровье', type: 'expense', color: '#10B981', icon: 'health' },
  { name: 'Одежда', type: 'expense', color: '#EC4899', icon: 'clothes' },
  { name: 'Развлечения', type: 'expense', color: '#F97316', icon: 'entertainment' },
  { name: 'Связь', type: 'expense', color: '#06B6D4', icon: 'phone' },
  { name: 'Образование', type: 'expense', color: '#6366F1', icon: 'education' },
  { name: 'Покупки', type: 'expense', color: '#EF4444', icon: 'shopping' },
  { name: 'Спорт', type: 'expense', color: '#14B8A6', icon: 'sport' },
  { name: 'Подписки', type: 'expense', color: '#A855F7', icon: 'subscription' },
  { name: 'Прочее', type: 'expense', color: '#6B7280', icon: 'other' },
  { name: 'Зарплата', type: 'income', color: '#10B981', icon: 'salary' },
  { name: 'Фриланс', type: 'income', color: '#3B82F6', icon: 'freelance' },
  { name: 'Инвестиции', type: 'income', color: '#F59E0B', icon: 'investment' },
  { name: 'Прочий доход', type: 'income', color: '#6B7280', icon: 'other' },
]
