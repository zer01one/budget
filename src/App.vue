<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import { useSettingsStore } from '@/stores/settings.store'

const settingsStore = useSettingsStore()
const route = useRoute()

onMounted(() => {
  settingsStore.applyTheme()
})
</script>

<template>
  <template v-if="route.name === 'setup'">
    <RouterView />
  </template>
  <template v-else>
    <AppShell>
      <RouterView />
    </AppShell>
  </template>
</template>
