<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppSelect from "@/components/ui/AppSelect.vue";
import AppDatePicker from "@/components/ui/AppDatePicker.vue";
import AppTimePicker from "@/components/ui/AppTimePicker.vue";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useAccountsStore } from "@/stores/accounts.store";
import { useCategoriesStore } from "@/stores/categories.store";
import { useGamificationStore } from "@/stores/gamification.store";
import type { TransactionType } from "@/types";
import AppIcon from "@/components/ui/AppIcon.vue";
import ScanReceiptModal from "@/components/ScanReceiptModal.vue";
import { isScannerAvailable } from "@/services/qrScanner.service";
import { receiptComment, type ParsedReceipt } from "@/utils/receiptQr";

const router = useRouter();
const txStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const gamificationStore = useGamificationStore();

const receiptTag = ref<string | null>(null);
const showScanModal = ref(false);

const type = ref<TransactionType>("expense");
const amount = ref("");

const accountOptions = computed(() => [
	{ value: "", label: "— выберите счёт —" },
	...accountsStore.activeAccounts.map((a) => ({ value: a.id, label: a.name })),
]);
const toAccountOptions = computed(() => [
	{ value: "", label: "— выберите счёт —" },
	...accountsStore.activeAccounts
		.filter((a) => a.id !== accountId.value)
		.map((a) => ({ value: a.id, label: a.name })),
]);
const date = ref(new Date().toLocaleDateString("en-CA"));
const time = ref(new Date().toTimeString().slice(0, 5));
const accountId = ref(accountsStore.activeAccounts[0]?.id ?? "");
const toAccountId = ref("");
const categoryId = ref("");
const comment = ref("");
const isRecurring = ref(false);
const recurringRule = ref<"daily" | "weekly" | "monthly">("monthly");
const isSubmitting = ref(false);
const errors = ref<Record<string, string>>({});

const categories = computed(() => categoriesStore.byType(type.value));

async function onAmountInput(event: Event) {
	let val = (event.target as HTMLInputElement).value;
	amount.value = val;
	await nextTick();

	val = val.replace(/[^\d.,]/g, "");
	val = val.replace(/^0+(?=[.,]|$)/, "0");
	val = val.replace(/^0(?=[1-9])/, "");
	val = val.replace(",", ".");
	let [main, decimal] = val.split(".");

	if (decimal) {
		const cents = decimal.replace(/\D/g, "").slice(0, 2);
		val = `${main}.${cents}`;
	}

	amount.value = val;
}

function validate(): boolean {
	errors.value = {};
	const parsed = parseFloat(amount.value || "0");
	if (isNaN(parsed) || parsed <= 0) errors.value.amount = "Введите положительную сумму";
	if (!accountId.value) errors.value.account = "Выберите счёт";
	if (type.value === "transfer" && !toAccountId.value) errors.value.toAccount = "Выберите счёт назначения";
	if (type.value !== "transfer" && !categoryId.value) errors.value.category = "Выберите категорию";
	return Object.keys(errors.value).length === 0;
}

async function submit() {
	if (!validate() || isSubmitting.value) return;
	isSubmitting.value = true;
	try {
		const tx = await txStore.addTransaction({
			type: type.value,
			amount: parseFloat(amount.value),
			currency: accountsStore.getById(accountId.value)?.currency ?? "RUB",
			date: date.value,
			time: time.value,
			accountId: accountId.value,
			toAccountId: type.value === "transfer" ? toAccountId.value : null,
			categoryId: type.value !== "transfer" ? categoryId.value || null : null,
			comment: comment.value.trim(),
			tags: receiptTag.value ? [receiptTag.value] : [],
			isRecurring: isRecurring.value,
			recurringRule: isRecurring.value ? recurringRule.value : undefined,
			recurringParentId: null
		});
		gamificationStore.onTransactionAdded(tx);
		router.back();
	} finally {
		isSubmitting.value = false;
	}
}

function onScanApply(parsed: ParsedReceipt, fingerprint: string) {
	if (parsed.type !== type.value) categoryId.value = "";
	type.value = parsed.type;
	amount.value = String(parsed.amount);
	date.value = parsed.date;
	time.value = parsed.time;
	comment.value = receiptComment(parsed);
	receiptTag.value = fingerprint;
	showScanModal.value = false;
}
</script>

<template>
	<div class="add-tx">
		<div class="add-tx__header">
			<button
				class="add-tx__back tp-body-lg-regular"
				@click="router.back()">
				← Назад
			</button>
			<h2 class="add-tx__title tp-heading-md-bold">Новая операция</h2>
		</div>

		<!-- Type tabs -->
		<div class="type-tabs">
			<button
				v-for="t in ['expense', 'income', 'transfer'] as TransactionType[]"
				:key="t"
				:class="['type-tab tp-label-md-medium', { 'type-tab--active': type === t }]"
				@click="
					type = t;
					categoryId = '';
				">
				{{ t === "expense" ? "Расход" : t === "income" ? "Доход" : "Перевод" }}
			</button>
		</div>

		<div class="add-tx__form">
			<!-- Scan receipt -->
			<button
				v-if="isScannerAvailable()"
				class="add-tx__scan-btn tp-label-md-medium"
				@click="showScanModal = true">
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round">
					<rect x="3" y="3" width="7" height="7" rx="1" />
					<rect x="14" y="3" width="7" height="7" rx="1" />
					<rect x="3" y="14" width="7" height="7" rx="1" />
					<path d="M14 14h3v3h-3z" />
					<path d="M21 14v3" />
					<path d="M14 21h3" />
				</svg>
				Сканировать чек
			</button>

			<!-- Amount -->
			<div class="amount-field">
				<input
					:value="amount"
					@input="onAmountInput"
					type="text"
					inputmode="decimal"
					placeholder="0" 
					class="amount-field__input tp-display-lg-bold"/>
				<span class="amount-field__currency tp-heading-md-semibold">
					{{ accountsStore.getById(accountId)?.currency ?? "RUB" }}
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
					v-model="accountId"
					:options="accountOptions" />
				<span
					v-if="errors.account"
					class="field-error tp-caption-md-regular"
					>{{ errors.account }}</span
				>
			</div>

			<!-- To account (transfer only) -->
			<div
				v-if="type === 'transfer'"
				class="field">
				<label class="field__label tp-label-md-medium">Счёт назначения</label>
				<AppSelect
					v-model="toAccountId"
					:options="toAccountOptions" />
				<span
					v-if="errors.toAccount"
					class="field-error tp-caption-md-regular"
					>{{ errors.toAccount }}</span
				>
			</div>

			<!-- Category -->
			<div
				v-if="type !== 'transfer'"
				class="field">
				<label class="field__label tp-label-md-medium">Категория</label>
				<div class="cat-grid">
					<button
						v-for="cat in categories"
						:key="cat.id"
						:class="['cat-item', { 'cat-item--active': categoryId === cat.id }]"
						:style="{ '--cat-color': cat.color }"
						@click="categoryId = cat.id">
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
					<AppDatePicker v-model="date" />
				</div>
				<div class="field">
					<label class="field__label tp-label-md-medium">Время</label>
					<AppTimePicker v-model="time" />
				</div>
			</div>

			<!-- Comment -->
			<AppInput
				v-model="comment"
				label="Комментарий"
				placeholder="Необязательно" />

			<!-- Recurring -->
			<div
				v-if="type !== 'transfer'"
				class="field">
				<div class="recurring-row">
					<label class="field__label tp-label-md-medium">Повторять</label>
					<button
						:class="['toggle', { 'toggle--on': isRecurring }]"
						@click="isRecurring = !isRecurring">
						<span class="toggle__thumb" />
					</button>
				</div>
				<div
					v-if="isRecurring"
					class="rule-tabs">
					<button
						v-for="rule in ['daily', 'weekly', 'monthly'] as const"
						:key="rule"
						:class="['rule-tab tp-caption-md-regular', { 'rule-tab--active': recurringRule === rule }]"
						@click="recurringRule = rule">
						{{ rule === "daily" ? "Каждый день" : rule === "weekly" ? "Каждую неделю" : "Каждый месяц" }}
					</button>
				</div>
			</div>

			<AppButton
				class="add-tx__save"
				size="lg"
				:loading="isSubmitting"
				@click="submit">
				Сохранить
			</AppButton>
		</div>

		<ScanReceiptModal
			v-if="showScanModal"
			@close="showScanModal = false"
			@apply="onScanApply" />
	</div>
</template>

<style scoped>
.add-tx {
	display: flex;
	flex-direction: column;
	max-width: 540px;
	margin: 0 auto;
}
.add-tx__header {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-5) var(--space-5) var(--space-3);
}
.add-tx__back {
	background: none;
	border: none;
	color: var(--accent-primary);
	cursor: pointer;
}

.type-tabs {
	display: flex;
	gap: var(--space-2);
	padding: var(--space-3) var(--space-5);
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

.add-tx__form {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
	padding: var(--space-3) var(--space-5) var(--space-8);
	overflow-y: auto;
}

.add-tx__scan-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-2);
	height: 44px;
	border-radius: var(--radius-md);
	background: var(--accent-primary-soft);
	border: 1px solid var(--accent-primary);
	color: var(--accent-primary);
	cursor: pointer;
	transition:
		background var(--transition),
		color var(--transition);
}
.add-tx__scan-btn:hover {
	background: var(--accent-primary);
	color: #fff;
}

.add-tx__save {
	width: 100%;
}

@media (max-width: 899px) {
	.add-tx__form {
		padding-bottom: calc(52px + var(--space-8) + var(--space-4));
	}
	.add-tx__save {
		position: fixed;
		bottom: calc(var(--nav-height) + var(--space-4) + env(safe-area-inset-bottom, 0px));
		left: var(--space-4);
		right: var(--space-4);
		width: auto;
		z-index: 10;
	}
}

.amount-field {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-2);
	padding: var(--space-6) 0;
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
	color: var(--cat-color, var(--text-primary));
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

.recurring-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.toggle {
	width: 44px;
	height: 24px;
	border-radius: 12px;
	background: var(--bg-elevated);
	border: 1px solid var(--border);
	cursor: pointer;
	position: relative;
	transition: background var(--transition);
	flex-shrink: 0;
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

.rule-tabs {
	display: flex;
	gap: var(--space-2);
	margin-top: var(--space-2);
}
.rule-tab {
	flex: 1;
	height: 32px;
	border-radius: var(--radius-md);
	background: var(--bg-elevated);
	border: none;
	color: var(--text-secondary);
	cursor: pointer;
	transition:
		background var(--transition),
		color var(--transition);
}
.rule-tab--active {
	background: var(--accent-primary-soft);
	color: var(--accent-primary);
	font-weight: 600;
}
</style>
