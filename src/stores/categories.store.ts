import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Category, CategoriesFile, TransactionType } from '@/types'
import { getFileSystemAdapter } from '@/services/filesystem'
import { useSettingsStore } from './settings.store'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([])
  const isLoaded = ref(false)

  const expenseCategories = computed(() =>
    categories.value.filter(c => c.type === 'expense' && !c.isArchived)
  )

  const incomeCategories = computed(() =>
    categories.value.filter(c => c.type === 'income' && !c.isArchived)
  )

  function getById(id: string): Category | undefined {
    return categories.value.find(c => c.id === id)
  }

  function byType(type: TransactionType): Category[] {
    return categories.value.filter(c => c.type === type && !c.isArchived)
  }

  async function load(): Promise<void> {
    const fs = await getFileSystemAdapter()
    const result = await fs.readJson<CategoriesFile>('categories.json')
    if (result) {
      categories.value = result.data.categories
    }
    isLoaded.value = true
  }

  async function save(): Promise<void> {
    const fs = await getFileSystemAdapter()
    await fs.writeJson<CategoriesFile>('categories.json', { categories: categories.value })
  }

  async function addCategory(input: Omit<Category, 'id' | 'updatedAt' | 'deviceId' | 'version' | 'isSystem'>): Promise<Category> {
    const settingsStore = useSettingsStore()
    const now = new Date().toISOString()
    const category: Category = {
      ...input,
      id: crypto.randomUUID(),
      isSystem: false,
      updatedAt: now,
      deviceId: settingsStore.settings.deviceId,
      version: 1,
    }
    categories.value = [...categories.value, category]
    await save()
    return category
  }

  async function updateCategory(id: string, patch: Partial<Category>): Promise<void> {
    const settingsStore = useSettingsStore()
    const idx = categories.value.findIndex(c => c.id === id)
    if (idx === -1) return
    const updated = {
      ...categories.value[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
      deviceId: settingsStore.settings.deviceId,
      version: categories.value[idx].version + 1,
    }
    categories.value = [
      ...categories.value.slice(0, idx),
      updated,
      ...categories.value.slice(idx + 1),
    ]
    await save()
  }

  async function deleteCategory(id: string): Promise<void> {
    const category = categories.value.find(c => c.id === id)
    if (category?.isSystem) return
    await updateCategory(id, { isArchived: true })
  }

  return {
    categories,
    expenseCategories,
    incomeCategories,
    isLoaded,
    getById,
    byType,
    load,
    save,
    addCategory,
    updateCategory,
    deleteCategory,
  }
})
