<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppModal from "@/components/ui/AppModal.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppSelect from "@/components/ui/AppSelect.vue";
import { useBudgetsStore } from "@/stores/budgets.store";
import { useCategoriesStore } from "@/stores/categories.store";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useGamificationStore } from "@/stores/gamification.store";
import { notifyBudgetWarning } from "@/services/notifications.service";
import { wasBudgetAlertSent, markBudgetAlertSent } from "@/services/budgetAlerts.service";
import type { BudgetEntry } from "@/types";
import AppIcon from "@/components/ui/AppIcon.vue";
import { showConfirm } from "@/utils/confirm";

const budgetsStore = useBudgetsStore();
const categoriesStore = useCategoriesStore();
const txStore = useTransactionsStore();
const gamificationStore = useGamificationStore();

onMounted(async () => {
	await budgetsStore.load();
	await txStore.loadCurrentAndPrevMonth();
});

// Month navigation
const selectedMonth = ref(new Date().toLocaleDateString("en-CA").slice(0, 7));

function prevMonth() {
	const [y, m] = selectedMonth.value.split("-").map(Number);
	const d = new Date(y, m - 2);
	selectedMonth.value = d.toLocaleDateString("en-CA").slice(0, 7);
}
function nextMonth() {
	const now = new Date().toLocaleDateString("en-CA").slice(0, 7);
	const [y, m] = selectedMonth.value.split("-").map(Number);
	const next = new Date(y, m).toLocaleDateString("en-CA").slice(0, 7);
	if (next <= now) selectedMonth.value = next;
}
const isCurrentMonth = computed(() => selectedMonth.value === new Date().toLocaleDateString("en-CA").slice(0, 7));
function formatMonthLabel(ym: string): string {
	const [y, m] = ym.split("-").map(Number);
	return new Date(y, m - 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

const monthBudgets = computed(() => budgetsStore.getForMonth(selectedMonth.value));

function getSpent(budget: BudgetEntry): number {
	return txStore.allCached
		.filter((t) => t.categoryId === budget.categoryId && t.type === "expense" && t.date.startsWith(budget.month) && !t.isDeleted)
		.reduce((s, t) => s + t.amount, 0);
}

function getProgress(budget: BudgetEntry): number {
	const spent = getSpent(budget);
	return Math.min(100, Math.round((spent / budget.limitAmount) * 100));
}

function progressColor(pct: number): string {
	if (pct >= 100) return "var(--accent-danger)";
	if (pct >= 80) return "#F59E0B";
	return "#10B981";
}

// Categories that don't yet have a budget this month
const availableCategories = computed(() =>
	categoriesStore.categories.filter((c) => c.type === "expense" && !c.isArchived && !monthBudgets.value.some((b) => b.categoryId === c.id))
);

// Modal state
const showModal = ref(false);
const editingBudget = ref<BudgetEntry | null>(null);
const formCategoryId = ref("");
const formLimit = ref("");
const formCurrency = ref("RUB");
const isSubmitting = ref(false);
const errors = ref<Record<string, string>>({});

function openAdd() {
	editingBudget.value = null;
	formCategoryId.value = availableCategories.value[0]?.id ?? "";
	formLimit.value = "";
	formCurrency.value = "RUB";
	errors.value = {};
	showModal.value = true;
}

function openEdit(b: BudgetEntry) {
	editingBudget.value = b;
	formCategoryId.value = b.categoryId;
	formLimit.value = b.limitAmount.toString();
	formCurrency.value = b.currency;
	errors.value = {};
	showModal.value = true;
}

function validate(): boolean {
	errors.value = {};
	const parsed = parseFloat(formLimit.value.replace(",", "."));
	if (isNaN(parsed) || parsed <= 0) errors.value.limit = "Введите положительную сумму";
	if (!editingBudget.value && !formCategoryId.value) errors.value.category = "Выберите категорию";
	return Object.keys(errors.value).length === 0;
}

async function save() {
	if (!validate() || isSubmitting.value) return;
	isSubmitting.value = true;
	try {
		const limit = parseFloat(formLimit.value.replace(",", "."));
		if (editingBudget.value) {
			await budgetsStore.updateBudget(editingBudget.value.id, {
				limitAmount: limit,
				currency: formCurrency.value
			});
			// Check if budget was kept
			const spent = getSpent(editingBudget.value);
			if (spent <= limit && !isCurrentMonth.value) {
				gamificationStore.onBudgetKept();
			}
		} else {
			await budgetsStore.addBudget({
				month: selectedMonth.value,
				categoryId: formCategoryId.value,
				limitAmount: limit,
				currency: formCurrency.value,
				notifyAt: 80,
				notifyEnabled: true
			});
		}
		showModal.value = false;
	} finally {
		isSubmitting.value = false;
	}
}

async function deleteBudget(id: string) {
	if (!(await showConfirm("Удалить бюджет?"))) return;
	await budgetsStore.deleteBudget(id);
}

// Дедупликация алертов персистентна (localStorage) — не спамим при каждом запуске
function checkBudgetNotifications() {
	for (const budget of monthBudgets.value) {
		if (!budget.notifyEnabled) continue;
		const pct = getProgress(budget);
		const threshold = pct >= 100 ? 100 : pct >= 80 ? 80 : null;
		if (threshold === null || wasBudgetAlertSent(budget, threshold)) continue;
		markBudgetAlertSent(budget, threshold);
		const catName = categoriesStore.getById(budget.categoryId)?.name ?? "—";
		notifyBudgetWarning(budget, catName, pct);
	}
}

watch(monthBudgets, checkBudgetNotifications);

const CURRENCIES = ["RUB", "USD"];
const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }));
const categoryOptions = computed(() => availableCategories.value.map((cat) => ({ value: cat.id, label: cat.name })));

const totalBudgeted = computed(() => monthBudgets.value.reduce((s, b) => s + b.limitAmount, 0));
const totalSpent = computed(() => monthBudgets.value.reduce((s, b) => s + getSpent(b), 0));
</script>

<template>
	<div class="budgets-view">
		<!-- Header -->
		<div class="budgets-view__header">
			<h2 class="budgets-view__title tp-heading-md-bold">Бюджеты</h2>
			<AppButton
				size="sm"
				:disabled="availableCategories.length === 0"
				@click="openAdd">
				+ Добавить
			</AppButton>
		</div>

		<!-- Month nav -->
		<div class="month-nav">
			<button
				class="month-nav__btn"
				@click="prevMonth">
				‹
			</button>
			<span class="month-nav__label tp-title-md-semibold">{{ formatMonthLabel(selectedMonth) }}</span>
			<button
				class="month-nav__btn"
				:disabled="isCurrentMonth"
				@click="nextMonth">
				›
			</button>
		</div>

		<!-- Overview bar -->
		<div
			v-if="monthBudgets.length > 0"
			class="overview">
			<div class="overview__numbers tp-body-md-regular">
				<span
					>Потрачено <strong class="text-expense">{{ totalSpent.toLocaleString("ru-RU") }}</strong></span
				>
				<span
					>из <strong>{{ totalBudgeted.toLocaleString("ru-RU") }}</strong></span
				>
			</div>
			<div class="overview__bar-wrap">
				<div
					class="overview__bar"
					:style="{
						width: Math.min(100, Math.round((totalSpent / totalBudgeted) * 100)) + '%',
						background: progressColor(Math.round((totalSpent / totalBudgeted) * 100))
					}" />
			</div>
		</div>

		<!-- Budget list -->
		<div
			v-if="monthBudgets.length === 0"
			class="empty">
			<div class="empty__icon">📋</div>
			<div class="empty__text tp-body-lg-regular">Нет бюджетов на этот месяц</div>
			<AppButton
				size="sm"
				:disabled="availableCategories.length === 0"
				@click="openAdd">
				Создать первый бюджет
			</AppButton>
		</div>

		<div
			v-else
			class="budget-list">
			<div
				v-for="budget in monthBudgets"
				:key="budget.id"
				class="budget-card"
				@click="openEdit(budget)">
				<div class="budget-card__top">
					<div class="budget-card__cat">
						<div
							class="budget-card__cat-icon"
							:style="{
								background: (categoriesStore.getById(budget.categoryId)?.color ?? '#6B7280') + '22',
								color: categoriesStore.getById(budget.categoryId)?.color ?? '#6B7280'
							}">
							<AppIcon :name="categoriesStore.getById(budget.categoryId)?.icon ?? 'other'" />
						</div>
						<span class="budget-card__cat-name tp-label-md-semibold">
							{{ categoriesStore.getById(budget.categoryId)?.name ?? "—" }}
						</span>
					</div>
					<div class="budget-card__amounts">
						<span
							class="budget-card__spent tp-title-md-semibold"
							:style="{ color: progressColor(getProgress(budget)) }">
							{{ getSpent(budget).toLocaleString("ru-RU") }}
						</span>
						<span class="budget-card__limit tp-caption-md-regular"
							>/ {{ budget.limitAmount.toLocaleString("ru-RU") }} {{ budget.currency }}</span
						>
					</div>
				</div>

				<!-- Progress bar -->
				<div class="budget-card__bar-wrap">
					<div
						class="budget-card__bar"
						:style="{
							width: getProgress(budget) + '%',
							background: progressColor(getProgress(budget))
						}" />
				</div>

				<div class="budget-card__bottom tp-caption-md-regular">
					<span
						class="budget-card__pct"
						:style="{ color: progressColor(getProgress(budget)) }">
						{{ getProgress(budget) }}%
					</span>
					<span class="budget-card__remaining">
						<template v-if="getSpent(budget) < budget.limitAmount">
							Остаток: {{ (budget.limitAmount - getSpent(budget)).toLocaleString("ru-RU") }}
						</template>
						<template v-else> Превышен на {{ (getSpent(budget) - budget.limitAmount).toLocaleString("ru-RU") }} </template>
					</span>
					<button
						class="budget-card__delete"
						@click.stop="deleteBudget(budget.id)">
						✕
					</button>
				</div>
			</div>
		</div>

		<!-- Modal: add / edit budget -->
		<AppModal
			v-if="showModal"
			:title="editingBudget ? 'Изменить бюджет' : 'Новый бюджет'"
			@close="showModal = false">
			<div class="modal-form">
				<!-- Category selector (only for new) -->
				<div
					v-if="!editingBudget"
					class="field">
					<label class="field__label tp-label-md-medium">Категория</label>
					<AppSelect
						v-model="formCategoryId"
						:options="categoryOptions" />
					<span
						v-if="errors.category"
						class="field-error tp-caption-md-regular"
						>{{ errors.category }}</span
					>
				</div>

				<!-- Category display (edit mode) -->
				<div
					v-else
					class="budget-preview">
					<div
						class="budget-preview__icon"
						:style="{
							background: (categoriesStore.getById(editingBudget.categoryId)?.color ?? '#6B7280') + '22',
							color: categoriesStore.getById(editingBudget.categoryId)?.color ?? '#6B7280'
						}">
						<AppIcon :name="categoriesStore.getById(editingBudget.categoryId)?.icon ?? 'other'" />
					</div>
					<span class="budget-preview__name tp-label-md-semibold">
						{{ categoriesStore.getById(editingBudget.categoryId)?.name ?? "—" }}
					</span>
				</div>

				<!-- Limit amount -->
				<AppInput
					v-model="formLimit"
					label="Лимит"
					type="number"
					placeholder="10000"
					:error="errors.limit" />

				<!-- Currency -->
				<div class="field">
					<label class="field__label tp-label-md-medium">Валюта</label>
					<AppSelect
						v-model="formCurrency"
						:options="currencyOptions" />
				</div>
			</div>

			<template #footer>
				<AppButton
					variant="secondary"
					@click="showModal = false"
					>Отмена</AppButton
				>
				<AppButton
					:loading="isSubmitting"
					@click="save">
					{{ editingBudget ? "Сохранить" : "Создать" }}
				</AppButton>
			</template>
		</AppModal>
	</div>
</template>

<style scoped>
.budgets-view {
	display: flex;
	flex-direction: column;
}

.budgets-view__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-5) var(--space-5) var(--space-3);
}

.month-nav {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: 0 var(--space-5) var(--space-4);
	justify-content: center;
}
.month-nav__btn {
	width: 32px;
	height: 32px;
	border-radius: var(--radius-sm);
	background: var(--bg-elevated);
	border: none;
	color: var(--text-primary);
	cursor: pointer;
	font-size: 16px;
	transition: background var(--transition);
}
.month-nav__btn:hover:not(:disabled) {
	background: var(--border);
}
.month-nav__btn:disabled {
	opacity: 0.3;
	cursor: default;
}
.month-nav__label {
	min-width: 160px;
	text-align: center;
}

.overview {
	margin: 0 var(--space-5) var(--space-4);
	padding: var(--space-4);
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-xl);
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}
.overview__numbers {
	display: flex;
	justify-content: space-between;
}
.overview__bar-wrap {
	height: 8px;
	background: var(--bg-elevated);
	border-radius: var(--radius-full);
	overflow: hidden;
}
.overview__bar {
	height: 100%;
	border-radius: var(--radius-full);
	transition: width 0.5s ease;
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-4);
	padding: var(--space-12) var(--space-5);
}
.empty__icon {
	font-size: 48px;
}
.empty__text {
	color: var(--text-muted);
}

.budget-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: 0 var(--space-5) var(--space-8);
}

.budget-card {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	padding: var(--space-4);
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-xl);
	cursor: pointer;
	transition: background var(--transition);
}
.budget-card:hover {
	background: var(--bg-elevated);
}

.budget-card__top {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.budget-card__cat {
	display: flex;
	align-items: center;
	gap: var(--space-3);
}
.budget-card__cat-icon {
	width: 36px;
	height: 36px;
	border-radius: var(--radius-sm);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 16px;
	flex-shrink: 0;
}

.budget-card__amounts {
	text-align: right;
}
.budget-card__spent {
	font-variant-numeric: tabular-nums;
}
.budget-card__limit {
	color: var(--text-muted);
	display: block;
}

.budget-card__bar-wrap {
	height: 6px;
	background: var(--bg-elevated);
	border-radius: var(--radius-full);
	overflow: hidden;
}
.budget-card__bar {
	height: 100%;
	border-radius: var(--radius-full);
	transition: width 0.4s ease;
}

.budget-card__bottom {
	display: flex;
	align-items: center;
	gap: var(--space-3);
}
.budget-card__pct {
	font-weight: 700;
}
.budget-card__remaining {
	flex: 1;
	color: var(--text-muted);
}
.budget-card__delete {
	width: 24px;
	height: 24px;
	border-radius: var(--radius-xs);
	background: none;
	border: none;
	color: var(--text-muted);
	cursor: pointer;
	font-size: 11px;
}
.budget-card__delete:hover {
	color: var(--accent-danger);
	background: var(--accent-danger-soft);
}

.modal-form {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
}
.field {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
}
.field__label {
	color: var(--text-secondary);
}
.field__select {
	height: 44px;
	padding: 0 var(--space-3);
	border-radius: var(--radius-md);
	border: 1px solid var(--border);
	background: var(--bg-input);
	color: var(--text-primary);
}
.field__select:focus {
	outline: none;
	border-color: var(--border-focus);
}
.field-error {
	color: var(--accent-danger);
}

.budget-preview {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-3);
	background: var(--bg-elevated);
	border-radius: var(--radius-md);
}
.budget-preview__icon {
	width: 36px;
	height: 36px;
	border-radius: var(--radius-sm);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 16px;
}
</style>
