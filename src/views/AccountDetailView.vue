<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import { useAccountsStore } from "@/stores/accounts.store";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useCategoriesStore } from "@/stores/categories.store";
import type { Transaction } from "@/types";
import AppIcon from "@/components/ui/AppIcon.vue";
import { showConfirm } from "@/utils/confirm";
import { useScrollRestore } from "@/composables/useScrollRestore";

const router = useRouter();
const route = useRoute();
const accountsStore = useAccountsStore();
useScrollRestore();
const txStore = useTransactionsStore();
const categoriesStore = useCategoriesStore();

const account = computed(() => accountsStore.getById(route.params.id as string));

const balance = computed(() => account.value?.balance ?? account.value?.initialBalance ?? 0);

const transactionsWithBalance = computed(() => {
	if (!account.value) return [];
	const accountId = account.value.id;
	const sorted = txStore
		.getByAccount(accountId)
		.slice()
		.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

	let running = account.value.balance ?? account.value.initialBalance;
	return sorted.map((tx) => {
		const balanceAfter = running;
		if (tx.accountId === accountId) {
			running -= tx.type === "income" ? tx.amount : -tx.amount;
		} else if (tx.toAccountId === accountId && tx.type === "transfer") {
			running -= tx.amount;
		}
		return { ...tx, runningBalance: balanceAfter };
	});
});

onMounted(() => txStore.loadCurrentAndPrevMonth());

function formatAmount(tx: Transaction): string {
	const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "↔";
	return `${sign}${tx.amount.toLocaleString("ru-RU")}`;
}

function getCategory(id: string | null) {
	return id ? categoriesStore.getById(id) : null;
}

async function archiveAccount() {
	if (!account.value) return;
	if (!await showConfirm("Архивировать счёт? Транзакции сохранятся.")) return;
	await accountsStore.deleteAccount(account.value.id);
	router.back();
}
</script>

<template>
	<div class="account-detail">
		<div class="account-detail__header">
			<button
				class="back-btn"
				@click="router.back()">
				← Назад
			</button>
			<h2 class="account-detail__title">{{ account?.name ?? "Счёт" }}</h2>
		</div>

		<div
			v-if="!account"
			class="account-detail__not-found">
			Счёт не найден
		</div>

		<template v-else>
			<!-- Balance hero -->
			<div
				class="balance-hero"
				:style="{ '--acc-color': account.color }">
				<div class="balance-hero__icon"><AppIcon :name="account.icon" /></div>
				<div class="balance-hero__amount">{{ balance.toLocaleString("ru-RU") }} {{ account.currency }}</div>
				<div class="balance-hero__label text-muted">Текущий баланс</div>
			</div>

			<!-- Stats row -->
			<div class="stats-row">
				<div class="stat-chip">
					<span class="text-income">
						+{{
							transactionsWithBalance
								.filter((t) => t.type === "income")
								.reduce((s, t) => s + t.amount, 0)
								.toLocaleString("ru-RU")
						}}
					</span>
					<span class="text-muted">Доходы</span>
				</div>
				<div class="stat-chip">
					<span class="text-expense">
						-{{
							transactionsWithBalance
								.filter((t) => t.type === "expense")
								.reduce((s, t) => s + t.amount, 0)
								.toLocaleString("ru-RU")
						}}
					</span>
					<span class="text-muted">Расходы</span>
				</div>
			</div>

			<!-- Add transaction shortcut -->
			<div class="account-detail__actions">
				<AppButton
					full-width
					@click="router.push('/transactions/add')">
					+ Добавить операцию
				</AppButton>
			</div>

			<!-- Transactions -->
			<div class="section">
				<div class="section__title">Операции</div>

				<div
					v-if="transactionsWithBalance.length === 0"
					class="empty">
					Нет операций по этому счёту
				</div>

				<div
					v-else
					class="tx-list">
					<div
						v-for="tx in transactionsWithBalance"
						:key="tx.id"
						class="tx-row"
						@click="router.push(`/transactions/${tx.id}`)">
						<div
							class="tx-row__icon"
							:style="{ background: getCategory(tx.categoryId)?.color + '22', color: getCategory(tx.categoryId)?.color }">
							<AppIcon :name="getCategory(tx.categoryId)?.icon ?? 'transfer'" />
						</div>
						<div class="tx-row__info">
							<div class="tx-row__name">{{ getCategory(tx.categoryId)?.name ?? "Перевод" }}</div>
							<div class="tx-row__meta">{{ tx.date }} {{ tx.comment ? "· " + tx.comment : "" }}</div>
						</div>
						<div class="tx-row__right">
							<div :class="['tx-row__amount', `text-${tx.type}`]">{{ formatAmount(tx) }}</div>
							<div class="tx-row__balance">{{ tx.runningBalance.toLocaleString("ru-RU") }}</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Archive -->
			<div class="account-detail__danger">
				<AppButton
					variant="ghost"
					size="sm"
					@click="archiveAccount">
					Архивировать счёт
				</AppButton>
			</div>
		</template>
	</div>
</template>

<style scoped>
.account-detail {
	display: flex;
	flex-direction: column;
	max-width: 540px;
	margin: 0 auto;
}
.account-detail__header {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-5) var(--space-5) var(--space-3);
}
.account-detail__title {
	font-size: var(--font-xl);
	font-weight: 700;
}
.back-btn {
	background: none;
	border: none;
	color: var(--accent-primary);
	cursor: pointer;
	font-size: var(--font-md);
}
.account-detail__not-found {
	text-align: center;
	color: var(--text-muted);
	padding: var(--space-12);
}

.balance-hero {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-2);
	padding: var(--space-8) var(--space-5) var(--space-6);
	text-align: center;
}
.balance-hero__icon {
	font-size: 48px;
}
.balance-hero__amount {
	font-size: var(--font-3xl);
	font-weight: 700;
	letter-spacing: -1px;
}

.stats-row {
	display: flex;
	gap: var(--space-3);
	padding: 0 var(--space-5) var(--space-4);
}
.stat-chip {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
	padding: var(--space-3);
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-md);
	font-size: var(--font-sm);
	font-weight: 600;
}
.stat-chip .text-muted {
	font-weight: 400;
	font-size: var(--font-xs);
}

.account-detail__actions {
	padding: 0 var(--space-5) var(--space-4);
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
.empty {
	text-align: center;
	color: var(--text-muted);
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
	padding: var(--space-3) var(--space-4);
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
	width: 36px;
	height: 36px;
	border-radius: var(--radius-sm);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 16px;
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
.tx-row__right {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 2px;
}
.tx-row__amount {
	font-size: var(--font-sm);
	font-weight: 600;
	font-variant-numeric: tabular-nums;
}
.tx-row__balance {
	font-size: var(--font-xs);
	color: var(--text-muted);
	font-variant-numeric: tabular-nums;
}

.account-detail__danger {
	padding: var(--space-5);
	text-align: center;
}
</style>
