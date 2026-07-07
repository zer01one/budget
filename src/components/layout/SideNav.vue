<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { useSettingsStore } from "@/stores/settings.store";
import {
	PhHouseLine,
	PhArrowsDownUp,
	PhWallet,
	PhTag,
	PhChartBar,
	PhPiggyBank,
	PhUserCircle,
	PhCaretLeft,
	PhCaretRight
} from "@phosphor-icons/vue";

const router = useRouter();
const route = useRoute();
const settingsStore = useSettingsStore();

const items = [
	{ to: "/dashboard", label: "Главная", icon: PhHouseLine },
	{ to: "/transactions", label: "Операции", icon: PhArrowsDownUp },
	{ to: "/accounts", label: "Счета", icon: PhWallet },
	{ to: "/categories", label: "Категории", icon: PhTag },
	{ to: "/charts", label: "Графики", icon: PhChartBar },
	{ to: "/budgets", label: "Бюджеты", icon: PhPiggyBank },
	{ to: "/profile", label: "Профиль", icon: PhUserCircle }
];

function isActive(path: string): boolean {
	return route.path === path || route.path.startsWith(path + "/");
}
</script>

<template>
	<nav :class="['side-nav', { 'side-nav--expanded': settingsStore.settings.sidebarExpanded }]">
		<button
			class="side-nav__toggle tp-body-md-regular"
			@click="settingsStore.toggleSidebar">
			<component
				:is="settingsStore.settings.sidebarExpanded ? PhCaretLeft : PhCaretRight"
				:size="16" />
		</button>
		<button
			v-for="item in items"
			:key="item.to"
			:class="['side-nav__item tp-body-lg-regular', { 'side-nav__item--active': isActive(item.to) }]"
			@click="router.push(item.to)">
			<component
				:is="item.icon"
				class="side-nav__icon"
				:size="22"
				:weight="isActive(item.to) ? 'fill' : 'regular'" />
			<span
				v-if="settingsStore.settings.sidebarExpanded"
				class="side-nav__label tp-label-md-medium">
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
.side-nav--expanded {
	width: var(--sidebar-expanded);
}

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
	transition: color var(--transition);
}
.side-nav__toggle:hover {
	color: var(--text-primary);
	background: var(--bg-elevated);
}

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
	transition:
		color var(--transition),
		background var(--transition);
}
.side-nav__item:hover {
	background: var(--bg-elevated);
	color: var(--text-primary);
}
.side-nav__item--active {
	background: var(--accent-primary-soft);
	color: var(--accent-primary);
}

.side-nav__icon {
	flex-shrink: 0;
	width: 24px;
}
</style>
