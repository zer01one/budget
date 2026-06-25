<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import { useAccountsStore } from "@/stores/accounts.store";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useCategoriesStore } from "@/stores/categories.store";
import { useGamificationStore } from "@/stores/gamification.store";
import type { Transaction } from "@/types";
import AppIcon from "@/components/ui/AppIcon.vue";

const router = useRouter();
const accountsStore = useAccountsStore();
const txStore = useTransactionsStore();
const categoriesStore = useCategoriesStore();
const gamificationStore = useGamificationStore();

const currentMonth = new Date().toISOString().slice(0, 7);

onMounted(async () => {
	await txStore.loadCurrentAndPrevMonth();
	gamificationStore.checkDailyStreak();
});

const totalBalance = computed(() => {
	return accountsStore.activeAccounts.reduce((sum, acc) => sum + (acc.balance ?? acc.initialBalance), 0);
});

const currentMonthTx = computed(() => txStore.getByMonth(currentMonth).filter((t) => !t.isDeleted));

const monthIncome = computed(() => currentMonthTx.value.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0));

const monthExpenses = computed(() => currentMonthTx.value.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0));

const savingsRate = computed(() => {
	if (monthIncome.value === 0) return 0;
	return Math.round(((monthIncome.value - monthExpenses.value) / monthIncome.value) * 100);
});

const recentTransactions = computed(() =>
	[...currentMonthTx.value].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)).slice(0, 5)
);

function formatAmount(tx: Transaction): string {
	const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "↔";
	return `${sign}${tx.amount.toLocaleString("ru-RU")}`;
}

function getCategory(id: string | null) {
	return id ? categoriesStore.getById(id) : null;
}

function formatCurrency(amount: number): string {
	return amount.toLocaleString("ru-RU");
}

function formatDate(date: string): string {
	const d = new Date(date);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);
	if (date === today.toLocaleDateString("en-CA")) return "Сегодня";
	if (date === yesterday.toLocaleDateString("en-CA")) return "Вчера";
	return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
</script>

<template>
	<div class="dashboard">
		<!-- Header -->
		<div class="dashboard__header">
			<div class="dashboard__balance-label">Общий баланс</div>
			<div class="dashboard__balance">{{ formatCurrency(totalBalance) }}</div>
			<AppButton
				size="sm"
				@click="router.push('/transactions/add')">
				+ Добавить
			</AppButton>
		</div>

		<!-- Summary cards -->
		<div class="dashboard__summary">
			<div class="summary-card">
				<div class="summary-card__label">Доходы</div>
				<div class="summary-card__value text-income">+{{ formatCurrency(monthIncome) }}</div>
			</div>
			<div class="summary-card">
				<div class="summary-card__label">Расходы</div>
				<div class="summary-card__value text-expense">-{{ formatCurrency(monthExpenses) }}</div>
			</div>
			<div class="summary-card">
				<div class="summary-card__label">Норма сбережений</div>
				<div
					class="summary-card__value"
					:class="savingsRate >= 0 ? 'text-income' : 'text-expense'">
					{{ savingsRate }}%
				</div>
			</div>
		</div>

		<!-- Gamification streak -->
		<div
			v-if="gamificationStore.state.currentStreak > 0"
			class="streak-banner">
			<span class="streak-banner__icon">🔥</span>
			<div>
				<div class="streak-banner__count">{{ gamificationStore.state.currentStreak }} дней подряд</div>
				<div class="streak-banner__label">{{ gamificationStore.levelLabel }} · {{ gamificationStore.state.xp }} XP</div>
			</div>
		</div>

		<!-- Recent transactions -->
		<div class="dashboard__section">
			<div class="section-header">
				<span class="section-header__title">Последние операции</span>
				<button
					class="section-header__link"
					@click="router.push('/transactions')">
					Все →
				</button>
			</div>

			<div
				v-if="recentTransactions.length === 0"
				class="dashboard__empty">
				Нет операций за этот месяц
			</div>

			<div
				v-else
				class="tx-list">
				<div
					v-for="tx in recentTransactions"
					:key="tx.id"
					class="tx-row"
					@click="router.push(`/transactions/${tx.id}`)">
					<div
						class="tx-row__icon"
						:style="{ background: getCategory(tx.categoryId)?.color + '22', color: getCategory(tx.categoryId)?.color }">
						<AppIcon :name="getCategory(tx.categoryId)?.icon ?? 'other'" />
					</div>
					<div class="tx-row__info">
						<div class="tx-row__name">{{ getCategory(tx.categoryId)?.name ?? "Перевод" }}</div>
						<div class="tx-row__meta">{{ tx.comment || formatDate(tx.date) }}</div>
					</div>
					<div :class="['tx-row__amount', `text-${tx.type}`]">
						{{ formatAmount(tx) }}
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.dashboard {
	display: flex;
	flex-direction: column;
	gap: var(--space-5);
	padding: var(--space-5) var(--space-5) var(--space-8);
	max-width: 640px;
	margin: 0 auto;
}

.dashboard__header {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-2);
	padding: var(--space-8) 0 var(--space-5);
	text-align: center;
}
.dashboard__balance-label {
	font-size: var(--font-sm);
	color: var(--text-secondary);
}
.dashboard__balance {
	font-size: var(--font-3xl);
	font-weight: 700;
	letter-spacing: -1px;
}

.dashboard__summary {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: var(--space-3);
}

.summary-card {
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-lg);
	padding: var(--space-4);
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
}
.summary-card__label {
	font-size: var(--font-xs);
	color: var(--text-muted);
}
.summary-card__value {
	font-size: var(--font-md);
	font-weight: 600;
}

.streak-banner {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-4);
	background: var(--accent-warning-soft);
	border: 1px solid var(--accent-warning);
	border-radius: var(--radius-lg);
}
.streak-banner__icon {
	font-size: 32px;
}
.streak-banner__count {
	font-weight: 600;
	font-size: var(--font-md);
}
.streak-banner__label {
	font-size: var(--font-sm);
	color: var(--text-secondary);
}

.dashboard__section {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}
.section-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.section-header__title {
	font-size: var(--font-md);
	font-weight: 600;
}
.section-header__link {
	font-size: var(--font-sm);
	color: var(--accent-primary);
	background: none;
	border: none;
	cursor: pointer;
}

.dashboard__empty {
	color: var(--text-muted);
	text-align: center;
	padding: var(--space-8);
}

.tx-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.tx-row {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-4);
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-lg);
	cursor: pointer;
	transition: background var(--transition);
}
.tx-row:hover {
	background: var(--bg-elevated);
}

.tx-row__icon {
	width: 40px;
	height: 40px;
	border-radius: var(--radius-md);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 18px;
	flex-shrink: 0;
	background: var(--bg-elevated);
}
.tx-row__info {
	flex: 1;
	min-width: 0;
}
.tx-row__name {
	font-size: var(--font-sm);
	font-weight: 500;
}
.tx-row__meta {
	font-size: var(--font-xs);
	color: var(--text-muted);
}
.tx-row__amount {
	font-size: var(--font-md);
	font-weight: 600;
	font-variant-numeric: tabular-nums;
}
</style>
