import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { BudgetEntry, BudgetsFile } from '@/types'
import { getFileSystemAdapter } from '@/services/filesystem'
import { useSettingsStore } from './settings.store'

export const useBudgetsStore = defineStore('budgets', () => {
  const budgets = ref<BudgetEntry[]>([])

  async function load(): Promise<void> {
    const fs = await getFileSystemAdapter()
    const result = await fs.readJson<BudgetsFile>('budgets.json')
    if (result) budgets.value = result.data.budgets ?? []
  }

  async function save(): Promise<void> {
    const settingsStore = useSettingsStore()
    const fs = await getFileSystemAdapter()
    await fs.writeJson<BudgetsFile>('budgets.json', { budgets: budgets.value })
    void settingsStore // used for side-effect only
  }

  function getForMonth(month: string): BudgetEntry[] {
    return budgets.value.filter(b => b.month === month)
  }

  async function addBudget(data: Omit<BudgetEntry, 'id' | 'updatedAt' | 'deviceId' | 'version'>): Promise<BudgetEntry> {
    const settingsStore = useSettingsStore()
    const entry: BudgetEntry = {
      ...data,
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      deviceId: settingsStore.settings.deviceId,
      version: 1,
    }
    budgets.value.push(entry)
    await save()
    return entry
  }

  async function updateBudget(id: string, patch: Partial<Pick<BudgetEntry, 'limitAmount' | 'notifyAt' | 'notifyEnabled' | 'currency'>>): Promise<void> {
    const idx = budgets.value.findIndex(b => b.id === id)
    if (idx === -1) return
    const settingsStore = useSettingsStore()
    budgets.value[idx] = {
      ...budgets.value[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
      deviceId: settingsStore.settings.deviceId,
      version: budgets.value[idx].version + 1,
    }
    await save()
  }

  async function deleteBudget(id: string): Promise<void> {
    budgets.value = budgets.value.filter(b => b.id !== id)
    await save()
  }

  const currentMonth = computed(() =>
    new Date().toLocaleDateString('en-CA').slice(0, 7)
  )

  return {
    budgets,
    load,
    save,
    getForMonth,
    addBudget,
    updateBudget,
    deleteBudget,
    currentMonth,
  }
})
