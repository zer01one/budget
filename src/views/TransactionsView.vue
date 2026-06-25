<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useCategoriesStore } from "@/stores/categories.store";
import { useAccountsStore } from "@/stores/accounts.store";
import { transactionsService } from "@/services/data/transactions.service";
import type { Transaction, TransactionType } from "@/types";
import AppIcon from "@/components/ui/AppIcon.vue";
import AppSelect from "@/components/ui/AppSelect.vue";
import { useScrollRestore } from "@/composables/useScrollRestore";
import ScrollToTopButton from "@/components/ui/ScrollToTopButton.vue";

const router = useRouter();
const txStore = useTransactionsStore();
const categoriesStore = useCategoriesStore();
const accountsStore = useAccountsStore();

const txGroupsRef = ref<HTMLElement | null>(null);
useScrollRestore(txGroupsRef);

const search = ref("");
const isLoadingMore = ref(false);
const allMonths = ref<string[]>([]);
const loadedMonthsCount = ref(2);

// ── Filters ───────────────────────────────────────────────────────────────────
const showFilters = ref(false);
const filterType = ref<TransactionType | "">("");
const filterAccountId = ref("");
const filterCategoryId = ref("");
const filterFrom = ref("");
const filterTo = ref("");

const filterTypeOptions = [
	{ value: "", label: "Все" },
	{ value: "expense", label: "Расход" },
	{ value: "income", label: "Доход" },
	{ value: "transfer", label: "Перевод" },
];
const filterAccountOptions = computed(() => [
	{ value: "", label: "Все счета" },
	...accountsStore.activeAccounts.map((a) => ({ value: a.id, label: a.name })),
]);
const filterCategoryOptions = computed(() => [
	{ value: "", label: "Все категории" },
	...categoriesStore.categories
		.filter((c) => !c.isArchived)
		.map((c) => ({ value: c.id, label: c.name })),
]);

const activeFilterCount = computed(
	() => [filterType.value, filterAccountId.value, filterCategoryId.value, filterFrom.value, filterTo.value].filter(Boolean).length
);

function resetFilters() {
	filterType.value = "";
	filterAccountId.value = "";
	filterCategoryId.value = "";
	filterFrom.value = "";
	filterTo.value = "";
}

onMounted(async () => {
	await txStore.loadCurrentAndPrevMonth();
	allMonths.value = await transactionsService.listMonths();
});

const filtered = computed(() => {
	const q = search.value.toLowerCase().trim();
	return txStore.allCached.filter((t) => {
		if (t.isDeleted) return false;
		if (
			q &&
			!t.comment.toLowerCase().includes(q) &&
			!(categoriesStore.getById(t.categoryId ?? "")?.name ?? "").toLowerCase().includes(q) &&
			!t.amount.toString().includes(q)
		)
			return false;
		if (filterType.value && t.type !== filterType.value) return false;
		if (filterAccountId.value && t.accountId !== filterAccountId.value) return false;
		if (filterCategoryId.value && t.categoryId !== filterCategoryId.value) return false;
		if (filterFrom.value && t.date < filterFrom.value) return false;
		if (filterTo.value && t.date > filterTo.value) return false;
		return true;
	});
});

// Group by date, sorted newest first
interface Group {
	date: string;
	label: string;
	transactions: Transaction[];
}

const grouped = computed((): Group[] => {
	const map = new Map<string, Transaction[]>();
	for (const tx of filtered.value) {
		const list = map.get(tx.date) ?? [];
		list.push(tx);
		map.set(tx.date, list);
	}
	return [...map.entries()]
		.sort(([a], [b]) => b.localeCompare(a))
		.map(([date, transactions]) => ({
			date,
			label: formatDateLabel(date),
			transactions: transactions.sort((a, b) => b.time.localeCompare(a.time))
		}));
});

function formatDateLabel(date: string): string {
	const today = new Date().toLocaleDateString("en-CA");
	const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
	if (date === today) return "Сегодня";
	if (date === yesterday) return "Вчера";
	return new Date(date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long" });
}

function formatAmount(tx: Transaction): string {
	const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "↔";
	return `${sign}${tx.amount.toLocaleString("ru-RU")}`;
}

function getCategory(id: string | null) {
	return id ? categoriesStore.getById(id) : null;
}

function dayTotal(txs: Transaction[]): { income: number; expense: number } {
	return txs.reduce(
		(acc, tx) => {
			if (tx.type === "income") acc.income += tx.amount;
			if (tx.type === "expense") acc.expense += tx.amount;
			return acc;
		},
		{ income: 0, expense: 0 }
	);
}

async function loadMore() {
	const nextMonths = allMonths.value.slice(loadedMonthsCount.value, loadedMonthsCount.value + 3);
	if (!nextMonths.length) return;
	isLoadingMore.value = true;
	try {
		await Promise.all(nextMonths.map((m) => txStore.loadMonth(m)));
		loadedMonthsCount.value += nextMonths.length;
	} finally {
		isLoadingMore.value = false;
	}
}

const hasMore = computed(() => loadedMonthsCount.value < allMonths.value.length);
</script>

<template>
	<div class="tx-view">
		<!-- Header -->
		<div class="tx-view__header">
			<h2 class="tx-view__title">Операции</h2>
			<AppButton
				size="sm"
				@click="router.push('/transactions/add')"
				>+ Добавить</AppButton
			>
		</div>

		<!-- Search + filter toggle -->
		<div class="tx-view__search-wrap">
			<input
				v-model="search"
				class="tx-view__search"
				placeholder="Поиск по операциям…" />
			<button
				:class="['tx-view__filter-btn', { 'tx-view__filter-btn--active': activeFilterCount > 0 }]"
				@click="showFilters = !showFilters"
				:title="showFilters ? 'Скрыть фильтры' : 'Фильтры'">
				⊟<span
					v-if="activeFilterCount > 0"
					class="filter-badge"
					>{{ activeFilterCount }}</span
				>
			</button>
		</div>

		<!-- Filter panel -->
		<div
			v-if="showFilters"
			class="filter-panel">
			<div class="filter-row">
				<!-- Type -->
				<div class="filter-field">
					<label class="filter-field__label">Тип</label>
					<AppSelect
						v-model="filterType"
						:options="filterTypeOptions" />
				</div>
				<!-- Account -->
				<div class="filter-field">
					<label class="filter-field__label">Счёт</label>
					<AppSelect
						v-model="filterAccountId"
						:options="filterAccountOptions" />
				</div>
			</div>

			<div class="filter-row">
				<!-- Category -->
				<div class="filter-field">
					<label class="filter-field__label">Категория</label>
					<AppSelect
						v-model="filterCategoryId"
						:options="filterCategoryOptions" />
				</div>
			</div>

			<div class="filter-row">
				<!-- Date from -->
				<div class="filter-field">
					<label class="filter-field__label">С даты</label>
					<input
						type="date"
						v-model="filterFrom"
						class="filter-field__select" />
				</div>
				<!-- Date to -->
				<div class="filter-field">
					<label class="filter-field__label">По дату</label>
					<input
						type="date"
						v-model="filterTo"
						class="filter-field__select" />
				</div>
			</div>

			<button
				v-if="activeFilterCount > 0"
				class="filter-reset"
				@click="resetFilters">
				Сбросить фильтры
			</button>
		</div>

		<!-- Loading -->
		<div
			v-if="txStore.isLoading && grouped.length === 0"
			class="tx-view__loading">
			Загрузка…
		</div>

		<!-- Empty -->
		<div
			v-else-if="grouped.length === 0"
			class="tx-view__empty">
			{{ search ? "Ничего не найдено" : "Нет операций" }}
		</div>

		<!-- Grouped list -->
		<div
			v-else
			ref="txGroupsRef"
			class="tx-groups">
			<div
				v-for="group in grouped"
				:key="group.date"
				class="tx-group">
				<!-- Date header with day totals -->
				<div class="tx-group__header">
					<span class="tx-group__date">{{ group.label }}</span>
					<div class="tx-group__totals">
						<span
							v-if="dayTotal(group.transactions).income > 0"
							class="text-income">
							+{{ dayTotal(group.transactions).income.toLocaleString("ru-RU") }}
						</span>
						<span
							v-if="dayTotal(group.transactions).expense > 0"
							class="text-expense">
							-{{ dayTotal(group.transactions).expense.toLocaleString("ru-RU") }}
						</span>
					</div>
				</div>

				<!-- Transactions -->
				<div class="tx-list">
					<div
						v-for="tx in group.transactions"
						:key="tx.id"
						class="tx-row"
						@click="router.push(`/transactions/${tx.id}`)">
						<div
							class="tx-row__icon"
							:style="{
								background: (getCategory(tx.categoryId)?.color ?? '#6B7280') + '22',
								color: getCategory(tx.categoryId)?.color ?? '#6B7280'
							}">
							<AppIcon :name="getCategory(tx.categoryId)?.icon ?? (tx.type === 'transfer' ? 'transfer' : 'other')" />
						</div>
						<div class="tx-row__info">
							<div class="tx-row__name">{{ getCategory(tx.categoryId)?.name ?? "Перевод" }}</div>
							<div
								v-if="tx.comment"
								class="tx-row__comment">
								{{ tx.comment }}
							</div>
						</div>
						<div :class="['tx-row__amount', `text-${tx.type}`]">
							{{ formatAmount(tx) }}
						</div>
					</div>
				</div>
			</div>

			<!-- Load more -->
			<div
				v-if="hasMore"
				class="load-more">
				<AppButton
					variant="secondary"
					:loading="isLoadingMore"
					@click="loadMore">
					Загрузить ещё
				</AppButton>
			</div>
		</div>
	</div>
	<ScrollToTopButton :scroll-el="txGroupsRef" />
</template>

<style scoped>
.tx-view {
	display: flex;
	flex-direction: column;
	height: 100%;
}
.tx-view__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-5) var(--space-5) var(--space-3);
	flex-shrink: 0;
}
.tx-view__title {
	font-size: var(--font-xl);
	font-weight: 700;
}

.tx-view__search-wrap {
	padding: 0 var(--space-5) var(--space-3);
	flex-shrink: 0;
	display: flex;
	gap: var(--space-2);
}
.tx-view__search {
	flex: 1;
	height: 40px;
	border-radius: var(--radius-md);
	border: 1px solid var(--border);
	background: var(--bg-input);
	color: var(--text-primary);
	padding: 0 var(--space-3);
	font-size: var(--font-sm);
}
.tx-view__search:focus {
	outline: none;
	border-color: var(--border-focus);
}
.tx-view__filter-btn {
	position: relative;
	width: 40px;
	height: 40px;
	border-radius: var(--radius-md);
	border: 1px solid var(--border);
	background: var(--bg-input);
	color: var(--text-secondary);
	cursor: pointer;
	font-size: 18px;
	flex-shrink: 0;
	transition:
		background var(--transition),
		color var(--transition),
		border-color var(--transition);
}
.tx-view__filter-btn:hover {
	background: var(--bg-elevated);
	color: var(--text-primary);
}
.tx-view__filter-btn--active {
	border-color: var(--accent-primary);
	color: var(--accent-primary);
	background: var(--accent-primary-soft);
}
.filter-badge {
	position: absolute;
	top: -4px;
	right: -4px;
	width: 16px;
	height: 16px;
	border-radius: var(--radius-full);
	background: var(--accent-primary);
	color: #fff;
	font-size: 9px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 700;
}

.filter-panel {
	padding: 0 var(--space-5) var(--space-3);
	flex-shrink: 0;
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	border-bottom: 1px solid var(--border);
	margin-bottom: var(--space-2);
}
.filter-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--space-2);
}
.filter-field {
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.filter-field__label {
	font-size: var(--font-xs);
	color: var(--text-muted);
	font-weight: 500;
}
.filter-field__select {
	height: 36px;
	padding: 0 var(--space-2);
	border-radius: var(--radius-sm);
	border: 1px solid var(--border);
	background: var(--bg-input);
	color: var(--text-primary);
	font-size: var(--font-sm);
}
.filter-field__select:focus {
	outline: none;
	border-color: var(--border-focus);
}
.filter-reset {
	align-self: flex-start;
	background: none;
	border: none;
	padding: 0;
	color: var(--accent-primary);
	font-size: var(--font-xs);
	cursor: pointer;
	text-decoration: underline;
}

.tx-view__loading,
.tx-view__empty {
	text-align: center;
	color: var(--text-muted);
	padding: var(--space-12);
}

.tx-groups {
	flex: 1;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
	padding: 0 var(--space-5) var(--space-8);
}

.tx-group {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.tx-group__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-2) 0;
}
.tx-group__date {
	font-size: var(--font-sm);
	font-weight: 600;
	color: var(--text-secondary);
}
.tx-group__totals {
	display: flex;
	gap: var(--space-3);
	font-size: var(--font-sm);
	font-weight: 600;
}

.tx-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
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
.tx-row:first-child {
	border-radius: var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-sm);
}
.tx-row:last-child {
	border-radius: var(--radius-sm) var(--radius-sm) var(--radius-lg) var(--radius-lg);
}
.tx-row:only-child {
	border-radius: var(--radius-lg);
}

.tx-row__icon {
	width: 38px;
	height: 38px;
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
.tx-row__comment {
	font-size: var(--font-xs);
	color: var(--text-muted);
	truncate: true;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.tx-row__amount {
	font-size: var(--font-sm);
	font-weight: 600;
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}

.load-more {
	display: flex;
	justify-content: center;
	padding: var(--space-4) 0;
}
</style>
