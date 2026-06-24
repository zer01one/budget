<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useAccountsStore } from "@/stores/accounts.store";
import { useCategoriesStore } from "@/stores/categories.store";
import { useGamificationStore } from "@/stores/gamification.store";
import type { TransactionType } from "@/types";
import AppIcon from "@/components/ui/AppIcon.vue";

const router = useRouter();
const txStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const gamificationStore = useGamificationStore();

const type = ref<TransactionType>("expense");
const amount = ref("");
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
			currency: accountsStore.getById(accountId.value)?.currency ?? "KZT",
			date: date.value,
			time: time.value,
			accountId: accountId.value,
			toAccountId: type.value === "transfer" ? toAccountId.value : null,
			categoryId: type.value !== "transfer" ? categoryId.value || null : null,
			comment: comment.value.trim(),
			tags: [],
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
</script>

<template>
	<div class="add-tx">
		<div class="add-tx__header">
			<button
				class="add-tx__back"
				@click="router.back()">
				← Назад
			</button>
			<h2 class="add-tx__title">Новая операция</h2>
		</div>

		<!-- Type tabs -->
		<div class="type-tabs">
			<button
				v-for="t in ['expense', 'income', 'transfer'] as TransactionType[]"
				:key="t"
				:class="['type-tab', { 'type-tab--active': type === t }]"
				@click="
					type = t;
					categoryId = '';
				">
				{{ t === "expense" ? "Расход" : t === "income" ? "Доход" : "Перевод" }}
			</button>
		</div>

		<div class="add-tx__form">
			<!-- Amount -->
			<div class="amount-field">
				<input
					:value="amount"
					@input="onAmountInput"
					type="text"
					inputmode="decimal"
					placeholder="0" 
					class="amount-field__input"/>
				<span class="amount-field__currency">
					{{ accountsStore.getById(accountId)?.currency ?? "KZT" }}
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
					v-model="accountId"
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

			<!-- To account (transfer only) -->
			<div
				v-if="type === 'transfer'"
				class="field">
				<label class="field__label">Счёт назначения</label>
				<select
					v-model="toAccountId"
					class="field__select">
					<option value="">— выберите счёт —</option>
					<option
						v-for="acc in accountsStore.activeAccounts.filter((a) => a.id !== accountId)"
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
				v-if="type !== 'transfer'"
				class="field">
				<label class="field__label">Категория</label>
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
						v-model="date"
						class="field__select" />
				</div>
				<div class="field">
					<label class="field__label">Время</label>
					<input
						type="time"
						v-model="time"
						class="field__select" />
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
					<label class="field__label">Повторять</label>
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
						:class="['rule-tab', { 'rule-tab--active': recurringRule === rule }]"
						@click="recurringRule = rule">
						{{ rule === "daily" ? "Каждый день" : rule === "weekly" ? "Каждую неделю" : "Каждый месяц" }}
					</button>
				</div>
			</div>

			<AppButton
				full-width
				size="lg"
				:loading="isSubmitting"
				@click="submit">
				Сохранить
			</AppButton>
		</div>
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
	font-size: var(--font-md);
}
.add-tx__title {
	font-size: var(--font-xl);
	font-weight: 700;
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

.add-tx__form {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
	padding: var(--space-3) var(--space-5) var(--space-8);
	overflow-y: auto;
}

.amount-field {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-2);
	padding: var(--space-6) 0;
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
	color: var(--cat-color, var(--text-primary));
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
	font-size: var(--font-xs);
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
