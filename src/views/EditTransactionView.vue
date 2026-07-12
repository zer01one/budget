<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppSelect from "@/components/ui/AppSelect.vue";
import AppDatePicker from "@/components/ui/AppDatePicker.vue";
import AppTimePicker from "@/components/ui/AppTimePicker.vue";
import AppIcon from "@/components/ui/AppIcon.vue";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useAccountsStore } from "@/stores/accounts.store";
import { useCategoriesStore } from "@/stores/categories.store";
import type { TransactionType } from "@/types";
import { PhCaretLeft } from "@phosphor-icons/vue";

const router = useRouter();
const route = useRoute();
const txStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();

const tx = computed(() => txStore.allCached.find((t) => t.id === route.params.id));

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

const editAccountOptions = computed(() => [
	{ value: "", label: "— выберите счёт —" },
	...accountsStore.activeAccounts.map((a) => ({ value: a.id, label: a.name })),
]);
const editToAccountOptions = computed(() => [
	{ value: "", label: "— выберите счёт —" },
	...accountsStore.activeAccounts
		.filter((a) => a.id !== editAccountId.value)
		.map((a) => ({ value: a.id, label: a.name })),
]);

const editCategories = computed(() => categoriesStore.byType(editType.value));

// Prefill once as soon as the transaction is available (months may still be
// loading when the page is opened directly by URL)
let prefilled = false;
watch(
	tx,
	(t) => {
		if (!t || prefilled) return;
		prefilled = true;
		editType.value = t.type;
		editAmount.value = t.amount.toString();
		editDate.value = t.date;
		editTime.value = t.time;
		editAccountId.value = t.accountId;
		editToAccountId.value = t.toAccountId ?? "";
		editCategoryId.value = t.categoryId ?? "";
		editComment.value = t.comment;
	},
	{ immediate: true }
);

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
		router.back();
	} finally {
		isSubmitting.value = false;
	}
}
</script>

<template>
	<div class="edit-tx">
		<div class="edit-tx__header">
			<button
				class="edit-tx__back tp-body-lg-regular"
				@click="router.back()">
				<PhCaretLeft :size="18" />
				Отмена
			</button>
			<span class="edit-tx__title tp-body-md-regular">Редактирование</span>
		</div>

		<div
			v-if="!tx"
			class="edit-tx__not-found">
			Операция не найдена
		</div>

		<div
			v-else
			class="add-tx__form">
			<!-- Type tabs -->
			<div class="type-tabs">
				<button
					v-for="t in ['expense', 'income', 'transfer'] as TransactionType[]"
					:key="t"
					:class="['type-tab tp-label-md-medium', { 'type-tab--active': editType === t }]"
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
					class="amount-field__input tp-display-lg-bold"
					placeholder="0"
					min="0"
					step="any" />
				<span class="amount-field__currency tp-heading-md-semibold">
					{{ accountsStore.getById(editAccountId)?.currency ?? tx?.currency ?? "RUB" }}
				</span>
			</div>
			<span
				v-if="errors.amount"
				class="field-error tp-caption-md-regular"
				>{{ errors.amount }}</span
			>

			<!-- Account -->
			<div class="field">
				<label class="field__label tp-label-md-medium">Счёт</label>
				<AppSelect
					v-model="editAccountId"
					:options="editAccountOptions" />
				<span
					v-if="errors.account"
					class="field-error tp-caption-md-regular"
					>{{ errors.account }}</span
				>
			</div>

			<!-- To account (transfer) -->
			<div
				v-if="editType === 'transfer'"
				class="field">
				<label class="field__label tp-label-md-medium">Счёт назначения</label>
				<AppSelect
					v-model="editToAccountId"
					:options="editToAccountOptions" />
				<span
					v-if="errors.toAccount"
					class="field-error tp-caption-md-regular"
					>{{ errors.toAccount }}</span
				>
			</div>

			<!-- Category -->
			<div
				v-if="editType !== 'transfer'"
				class="field">
				<label class="field__label tp-label-md-medium">Категория</label>
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
					class="field-error tp-caption-md-regular"
					>{{ errors.category }}</span
				>
			</div>

			<!-- Date + Time -->
			<div class="row-2">
				<div class="field">
					<label class="field__label tp-label-md-medium">Дата</label>
					<AppDatePicker v-model="editDate" />
				</div>
				<div class="field">
					<label class="field__label tp-label-md-medium">Время</label>
					<AppTimePicker v-model="editTime" />
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
				@click="router.back()"
				>Отмена</AppButton
			>
		</div>
	</div>
</template>

<style scoped>
.edit-tx {
	display: flex;
	flex-direction: column;
	max-width: 540px;
	margin: 0 auto;
}
.edit-tx__header {
	display: flex;
	align-items: center;
	padding: var(--space-5) var(--space-5) var(--space-3);
}
.edit-tx__back {
	display: inline-flex;
	align-items: center;
	gap: var(--space-1);
	background: none;
	border: none;
	color: var(--accent-primary);
	cursor: pointer;
}
.edit-tx__title {
	flex: 1;
	text-align: center;
	color: var(--text-secondary);
	/* visually centered against the back button */
	padding-right: 72px;
}
.edit-tx__not-found {
	text-align: center;
	color: var(--text-muted);
	padding: var(--space-12);
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
	color: var(--text-secondary);
}

.field {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
}
.field__label {
	color: var(--text-secondary);
}

.row-2 {
	display: grid;
	/* minmax(0, …) drops the auto min-content floor so both columns stay equal */
	grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
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
	color: var(--accent-danger);
}
</style>
