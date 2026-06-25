<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useAccountsStore } from "@/stores/accounts.store";
import { useCategoriesStore } from "@/stores/categories.store";
import type { TransactionType } from "@/types";
import AppIcon from "@/components/ui/AppIcon.vue";
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

// Edit mode state
const isEditing = ref(false);
const isSubmitting = ref(false);
const errors = ref<Record<string, string>>({});

const editType = ref<TransactionType>("expense");
const editAmount = ref("");
const editDate = ref("");
const editTime = ref("");
const editAccountId = ref("");
const editToAccountId = ref("");
const editCategoryId = ref("");
const editComment = ref("");

const editCategories = computed(() => categoriesStore.byType(editType.value));

function startEdit() {
	if (!tx.value) return;
	editType.value = tx.value.type;
	editAmount.value = tx.value.amount.toString();
	editDate.value = tx.value.date;
	editTime.value = tx.value.time;
	editAccountId.value = tx.value.accountId;
	editToAccountId.value = tx.value.toAccountId ?? "";
	editCategoryId.value = tx.value.categoryId ?? "";
	editComment.value = tx.value.comment;
	errors.value = {};
	isEditing.value = true;
}

watch(
	() => editType.value,
	() => {
		editCategoryId.value = "";
	}
);

function validate(): boolean {
	errors.value = {};
	const parsed = parseFloat(String(editAmount.value).replace(",", "."));
	if (isNaN(parsed) || parsed <= 0) errors.value.amount = "Введите положительную сумму";
	if (!editAccountId.value) errors.value.account = "Выберите счёт";
	if (editType.value === "transfer" && !editToAccountId.value) errors.value.toAccount = "Выберите счёт назначения";
	if (editType.value !== "transfer" && !editCategoryId.value) errors.value.category = "Выберите категорию";
	return Object.keys(errors.value).length === 0;
}

async function saveEdit() {
	if (!tx.value || !validate() || isSubmitting.value) return;
	isSubmitting.value = true;
	try {
		await txStore.updateTransaction(tx.value.id, {
			type: editType.value,
			amount: parseFloat(String(editAmount.value).replace(",", ".")),
			currency: accountsStore.getById(editAccountId.value)?.currency ?? tx.value.currency,
			date: editDate.value,
			time: editTime.value,
			accountId: editAccountId.value,
			toAccountId: editType.value === "transfer" ? editToAccountId.value : null,
			categoryId: editType.value !== "transfer" ? editCategoryId.value || null : null,
			comment: editComment.value.trim()
		});
		isEditing.value = false;
	} finally {
		isSubmitting.value = false;
	}
}

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
				class="detail-view__back"
				@click="isEditing ? (isEditing = false) : router.back()">
				← {{ isEditing ? "Отмена" : "Назад" }}
			</button>
			<span class="detail-view__mode">{{ isEditing ? "Редактирование" : "" }}</span>
			<button
				v-if="!isEditing && tx"
				class="detail-view__edit-btn"
				@click="startEdit">
				Изменить
			</button>
		</div>

		<div
			v-if="!tx"
			class="detail-view__not-found">
			Операция не найдена
		</div>

		<!-- VIEW MODE -->
		<div
			v-else-if="!isEditing"
			class="detail-view__content">
			<div
				class="detail-amount"
				:class="`text-${tx.type}`">
				{{ tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "↔" }}{{ tx.amount.toLocaleString("ru-RU") }}
				{{ tx.currency }}
			</div>

			<div class="detail-rows">
				<div class="detail-row">
					<span class="detail-row__label">Тип</span>
					<span>{{ tx.type === "expense" ? "Расход" : tx.type === "income" ? "Доход" : "Перевод" }}</span>
				</div>
				<div
					v-if="category"
					class="detail-row">
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
					class="detail-row">
					<span class="detail-row__label">Куда</span>
					<span>{{ toAccount.name }}</span>
				</div>
				<div class="detail-row">
					<span class="detail-row__label">Дата</span>
					<span>{{ formatDateLabel(tx.date) }}, {{ tx.time }}</span>
				</div>
				<div
					v-if="tx.comment"
					class="detail-row">
					<span class="detail-row__label">Комментарий</span>
					<span>{{ tx.comment }}</span>
				</div>
			</div>

			<AppButton
				variant="danger"
				full-width
				@click="deleteTx"
				>Удалить операцию</AppButton
			>
		</div>

		<!-- EDIT MODE -->
		<div
			v-else
			class="add-tx__form">
			<!-- Type tabs -->
			<div class="type-tabs">
				<button
					v-for="t in ['expense', 'income', 'transfer'] as TransactionType[]"
					:key="t"
					:class="['type-tab', { 'type-tab--active': editType === t }]"
					@click="editType = t">
					{{ t === "expense" ? "Расход" : t === "income" ? "Доход" : "Перевод" }}
				</button>
			</div>

			<!-- Amount -->
			<div class="amount-field">
				<input
					v-model="editAmount"
					type="number"
					inputmode="decimal"
					class="amount-field__input"
					placeholder="0"
					min="0"
					step="any" />
				<span class="amount-field__currency">
					{{ accountsStore.getById(editAccountId)?.currency ?? tx?.currency ?? "RUB" }}
				</span>
			</div>
			<span
				v-if="errors.amount"
				class="field-error"
				>{{ errors.amount }}</span
			>

			<!-- Account -->
			<div class="field">
				<label class="field__label">Счёт</label>
				<select
					v-model="editAccountId"
					class="field__select">
					<option value="">— выберите счёт —</option>
					<option
						v-for="acc in accountsStore.activeAccounts"
						:key="acc.id"
						:value="acc.id">
						{{ acc.name }}
					</option>
				</select>
				<span
					v-if="errors.account"
					class="field-error"
					>{{ errors.account }}</span
				>
			</div>

			<!-- To account (transfer) -->
			<div
				v-if="editType === 'transfer'"
				class="field">
				<label class="field__label">Счёт назначения</label>
				<select
					v-model="editToAccountId"
					class="field__select">
					<option value="">— выберите счёт —</option>
					<option
						v-for="acc in accountsStore.activeAccounts.filter((a) => a.id !== editAccountId)"
						:key="acc.id"
						:value="acc.id">
						{{ acc.name }}
					</option>
				</select>
				<span
					v-if="errors.toAccount"
					class="field-error"
					>{{ errors.toAccount }}</span
				>
			</div>

			<!-- Category -->
			<div
				v-if="editType !== 'transfer'"
				class="field">
				<label class="field__label">Категория</label>
				<div class="cat-grid">
					<button
						v-for="cat in editCategories"
						:key="cat.id"
						:class="['cat-item', { 'cat-item--active': editCategoryId === cat.id }]"
						:style="{ '--cat-color': cat.color }"
						@click="editCategoryId = cat.id">
						<span class="cat-item__icon"><AppIcon :name="cat.icon" /></span>
						<span class="cat-item__name">{{ cat.name }}</span>
					</button>
				</div>
				<span
					v-if="errors.category"
					class="field-error"
					>{{ errors.category }}</span
				>
			</div>

			<!-- Date + Time -->
			<div class="row-2">
				<div class="field">
					<label class="field__label">Дата</label>
					<input
						type="date"
						v-model="editDate"
						class="field__select" />
				</div>
				<div class="field">
					<label class="field__label">Время</label>
					<input
						type="time"
						v-model="editTime"
						class="field__select" />
				</div>
			</div>

			<!-- Comment -->
			<AppInput
				v-model="editComment"
				label="Комментарий"
				placeholder="Необязательно" />

			<AppButton
				full-width
				size="lg"
				:loading="isSubmitting"
				@click="saveEdit">
				Сохранить изменения
			</AppButton>

			<AppButton
				variant="ghost"
				full-width
				@click="isEditing = false"
				>Отмена</AppButton
			>
		</div>
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
	background: none;
	border: none;
	color: var(--accent-primary);
	cursor: pointer;
	font-size: var(--font-md);
}
.detail-view__mode {
	flex: 1;
	text-align: center;
	font-size: var(--font-sm);
	color: var(--text-secondary);
}
.detail-view__edit-btn {
	background: none;
	border: none;
	color: var(--accent-primary);
	cursor: pointer;
	font-size: var(--font-sm);
	font-weight: 500;
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
	font-size: var(--font-3xl);
	font-weight: 700;
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
	font-size: var(--font-sm);
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

/* Edit form — same as AddTransactionView styles */
.add-tx__form {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
	padding: 0 var(--space-5) var(--space-8);
	overflow-y: auto;
}

.type-tabs {
	display: flex;
	gap: var(--space-2);
}
.type-tab {
	flex: 1;
	height: 36px;
	border-radius: var(--radius-md);
	background: var(--bg-elevated);
	border: none;
	color: var(--text-secondary);
	font-size: var(--font-sm);
	font-weight: 500;
	cursor: pointer;
	transition:
		background var(--transition),
		color var(--transition);
}
.type-tab--active {
	background: var(--accent-primary);
	color: #fff;
}

.amount-field {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-2);
	padding: var(--space-4) 0;
}
.amount-field__input {
	font-size: 48px;
	font-weight: 700;
	background: none;
	border: none;
	color: var(--text-primary);
	text-align: right;
	width: 200px;
}
.amount-field__input:focus {
	outline: none;
}
.amount-field__currency {
	font-size: var(--font-xl);
	color: var(--text-secondary);
}

.field {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
}
.field__label {
	font-size: var(--font-sm);
	color: var(--text-secondary);
	font-weight: 500;
}
.field__select {
	height: 44px;
	padding: 0 var(--space-3);
	border-radius: var(--radius-md);
	border: 1px solid var(--border);
	background: var(--bg-input);
	color: var(--text-primary);
	font-size: var(--font-md);
}
.field__select:focus {
	outline: none;
	border-color: var(--border-focus);
}

.row-2 {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--space-3);
}

.cat-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
	gap: var(--space-2);
}
.cat-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-1);
	padding: var(--space-3) var(--space-2);
	border-radius: var(--radius-md);
	background: var(--bg-elevated);
	border: 2px solid transparent;
	cursor: pointer;
	transition:
		border-color var(--transition),
		background var(--transition);
	min-height: 68px;
}
.cat-item--active {
	border-color: var(--cat-color, var(--accent-primary));
	background: var(--accent-primary-soft);
}
.cat-item__icon {
	font-size: 20px;
}
.cat-item__name {
	font-size: 10px;
	color: var(--text-secondary);
	text-align: center;
	line-height: 1.2;
}

.field-error {
	font-size: var(--font-xs);
	color: var(--accent-danger);
}
</style>
