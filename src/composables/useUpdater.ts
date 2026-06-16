import { ref } from 'vue'
import { Capacitor } from '@capacitor/core'

export interface UpdateInfo {
  version: string
  body: string
}

const updateAvailable = ref<UpdateInfo | null>(null)
const isInstalling = ref(false)
const updateError = ref('')

export function useUpdater() {
  async function checkForUpdates(): Promise<void> {
    // Only on Tauri desktop
    if (Capacitor.isNativePlatform()) return
    if (typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ === 'undefined') return

    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()
      if (update?.available) {
        updateAvailable.value = {
          version: update.version ?? 'новая версия',
          body: update.body ?? '',
        }
      }
    } catch {
      // Updater endpoint not configured — silently skip
    }
  }

  async function installUpdate(): Promise<void> {
    if (!updateAvailable.value) return
    isInstalling.value = true
    updateError.value = ''
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()
      if (update?.available) {
        await update.downloadAndInstall()
      }
    } catch (e) {
      updateError.value = e instanceof Error ? e.message : 'Ошибка обновления'
    } finally {
      isInstalling.value = false
    }
  }

  function dismissUpdate(): void {
    updateAvailable.value = null
  }

  return { updateAvailable, isInstalling, updateError, checkForUpdates, installUpdate, dismissUpdate }
}
