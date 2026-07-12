<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import AppModal from "@/components/ui/AppModal.vue";
import {
	PhHouseLine,
	PhArrowsDownUp,
	PhWallet,
	PhChartBar,
	PhDotsThreeCircle,
	PhUserCircle,
	PhTag,
	PhPiggyBank
} from "@phosphor-icons/vue";

const router = useRouter();
const route = useRoute();

const items = [
	{ to: "/dashboard", label: "Главная", icon: PhHouseLine },
	{ to: "/transactions", label: "Операции", icon: PhArrowsDownUp },
	{ to: "/accounts", label: "Счета", icon: PhWallet },
	{ to: "/charts", label: "Графики", icon: PhChartBar }
];

const moreItems = [
	{ to: "/profile", label: "Профиль", icon: PhUserCircle },
	{ to: "/categories", label: "Категории", icon: PhTag },
	{ to: "/budgets", label: "Бюджеты", icon: PhPiggyBank }
];

const moreOpen = ref(false);
const moreModal = ref<InstanceType<typeof AppModal> | null>(null);

function isActive(path: string): boolean {
	return route.path === path || route.path.startsWith(path + "/");
}

const isMoreActive = computed(() => moreItems.some((item) => isActive(item.to)));

function goMore(path: string) {
	// moreOpen.value = false here would unmount AppModal before its leave
	// animation plays; close() animates first, then @close flips moreOpen.
	moreModal.value?.close();
	router.push(path);
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
		<button
			:class="['bottom-nav__item', { 'bottom-nav__item--active': isMoreActive }]"
			@click="moreOpen = true">
			<PhDotsThreeCircle
				class="bottom-nav__icon"
				:size="22"
				:weight="isMoreActive ? 'fill' : 'regular'" />
			<span class="bottom-nav__label tp-label-sm-medium">Ещё</span>
		</button>

		<AppModal
			v-if="moreOpen"
			ref="moreModal"
			title="Ещё"
			size="sm"
			@close="moreOpen = false">
			<div class="more-sheet">
				<button
					v-for="item in moreItems"
					:key="item.to"
					:class="['more-sheet__item tp-body-lg-regular', { 'more-sheet__item--active': isActive(item.to) }]"
					@click="goMore(item.to)">
					<component
						:is="item.icon"
						class="more-sheet__icon"
						:size="22"
						:weight="isActive(item.to) ? 'fill' : 'regular'" />
					<span class="more-sheet__label tp-label-md-medium">{{ item.label }}</span>
				</button>
			</div>
		</AppModal>
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

.more-sheet {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
}

.more-sheet__item {
	height: 48px;
	border-radius: var(--radius-md);
	background: none;
	border: none;
	color: var(--text-secondary);
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: 0 var(--space-3);
	transition:
		color var(--transition),
		background var(--transition);
}
.more-sheet__item:active {
	opacity: 0.7;
}
.more-sheet__item--active {
	background: var(--accent-primary-soft);
	color: var(--accent-primary);
}

.more-sheet__icon {
	flex-shrink: 0;
}
</style>
