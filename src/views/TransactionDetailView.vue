<script setup lang="ts">
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useAccountsStore } from "@/stores/accounts.store";
import { useCategoriesStore } from "@/stores/categories.store";
import AppIcon from "@/components/ui/AppIcon.vue";
import { PhArrowsLeftRight, PhCaretLeft } from "@phosphor-icons/vue";
import FabContainer from "@/components/ui/FabContainer.vue";
import { showConfirm } from "@/utils/confirm";

const router = useRouter();
const route = useRoute();
const txStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();

const tx = computed(() => txStore.allCached.find((t) => t.id === route.params.id));
const category = computed(() => (tx.value?.categoryId ? categoriesStore.getById(tx.value.categoryId) : null));
const fromAccount = computed(() => (tx.value ? accountsStore.getById(tx.value.accountId) : null));
const toAccount = computed(() => (tx.value?.toAccountId ? accountsStore.getById(tx.value.toAccountId) : null));

async function deleteTx() {
	if (!tx.value) return;
	if (!await showConfirm("Удалить операцию?")) return;
	await txStore.deleteTransaction(tx.value.id);
	router.back();
}

function formatDateLabel(date: string): string {
	return new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
</script>

<template>
	<div class="detail-view">
		<div class="detail-view__header">
			<button
				class="detail-view__back tp-body-lg-regular"
				@click="router.back()">
				<PhCaretLeft :size="18" />
				Назад
			</button>
			<span class="detail-view__mode tp-body-md-regular" />
			<button
				v-if="tx"
				class="detail-view__edit-btn tp-label-md-medium"
				@click="router.push(`/transactions/${tx.id}/edit`)">
				Изменить
			</button>
		</div>

		<div
			v-if="!tx"
			class="detail-view__not-found">
			Операция не найдена
		</div>

		<div
			v-else
			class="detail-view__content">
			<div
				class="detail-amount tp-display-md-bold"
				:class="`text-${tx.type}`">
				<template v-if="tx.type === 'transfer'"><PhArrowsLeftRight :size="20" /></template>
				<template v-else>{{ tx.type === "income" ? "+" : "-" }}</template>
				{{ tx.amount.toLocaleString("ru-RU") }} {{ tx.currency }}
			</div>

			<div class="detail-rows">
				<div class="detail-row">
					<span class="detail-row__label">Тип</span>
					<span>{{ tx.type === "expense" ? "Расход" : tx.type === "income" ? "Доход" : "Перевод" }}</span>
				</div>
				<div
					v-if="category"
					class="detail-row tp-body-md-regular">
					<span class="detail-row__label">Категория</span>
					<span class="detail-row__cat">
						<span
							class="detail-row__cat-icon"
							:style="{ background: category.color + '22', color: category.color }">
							<AppIcon :name="category.icon" />
						</span>
						{{ category.name }}
					</span>
				</div>
				<div class="detail-row">
					<span class="detail-row__label">Счёт</span>
					<span>{{ fromAccount?.name ?? "—" }}</span>
				</div>
				<div
					v-if="toAccount"
					class="detail-row tp-body-md-regular">
					<span class="detail-row__label">Куда</span>
					<span>{{ toAccount.name }}</span>
				</div>
				<div class="detail-row">
					<span class="detail-row__label">Дата</span>
					<span>{{ formatDateLabel(tx.date) }}, {{ tx.time }}</span>
				</div>
				<div
					v-if="tx.comment"
					class="detail-row tp-body-md-regular">
					<span class="detail-row__label">Комментарий</span>
					<span>{{ tx.comment }}</span>
				</div>
			</div>

			<div class="delete-btn-inline">
				<AppButton
					variant="danger"
					full-width
					@click="deleteTx"
					>Удалить операцию</AppButton
				>
			</div>
		</div>

		<FabContainer v-if="tx">
			<AppButton
				class="fab-delete"
				variant="danger"
				size="lg"
				@click="deleteTx">
				Удалить
			</AppButton>
		</FabContainer>
	</div>
</template>

<style scoped>
.detail-view {
	display: flex;
	flex-direction: column;
	max-width: 540px;
	margin: 0 auto;
}
.detail-view__header {
	display: flex;
	align-items: center;
	padding: var(--space-5) var(--space-5) var(--space-3);
}
.detail-view__back {
	display: inline-flex;
	align-items: center;
	gap: var(--space-1);
	background: none;
	border: none;
	color: var(--accent-primary);
	cursor: pointer;
}
.detail-view__mode {
	flex: 1;
	text-align: center;
	color: var(--text-secondary);
}
.detail-view__edit-btn {
	background: none;
	border: none;
	color: var(--accent-primary);
	cursor: pointer;
}
.detail-view__not-found {
	text-align: center;
	color: var(--text-muted);
	padding: var(--space-12);
}
.detail-view__content {
	display: flex;
	flex-direction: column;
	gap: var(--space-5);
	padding: 0 var(--space-5) var(--space-8);
}

.detail-amount {
	text-align: center;
	padding: var(--space-8) 0;
}

.detail-rows {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}
.detail-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: var(--space-3) var(--space-4);
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-lg);
}
.detail-row__label {
	color: var(--text-muted);
}
.detail-row__cat {
	display: flex;
	align-items: center;
	gap: var(--space-2);
}
.detail-row__cat-icon {
	width: 24px;
	height: 24px;
	border-radius: var(--radius-xs);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 13px;
}

.fab-delete {
	display: none;
}

@media (max-width: 899px) {
	.delete-btn-inline {
		display: none;
	}

	.fab-delete {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
}
</style>
