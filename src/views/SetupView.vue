<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useAccountsStore } from '@/stores/accounts.store'
import { useCategoriesStore } from '@/stores/categories.store'
import { useGamificationStore } from '@/stores/gamification.store'
import { getFileSystemAdapter } from '@/services/filesystem'
import { vaultService } from '@/services/data/vault.service'

const router = useRouter()
const settingsStore = useSettingsStore()
const accountsStore = useAccountsStore()
const categoriesStore = useCategoriesStore()
const gamificationStore = useGamificationStore()

const step = ref<'choose' | 'existing' | 'loading'>('choose')
const error = ref('')
const folderPath = ref('')

async function createNewVault() {
  error.value = ''
  try {
    const fs = await getFileSystemAdapter()
    const result = await fs.pickFolder({ title: 'Выберите папку для хранения данных' })
    folderPath.value = result.uri
    step.value = 'loading'

    await settingsStore.setVaultPath(result.uri)
    await vaultService.initNewVault(settingsStore.settings.deviceId)
    await Promise.all([
      accountsStore.load(),
      categoriesStore.load(),
      gamificationStore.load(),
    ])
    router.push('/dashboard')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка выбора папки'
    step.value = 'choose'
  }
}

async function openExistingVault() {
  error.value = ''
  try {
    const fs = await getFileSystemAdapter()
    const result = await fs.pickFolder({ title: 'Выберите папку с существующими данными' })
    folderPath.value = result.uri
    step.value = 'loading'

    await settingsStore.setVaultPath(result.uri)

    // Check if vault exists
    const metadata = await vaultService.readMetadata()
    if (!metadata) {
      // New vault in existing folder
      await vaultService.initNewVault(settingsStore.settings.deviceId)
    }

    await Promise.all([
      accountsStore.load(),
      categoriesStore.load(),
      gamificationStore.load(),
    ])
    router.push('/dashboard')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка открытия хранилища'
    step.value = 'choose'
  }
}
</script>

<template>
  <div class="setup">
    <div class="setup__card">
      <div class="setup__logo">💰</div>
      <h1 class="setup__title">Budget</h1>
      <p class="setup__desc">
        Личный учёт финансов без серверов.<br>
        Ваши данные — только ваши файлы.
      </p>

      <div v-if="step === 'choose'" class="setup__actions">
        <AppButton size="lg" full-width @click="createNewVault">
          Создать новое хранилище
        </AppButton>
        <AppButton variant="secondary" size="lg" full-width @click="openExistingVault">
          Открыть существующее
        </AppButton>
        <p class="setup__hint">
          Выберите любую папку — обычную или в Google Drive / Dropbox / OneDrive.
          Синхронизация происходит автоматически через клиент облака.
        </p>
      </div>

      <div v-if="step === 'loading'" class="setup__loading">
        <div class="setup__spinner" />
        <p>Инициализация хранилища…</p>
      </div>

      <p v-if="error" class="setup__error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.setup {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  background: var(--bg-primary);
}

.setup__card {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  text-align: center;
}

.setup__logo { font-size: 64px; line-height: 1; }
.setup__title { font-size: var(--font-3xl); font-weight: 700; letter-spacing: -0.5px; }
.setup__desc { color: var(--text-secondary); line-height: 1.6; }

.setup__actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.setup__hint {
  font-size: var(--font-sm);
  color: var(--text-muted);
  line-height: 1.5;
}

.setup__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  color: var(--text-secondary);
}

.setup__spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.setup__error {
  font-size: var(--font-sm);
  color: var(--accent-danger);
  padding: var(--space-3);
  background: var(--accent-danger-soft);
  border-radius: var(--radius-md);
  width: 100%;
}
</style>
