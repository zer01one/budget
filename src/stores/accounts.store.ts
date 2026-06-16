import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Account, AccountsFile } from '@/types'
import { getFileSystemAdapter } from '@/services/filesystem'
import { useSettingsStore } from './settings.store'

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref<Account[]>([])
  const isLoaded = ref(false)

  const activeAccounts = computed(() => accounts.value.filter(a => !a.isArchived))

  function getById(id: string): Account | undefined {
    return accounts.value.find(a => a.id === id)
  }

  async function load(): Promise<void> {
    const fs = await getFileSystemAdapter()
    const result = await fs.readJson<AccountsFile>('accounts.json')
    if (result) {
      accounts.value = result.data.accounts
    }
    isLoaded.value = true
  }

  async function save(): Promise<void> {
    const fs = await getFileSystemAdapter()
    await fs.writeJson<AccountsFile>('accounts.json', { accounts: accounts.value })
  }

  async function addAccount(input: Omit<Account, 'id' | 'updatedAt' | 'deviceId' | 'version'>): Promise<Account> {
    const settingsStore = useSettingsStore()
    const now = new Date().toISOString()
    const account: Account = {
      ...input,
      id: crypto.randomUUID(),
      updatedAt: now,
      deviceId: settingsStore.settings.deviceId,
      version: 1,
    }
    accounts.value = [...accounts.value, account]
    await save()
    return account
  }

  async function updateAccount(id: string, patch: Partial<Account>): Promise<void> {
    const settingsStore = useSettingsStore()
    const idx = accounts.value.findIndex(a => a.id === id)
    if (idx === -1) return
    const updated = {
      ...accounts.value[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
      deviceId: settingsStore.settings.deviceId,
      version: accounts.value[idx].version + 1,
    }
    accounts.value = [
      ...accounts.value.slice(0, idx),
      updated,
      ...accounts.value.slice(idx + 1),
    ]
    await save()
  }

  async function deleteAccount(id: string): Promise<void> {
    await updateAccount(id, { isArchived: true })
  }

  return { accounts, activeAccounts, isLoaded, getById, load, save, addAccount, updateAccount, deleteAccount }
})
