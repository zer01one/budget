<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useSettingsStore } from '@/stores/settings.store'

const router = useRouter()
const route = useRoute()
const settingsStore = useSettingsStore()

const items = [
  { to: '/dashboard', label: 'Главная', icon: '⊞' },
  { to: '/transactions', label: 'Операции', icon: '↕' },
  { to: '/accounts', label: 'Счета', icon: '◈' },
  { to: '/categories', label: 'Категории', icon: '⊙' },
  { to: '/charts', label: 'Графики', icon: '◉' },
  { to: '/budgets', label: 'Бюджеты', icon: '◳' },
  { to: '/profile', label: 'Профиль', icon: '◎' },
]

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}


</script>

<template>
  <nav :class="['side-nav', { 'side-nav--expanded': settingsStore.settings.sidebarExpanded }]">
    <button class="side-nav__toggle" @click="settingsStore.toggleSidebar">
      <span>{{ settingsStore.settings.sidebarExpanded ? '◀' : '▶' }}</span>
    </button>
    <button
      v-for="item in items"
      :key="item.to"
      :class="['side-nav__item', { 'side-nav__item--active': isActive(item.to) }]"
      @click="router.push(item.to)"
    >
      <span class="side-nav__icon">{{ item.icon }}</span>
      <span v-if="settingsStore.settings.sidebarExpanded" class="side-nav__label">
        {{ item.label }}
      </span>
    </button>
  </nav>
</template>

<style scoped>
.side-nav {
  display: flex;
  flex-direction: column;
  width: var(--sidebar-collapsed);
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  padding: var(--space-4) var(--space-2);
  gap: var(--space-1);
  transition: width var(--transition-slow);
  overflow: hidden;
  flex-shrink: 0;
}
.side-nav--expanded { width: var(--sidebar-expanded); }

.side-nav__toggle {
  height: 40px;
  border-radius: var(--radius-sm);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-3);
  font-size: 12px;
  transition: color var(--transition);
}
.side-nav__toggle:hover { color: var(--text-primary); background: var(--bg-elevated); }

.side-nav__item {
  height: 44px;
  border-radius: var(--radius-md);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-3);
  white-space: nowrap;
  transition: color var(--transition), background var(--transition);
  font-size: var(--font-md);
}
.side-nav__item:hover { background: var(--bg-elevated); color: var(--text-primary); }
.side-nav__item--active { background: var(--accent-primary-soft); color: var(--accent-primary); }

.side-nav__icon { font-size: 20px; flex-shrink: 0; width: 24px; text-align: center; }
.side-nav__label { font-size: var(--font-sm); font-weight: 500; }
</style>
