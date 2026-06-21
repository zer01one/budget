<script setup lang="ts">
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import { useAccountsStore } from "@/stores/accounts.store";
import { useTransactionsStore } from "@/stores/transactions.store";
import AppIcon from "@/components/ui/AppIcon.vue";

const router = useRouter();
const accountsStore = useAccountsStore();
const txStore = useTransactionsStore();

function getBalance(id: string, initial: number) {
	return txStore.computeAccountBalance(id, initial);
}

function formatAmount(n: number, currency: string) {
	return n.toLocaleString("ru-RU") + " " + currency;
}
</script>

<template>
	<div class="accounts-view">
		<div class="accounts-view__header">
			<h2 class="accounts-view__title">Счета</h2>
			<AppButton
				size="sm"
				@click="router.push('/accounts/new')"
				>+ Добавить</AppButton
			>
		</div>

		<div
			v-if="accountsStore.activeAccounts.length === 0"
			class="accounts-view__empty">
			Нет счетов. Создайте первый счёт.
		</div>

		<div class="accounts-list">
			<div
				v-for="acc in accountsStore.activeAccounts"
				:key="acc.id"
				class="account-card"
				:style="{ '--acc-color': acc.color }"
				@click="router.push(`/accounts/${acc.id}`)">
				<div class="account-card__icon"><AppIcon :name="acc.icon ?? 'other'" /></div>
				<div class="account-card__info">
					<div class="account-card__name">{{ acc.name }}</div>
					<div class="account-card__type text-muted">{{ acc.type }}</div>
				</div>
				<div class="account-card__balance">
					{{ formatAmount(getBalance(acc.id, acc.initialBalance), acc.currency) }}
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.accounts-view {
	display: flex;
	flex-direction: column;
}
.accounts-view__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-5);
}
.accounts-view__title {
	font-size: var(--font-xl);
	font-weight: 700;
}
.accounts-view__empty {
	text-align: center;
	color: var(--text-muted);
	padding: var(--space-12);
}
.accounts-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: 0 var(--space-5) var(--space-6);
}
.account-card {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-4);
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-lg);
	border-left: 4px solid var(--acc-color, var(--accent-primary));
	cursor: pointer;
	transition: background var(--transition);
}
.account-card:hover {
	background: var(--bg-elevated);
}
.account-card__icon {
	width: 44px;
	height: 44px;
	border-radius: var(--radius-md);
	background: var(--acc-color, var(--accent-primary));
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 20px;
	flex-shrink: 0;
	opacity: 0.85;
}
.account-card__info {
	flex: 1;
}
.account-card__name {
	font-weight: 600;
}
.account-card__balance {
	font-weight: 700;
	font-variant-numeric: tabular-nums;
}
</style>
