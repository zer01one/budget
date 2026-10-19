<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import SideNav from "./SideNav.vue";
import BottomNav from "./BottomNav.vue";
import AppToast from "@/components/ui/AppToast.vue";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useGamificationStore } from "@/stores/gamification.store";
import { ACHIEVEMENT_LABELS } from "@/stores/gamification.store";
import { useBootstrap } from "@/composables/useBootstrap";
import { useHotkeys } from "@/composables/useHotkeys";
import { useUpdater } from "@/composables/useUpdater";
import { useBackButton } from "@/composables/useBackButton";

const txStore = useTransactionsStore();
const gamificationStore = useGamificationStore();
const { bootstrap } = useBootstrap();
const { updateAvailable, isInstalling, checkForUpdates, installUpdate, dismissUpdate } = useUpdater();
useHotkeys();
useBackButton();

const windowWidth = ref(window.innerWidth);
const isDesktop = computed(() => windowWidth.value >= 900);
if (typeof window !== "undefined") {
	window.addEventListener("resize", () => {
		windowWidth.value = window.innerWidth;
	});
}

const currentToast = ref<{ message: string; type: "success" | "info" } | null>(null);
const toastQueue = ref<Array<{ message: string; type: "success" | "info" }>>([]);

function processToastQueue() {
	if (currentToast.value || toastQueue.value.length === 0) return;
	currentToast.value = toastQueue.value.shift()!;
}

function onToastDismiss() {
	currentToast.value = null;
	setTimeout(processToastQueue, 500);
}

onMounted(async () => {
	// Load all vault data for returning users
	await bootstrap();

	// Check for desktop update in background
	checkForUpdates();

	// Poll for gamification achievement toasts
	const interval = setInterval(() => {
		const achievement = gamificationStore.popToast();
		if (achievement) {
			const info = ACHIEVEMENT_LABELS[achievement.key as keyof typeof ACHIEVEMENT_LABELS];
			if (info) {
				toastQueue.value.push({ message: `🏆 ${info.name} — +100 XP`, type: "success" });
				processToastQueue();
			}
		}
	}, 500);

	return () => clearInterval(interval);
});
</script>

<template>
	<div class="shell">
		<SideNav v-if="isDesktop" />

		<main class="shell__main">
			<div
				v-if="updateAvailable"
				class="update-banner tp-body-md-regular">
				<span>⬆ Доступна версия {{ updateAvailable.version }}</span>
				<div class="update-banner__actions">
					<button
						class="update-banner__install tp-label-sm-semibold"
						:disabled="isInstalling"
						@click="installUpdate">
						{{ isInstalling ? "Установка…" : "Установить" }}
					</button>
					<button
						class="update-banner__dismiss tp-body-md-regular"
						@click="dismissUpdate">
						✕
					</button>
				</div>
			</div>

			<div
				v-if="txStore.lastConflict"
				class="conflict-banner tp-body-md-regular">
				<span>⚠ Конфликт синхронизации в {{ txStore.lastConflict.file }} — принята более новая версия</span>
				<button
					class="tp-body-lg-regular"
					@click="txStore.clearConflict()">
					✕
				</button>
			</div>

			<div class="shell__content">
				<slot />
			</div>
		</main>

		<BottomNav v-if="!isDesktop" />

		<Teleport to="body">
			<div class="toast-container">
				<AppToast
					v-if="currentToast"
					:message="currentToast.message"
					:type="currentToast.type"
					@dismiss="onToastDismiss" />
			</div>
		</Teleport>
	</div>
</template>

<style scoped>
.shell {
	display: flex;
	flex-direction: row;
	height: 100%;
	overflow: hidden;
}
.shell__main {
	flex: 1;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	min-width: 0;
}
.shell__content {
	flex: 1;
	overflow-y: auto;
	overflow-x: hidden;
	scrollbar-gutter: stable;
}
@media (max-width: 899px) {
	.shell {
		flex-direction: column;
	}
}

.conflict-banner {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-3) var(--space-5);
	background: var(--accent-warning-soft);
	border-bottom: 1px solid var(--accent-warning);
	color: var(--accent-warning);
	gap: var(--space-3);
}
.update-banner {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-3) var(--space-5);
	background: var(--accent-primary-soft);
	border-bottom: 1px solid var(--accent-primary);
	color: var(--accent-primary);
	gap: var(--space-3);
}
.update-banner__actions {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	flex-shrink: 0;
}
.update-banner__install {
	background: var(--accent-primary);
	border: none;
	border-radius: var(--radius-sm);
	color: #fff;
	padding: var(--space-1) var(--space-3);
	cursor: pointer;
}
.update-banner__install:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}
.update-banner__dismiss {
	background: none;
	border: none;
	color: var(--accent-primary);
	cursor: pointer;
}

.conflict-banner button {
	background: none;
	border: none;
	color: var(--accent-warning);
	cursor: pointer;
	flex-shrink: 0;
}

.toast-container {
	position: fixed;
	bottom: calc(var(--nav-height) + var(--space-4) + env(safe-area-inset-bottom, 0px));
	left: 50%;
	transform: translateX(-50%);
	z-index: 2000;
	pointer-events: none;
}
@media (min-width: 900px) {
	.toast-container {
		bottom: var(--space-6);
	}
}
</style>
