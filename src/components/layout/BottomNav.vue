<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { PhHouseLine, PhArrowsDownUp, PhWallet, PhChartBar, PhUserCircle } from "@phosphor-icons/vue";

const router = useRouter();
const route = useRoute();

const items = [
	{ to: "/dashboard", label: "Главная", icon: PhHouseLine },
	{ to: "/transactions", label: "Операции", icon: PhArrowsDownUp },
	{ to: "/accounts", label: "Счета", icon: PhWallet },
	{ to: "/charts", label: "Графики", icon: PhChartBar },
	{ to: "/profile", label: "Профиль", icon: PhUserCircle }
];

function isActive(path: string): boolean {
	return route.path === path || route.path.startsWith(path + "/");
}
</script>

<template>
	<nav class="bottom-nav">
		<button
			v-for="item in items"
			:key="item.to"
			:class="['bottom-nav__item', { 'bottom-nav__item--active': isActive(item.to) }]"
			@click="router.push(item.to)">
			<component
				:is="item.icon"
				class="bottom-nav__icon"
				:size="22"
				:weight="isActive(item.to) ? 'fill' : 'regular'" />
			<span class="bottom-nav__label tp-label-sm-medium">{{ item.label }}</span>
		</button>
	</nav>
</template>

<style scoped>
.bottom-nav {
	display: flex;
	height: var(--nav-height);
	background: var(--bg-secondary);
	border-top: 1px solid var(--border);
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
.bottom-nav__item--active {
	color: var(--accent-primary);
}
.bottom-nav__item:active {
	opacity: 0.7;
}

.bottom-nav__icon {
	flex-shrink: 0;
}
.bottom-nav__label {
	letter-spacing: 0.3px;
}
</style>
