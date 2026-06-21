<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppModal from "@/components/ui/AppModal.vue";
import { useGamificationStore, ACHIEVEMENT_LABELS } from "@/stores/gamification.store";
import { useSettingsStore } from "@/stores/settings.store";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useAccountsStore } from "@/stores/accounts.store";
import { useCategoriesStore } from "@/stores/categories.store";
import { useBudgetsStore } from "@/stores/budgets.store";
import { exportTransactionsCSV, exportVaultJSON } from "@/services/data/export.service";
import { requestNotificationPermission, scheduleDailyReminder, cancelDailyReminder } from "@/services/notifications.service";
import { getFileSystemAdapter } from "@/services/filesystem";
import { vaultService } from "@/services/data/vault.service";
import { transactionsService } from "@/services/data/transactions.service";
import { LEVEL_LABELS } from "@/types";
import type { AchievementKey } from "@/types";

const router = useRouter();
const gamificationStore = useGamificationStore();
const settingsStore = useSettingsStore();
const txStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const budgetsStore = useBudgetsStore();

const g = gamificationStore.state;
const isExporting = ref(false);
const exportError = ref("");

// ── Vault change ───────────────────────────────────────────────────────────────
const showVaultModal = ref(false);
const vaultStep = ref<"choose" | "loading">("choose");
const vaultLoadingMsg = ref("");
const vaultError = ref("");

function openVaultModal() {
	showVaultModal.value = true;
	vaultStep.value = "choose";
	vaultError.value = "";
}

function closeVaultModal() {
	if (vaultStep.value === "loading") return;
	showVaultModal.value = false;
}

async function moveVault() {
	vaultError.value = "";
	try {
		const fs = await getFileSystemAdapter();
		const result = await fs.pickFolder({ title: "Выберите новую папку для хранения данных" });
		vaultStep.value = "loading";
		vaultLoadingMsg.value = "Перенос данных";

		const metadata = await vaultService.readMetadata();
		await settingsStore.setVaultPath(result.uri);

		const fs2 = await getFileSystemAdapter();
		if (metadata) {
			await fs2.writeJson("metadata.json", { metadata });
		} else {
			await vaultService.initNewVault(settingsStore.settings.deviceId);
		}

		await Promise.all([accountsStore.save(), categoriesStore.save(), budgetsStore.save()]);
		await gamificationStore.persist();

		for (const [month, transactions] of txStore._cache) {
			await transactionsService.saveMonth(month, transactions);
		}

		showVaultModal.value = false;
		vaultStep.value = "choose";
	} catch (e) {
		vaultError.value = e instanceof Error ? e.message : "Ошибка переноса данных";
		vaultStep.value = "choose";
	}
}

async function switchVault() {
	vaultError.value = "";
	try {
		const fs = await getFileSystemAdapter();
		const result = await fs.pickFolder({ title: "Выберите папку с хранилищем" });
		vaultStep.value = "loading";
		vaultLoadingMsg.value = "Загрузка хранилища";

		await settingsStore.setVaultPath(result.uri);

		const metadata = await vaultService.readMetadata();
		if (!metadata) {
			await vaultService.initNewVault(settingsStore.settings.deviceId);
		}

		txStore._cache.clear();
		txStore.loadedMonths.clear();

		await Promise.all([accountsStore.load(), categoriesStore.load(), gamificationStore.load(), budgetsStore.load()]);
		await txStore.loadCurrentAndPrevMonth();

		showVaultModal.value = false;
		vaultStep.value = "choose";
	} catch (e) {
		vaultError.value = e instanceof Error ? e.message : "Ошибка открытия хранилища";
		vaultStep.value = "choose";
	}
}

// ── Notifications ─────────────────────────────────────────────────────────────
const notifEnabled = ref(settingsStore.settings.notificationsEnabled);
const notifTime = ref(settingsStore.settings.reminderTime ?? "20:00");
const notifSaving = ref(false);

async function toggleNotifications() {
	notifEnabled.value = !notifEnabled.value;
	notifSaving.value = true;
	try {
		if (notifEnabled.value) {
			const granted = await requestNotificationPermission();
			if (!granted) {
				notifEnabled.value = false;
				return;
			}
			await scheduleDailyReminder(notifTime.value);
		} else {
			await cancelDailyReminder();
		}
		settingsStore.settings.notificationsEnabled = notifEnabled.value;
		await settingsStore.save();
	} finally {
		notifSaving.value = false;
	}
}

async function saveNotifTime() {
	if (!notifEnabled.value) return;
	settingsStore.settings.reminderTime = notifTime.value;
	await Promise.all([scheduleDailyReminder(notifTime.value), settingsStore.save()]);
}

async function doExportCSV() {
	isExporting.value = true;
	exportError.value = "";
	try {
		await exportTransactionsCSV(txStore.allCached, accountsStore.accounts, categoriesStore.categories);
	} catch (e) {
		exportError.value = e instanceof Error ? e.message : "Ошибка экспорта";
	} finally {
		isExporting.value = false;
	}
}

async function doExportJSON() {
	isExporting.value = true;
	exportError.value = "";
	try {
		await exportVaultJSON(txStore.allCached);
	} catch (e) {
		exportError.value = e instanceof Error ? e.message : "Ошибка экспорта";
	} finally {
		isExporting.value = false;
	}
}
</script>

<template>
	<div class="profile-view">
		<div class="profile-view__header">
			<h2 class="profile-view__title">Профиль</h2>
		</div>

		<!-- Level card -->
		<div class="level-card">
			<div class="level-card__badge">🏅</div>
			<div class="level-card__info">
				<div class="level-card__level">{{ gamificationStore.levelLabel }}</div>
				<div class="level-card__xp">{{ g.xp }} XP</div>
				<div class="level-card__bar-wrap">
					<div
						class="level-card__bar"
						:style="{ width: gamificationStore.levelProgress + '%' }" />
				</div>
				<div class="level-card__next text-muted">
					<span v-if="gamificationStore.nextLevel">
						До уровня «{{ LEVEL_LABELS[gamificationStore.nextLevel] }}»: {{ gamificationStore.xpToNextLevel }} XP
					</span>
					<span v-else>Максимальный уровень</span>
				</div>
			</div>
		</div>

		<!-- Stats -->
		<div class="stats-grid">
			<div class="stat">
				<div class="stat__value">{{ g.totalTransactions }}</div>
				<div class="stat__label">Операций</div>
			</div>
			<div class="stat">
				<div class="stat__value">🔥 {{ g.currentStreak }}</div>
				<div class="stat__label">Дней подряд</div>
			</div>
			<div class="stat">
				<div class="stat__value">{{ g.longestStreak }}</div>
				<div class="stat__label">Лучшая серия</div>
			</div>
		</div>

		<!-- Achievements -->
		<div class="section">
			<h3 class="section__title">Достижения</h3>
			<div class="achievements">
				<div
					v-for="achievement in g.achievements"
					:key="achievement.key"
					:class="['achievement', { 'achievement--locked': !achievement.unlockedAt }]">
					<div class="achievement__icon">
						{{ achievement.unlockedAt ? "🏆" : "🔒" }}
					</div>
					<div class="achievement__info">
						<div class="achievement__name">
							{{ ACHIEVEMENT_LABELS[achievement.key as AchievementKey]?.name }}
						</div>
						<div class="achievement__desc text-muted">
							{{ ACHIEVEMENT_LABELS[achievement.key as AchievementKey]?.description }}
						</div>
						<div
							v-if="!achievement.unlockedAt && achievement.progress > 0"
							class="achievement__progress-wrap">
							<div
								class="achievement__progress"
								:style="{ width: achievement.progress + '%' }" />
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Import -->
		<div class="section">
			<h3 class="section__title">Импорт данных</h3>
			<div class="export-list">
				<div class="export-row">
					<div class="export-row__info">
						<div class="export-row__name">Импорт из CSV</div>
						<div class="export-row__desc text-muted">Выписка из банка в формате CSV</div>
					</div>
					<AppButton
						size="sm"
						variant="secondary"
						@click="router.push('/import')">
						Импортировать
					</AppButton>
				</div>
			</div>
		</div>

		<!-- Export -->
		<div class="section">
			<h3 class="section__title">Экспорт данных</h3>
			<div class="export-list">
				<div class="export-row">
					<div class="export-row__info">
						<div class="export-row__name">Транзакции (CSV)</div>
						<div class="export-row__desc text-muted">Все операции в формате таблицы</div>
					</div>
					<AppButton
						size="sm"
						variant="secondary"
						:loading="isExporting"
						@click="doExportCSV">
						Скачать
					</AppButton>
				</div>
				<div class="export-row">
					<div class="export-row__info">
						<div class="export-row__name">Транзакции (JSON)</div>
						<div class="export-row__desc text-muted">Полный дамп в JSON-формате</div>
					</div>
					<AppButton
						size="sm"
						variant="secondary"
						:loading="isExporting"
						@click="doExportJSON">
						Скачать
					</AppButton>
				</div>
				<p
					v-if="exportError"
					class="export-error">
					{{ exportError }}
				</p>
			</div>
		</div>

		<!-- Notifications -->
		<div class="section">
			<h3 class="section__title">Уведомления</h3>
			<div class="settings-list">
				<div class="setting-row">
					<div>
						<div>Ежедневное напоминание</div>
						<div
							class="text-muted"
							style="font-size: var(--font-xs)">
							Напомнить записать расходы
						</div>
					</div>
					<button
						:class="['toggle', { 'toggle--on': notifEnabled }]"
						:disabled="notifSaving"
						@click="toggleNotifications">
						<span class="toggle__thumb" />
					</button>
				</div>
				<div
					v-if="notifEnabled"
					class="setting-row">
					<label>Время напоминания</label>
					<input
						type="time"
						v-model="notifTime"
						class="time-input"
						@change="saveNotifTime" />
				</div>
			</div>
		</div>

		<!-- Settings -->
		<div class="section">
			<h3 class="section__title">Настройки</h3>
			<div class="settings-list">
				<div class="setting-row">
					<span>Тема</span>
					<button
						class="theme-toggle"
						@click="settingsStore.setTheme(settingsStore.settings.theme === 'dark' ? 'light' : 'dark')">
						{{ settingsStore.settings.theme === "dark" ? "☀ Светлая" : "🌙 Тёмная" }}
					</button>
				</div>
				<div class="setting-row vault-row">
					<span>Хранилище</span>
					<div class="vault-row__right">
						<span class="text-muted vault-path">
							{{ settingsStore.settings.vaultPath ?? "—" }}
						</span>
						<button
							class="vault-change-btn"
							@click="openVaultModal">
							Сменить
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>

	<AppModal
		v-if="showVaultModal"
		title="Сменить хранилище"
		size="sm"
		@close="closeVaultModal">
		<div class="vault-modal">
			<template v-if="vaultStep === 'choose'">
				<div class="vault-modal__actions">
					<button
						class="vault-option"
						@click="moveVault">
						<div class="vault-option__icon">📦</div>
						<div class="vault-option__text">
							<div class="vault-option__title">Перенести данные</div>
							<div class="vault-option__desc">Скопировать все данные в новую папку</div>
						</div>
					</button>
					<button
						class="vault-option"
						@click="switchVault">
						<div class="vault-option__icon">📂</div>
						<div class="vault-option__text">
							<div class="vault-option__title">Открыть другое хранилище</div>
							<div class="vault-option__desc">Переключиться на существующую папку</div>
						</div>
					</button>
				</div>
				<p
					v-if="vaultError"
					class="vault-modal__error">
					{{ vaultError }}
				</p>
			</template>
			<template v-else>
				<div class="vault-modal__loading">
					<div class="vault-modal__spinner" />
					<p>{{ vaultLoadingMsg }}…</p>
				</div>
			</template>
		</div>
	</AppModal>
</template>

<style scoped>
.profile-view {
	display: flex;
	flex-direction: column;
	gap: var(--space-5);
	padding-bottom: var(--space-8);
}
.profile-view__header {
	padding: var(--space-5) var(--space-5) 0;
}
.profile-view__title {
	font-size: var(--font-xl);
	font-weight: 700;
}

.level-card {
	margin: 0 var(--space-5);
	display: flex;
	gap: var(--space-4);
	align-items: center;
	padding: var(--space-5);
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-xl);
}
.level-card__badge {
	font-size: 48px;
}
.level-card__info {
	flex: 1;
}
.level-card__level {
	font-size: var(--font-xl);
	font-weight: 700;
}
.level-card__xp {
	font-size: var(--font-sm);
	color: var(--accent-primary);
	font-weight: 600;
}
.level-card__bar-wrap {
	height: 6px;
	background: var(--bg-elevated);
	border-radius: var(--radius-full);
	margin: var(--space-2) 0;
	overflow: hidden;
}
.level-card__bar {
	height: 100%;
	background: var(--accent-primary);
	border-radius: var(--radius-full);
	transition: width 0.5s ease;
}
.level-card__next {
	font-size: var(--font-xs);
}

.stats-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: var(--space-3);
	margin: 0 var(--space-5);
}
.stat {
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-lg);
	padding: var(--space-4);
	text-align: center;
}
.stat__value {
	font-size: var(--font-xl);
	font-weight: 700;
}
.stat__label {
	font-size: var(--font-xs);
	color: var(--text-muted);
}

.section {
	padding: 0 var(--space-5);
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}
.section__title {
	font-size: var(--font-lg);
	font-weight: 600;
}

.achievements {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}
.achievement {
	display: flex;
	gap: var(--space-3);
	align-items: flex-start;
	padding: var(--space-4);
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-lg);
}
.achievement--locked {
	opacity: 0.5;
}
.achievement__icon {
	font-size: 28px;
	flex-shrink: 0;
}
.achievement__info {
	flex: 1;
}
.achievement__name {
	font-weight: 600;
	font-size: var(--font-sm);
}
.achievement__desc {
	font-size: var(--font-xs);
	margin-top: 2px;
}
.achievement__progress-wrap {
	height: 4px;
	background: var(--bg-elevated);
	border-radius: var(--radius-full);
	margin-top: var(--space-2);
	overflow: hidden;
}
.achievement__progress {
	height: 100%;
	background: var(--accent-primary);
	border-radius: var(--radius-full);
}

.export-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}
.export-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-4);
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-lg);
}
.export-row__info {
	display: flex;
	flex-direction: column;
	gap: 2px;
}
.export-row__name {
	font-size: var(--font-sm);
	font-weight: 500;
}
.export-row__desc {
	font-size: var(--font-xs);
}
.export-error {
	font-size: var(--font-xs);
	color: var(--accent-danger);
	padding: var(--space-2) 0;
}

.settings-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}
.setting-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-4);
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-lg);
	font-size: var(--font-sm);
}
.theme-toggle {
	background: var(--bg-elevated);
	border: none;
	border-radius: var(--radius-sm);
	padding: var(--space-1) var(--space-3);
	color: var(--text-primary);
	cursor: pointer;
	font-size: var(--font-sm);
}

.toggle {
	width: 44px;
	height: 24px;
	border-radius: 12px;
	flex-shrink: 0;
	background: var(--bg-elevated);
	border: 1px solid var(--border);
	cursor: pointer;
	position: relative;
	transition: background var(--transition);
}
.toggle--on {
	background: var(--accent-primary);
	border-color: var(--accent-primary);
}
.toggle__thumb {
	position: absolute;
	top: 2px;
	left: 2px;
	width: 18px;
	height: 18px;
	border-radius: 50%;
	background: white;
	transition: transform var(--transition);
}
.toggle--on .toggle__thumb {
	transform: translateX(20px);
}
.toggle:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.time-input {
	height: 36px;
	padding: 0 var(--space-3);
	border-radius: var(--radius-md);
	border: 1px solid var(--border);
	background: var(--bg-input);
	color: var(--text-primary);
	font-size: var(--font-sm);
}

.vault-row .vault-row__right {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	min-width: 0;
}
.vault-change-btn {
	background: var(--bg-elevated);
	border: none;
	border-radius: var(--radius-sm);
	padding: var(--space-1) var(--space-3);
	color: var(--text-primary);
	cursor: pointer;
	font-size: var(--font-sm);
	flex-shrink: 0;
}
.vault-path {
	font-size: var(--font-xs);
	max-width: 200px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.vault-modal {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
}
.vault-modal__actions {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}
.vault-option {
	display: flex;
	align-items: center;
	gap: var(--space-4);
	width: 100%;
	padding: var(--space-4);
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-lg);
	cursor: pointer;
	text-align: left;
	color: var(--text-primary);
	transition: border-color 0.15s;
}
.vault-option:hover {
	border-color: var(--accent-primary);
}
.vault-option__icon {
	font-size: 28px;
	flex-shrink: 0;
}
.vault-option__title {
	font-size: var(--font-sm);
	font-weight: 600;
}
.vault-option__desc {
	font-size: var(--font-xs);
	color: var(--text-muted);
	margin-top: 2px;
}
.vault-modal__error {
	font-size: var(--font-xs);
	color: var(--accent-danger);
	padding: var(--space-3);
	background: var(--accent-danger-soft);
	border-radius: var(--radius-md);
}
.vault-modal__loading {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-4);
	padding: var(--space-6) 0;
	color: var(--text-secondary);
}
.vault-modal__spinner {
	width: 36px;
	height: 36px;
	border: 3px solid var(--border);
	border-top-color: var(--accent-primary);
	border-radius: 50%;
	animation: spin 0.8s linear infinite;
}
</style>
