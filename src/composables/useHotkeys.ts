import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'

export function useHotkeys() {
  const router = useRouter()

  function onKeyDown(e: KeyboardEvent) {
    if (!e.ctrlKey && !e.metaKey) return
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
    const isInput = tag === 'input' || tag === 'textarea' || tag === 'select'

    switch (e.key) {
      case 'n':
      case 'N':
        if (!isInput) {
          e.preventDefault()
          router.push('/transactions/add')
        }
        break
      case 'f':
      case 'F':
        if (!isInput) {
          e.preventDefault()
          // Focus search input if on transactions page
          const searchEl = document.querySelector<HTMLInputElement>('.tx-view__search')
          if (searchEl) {
            searchEl.focus()
          } else {
            router.push('/transactions')
          }
        }
        break
      case ',':
        e.preventDefault()
        router.push('/profile')
        break
    }
  }

  onMounted(() => {
    // Hotkeys only make sense on desktop
    if (!Capacitor.isNativePlatform()) {
      window.addEventListener('keydown', onKeyDown)
    }
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
  })
}
