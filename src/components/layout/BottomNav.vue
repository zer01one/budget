<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const items = [
  { to: '/dashboard', label: 'Главная', icon: '⊞' },
  { to: '/transactions', label: 'Операции', icon: '↕' },
  { to: '/accounts', label: 'Счета', icon: '◈' },
  { to: '/charts', label: 'Графики', icon: '◉' },
  { to: '/profile', label: 'Профиль', icon: '◎' },
]

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<template>
  <nav class="bottom-nav">
    <button
      v-for="item in items"
      :key="item.to"
      :class="['bottom-nav__item', { 'bottom-nav__item--active': isActive(item.to) }]"
      @click="router.push(item.to)"
    >
      <span class="bottom-nav__icon">{{ item.icon }}</span>
      <span class="bottom-nav__label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  display: flex;
  height: var(--nav-height);
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.bottom-nav__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  transition: color var(--transition);
  padding: var(--space-2) 0;
}
.bottom-nav__item--active { color: var(--accent-primary); }
.bottom-nav__item:active { opacity: 0.7; }

.bottom-nav__icon { font-size: 20px; line-height: 1; }
.bottom-nav__label { font-size: 10px; font-weight: 500; letter-spacing: 0.3px; }
</style>
