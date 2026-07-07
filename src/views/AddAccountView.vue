<script setup lang="ts">
import { ref, nextTick } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import AppInput from "@/components/ui/AppInput.vue";
import AppSelect from "@/components/ui/AppSelect.vue";
import ColorPicker from "@/components/ui/ColorPicker.vue";
import IconPicker from "@/components/ui/IconPicker.vue";
import { useAccountsStore } from "@/stores/accounts.store";
import AppIcon from "@/components/ui/AppIcon.vue";
import { PhCaretLeft } from "@phosphor-icons/vue";
import type { AccountType } from "@/types";

const ACCOUNT_ICONS = [
	"wallet",
	"bank",
	"card",
	"cash",
	"piggy",
	"coins",
	"savings",
	"invest",
	"crypto",
	"dollar",
	"euro",
	"star",
	"home",
	"salary",
	"freelance",
	"gift"
];

const router = useRouter();
const accountsStore = useAccountsStore();

const name = ref("");
const type = ref<AccountType>("card");
const currency = ref("RUB");
const initialBalance = ref("");
const color = ref("#3B82F6");
const icon = ref("card");
const notes = ref("");
const isSubmitting = ref(false);
const errors = ref<Record<string, string>>({});

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
	{ value: "card", label: "Банковская карта" },
	{ value: "cash", label: "Наличные" },
	{ value: "bank", label: "Банковский счёт" },
	{ value: "savings", label: "Накопления" },
	{ value: "investment", label: "Инвестиции" },
	{ value: "crypto", label: "Криптовалюта" }
];

const CURRENCIES = ["RUB", "USD"];
const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }));

async function onBalanceInput(val: string) {
	initialBalance.value = val;
	await nextTick();
	val = val.replace(/[^\d.,]/g, "");
	val = val.replace(/^0+(?=[.,]|$)/, "0");
	val = val.replace(/^0(?=[1-9])/, "");
	val = val.replace(",", ".");
	const [integer, decimal] = val.split(".");
	if (decimal !== undefined) {
		const cents = decimal.replace(/\D/g, "").slice(0, 2);
		val = `${integer}.${cents}`;
	}
	initialBalance.value = val;
}

function validate(): boolean {
	errors.value = {};
	if (!name.value.trim()) errors.value.name = "Введите название счёта";
	const bal = parseFloat(initialBalance.value || "0");
	if (isNaN(bal)) errors.value.balance = "Введите число";
	return Object.keys(errors.value).length === 0;
}

async function submit() {
	if (!validate() || isSubmitting.value) return;
	isSubmitting.value = true;
	try {
		await accountsStore.addAccount({
			name: name.value.trim(),
			type: type.value,
			currency: currency.value,
			initialBalance: parseFloat(initialBalance.value.replace(",", ".")) || 0,
			color: color.value,
			icon: icon.value,
			isArchived: false,
			sortOrder: accountsStore.accounts.length,
			notes: notes.value.trim()
		});
		router.back();
	} finally {
		isSubmitting.value = false;
	}
}
</script>

<template>
	<div class="add-account">
		<div class="add-account__header">
			<button
				class="back-btn tp-body-lg-regular"
				@click="router.back()">
				<PhCaretLeft :size="18" />
				Назад
			</button>
			<h2 class="tp-heading-md-bold">Новый счёт</h2>
		</div>

		<!-- Preview -->
		<div
			class="preview-card"
			:style="{ '--acc-color': color }">
			<div class="preview-card__icon">
				<AppIcon
					:name="icon"
					:size="22" />
			</div>
			<div class="preview-card__info">
				<div class="preview-card__name">{{ name || "Название счёта" }}</div>
				<div class="preview-card__meta tp-caption-md-regular">{{ currency }} · {{ type }}</div>
			</div>
			<div class="preview-card__balance">{{ initialBalance || "0" }}</div>
		</div>

		<div class="add-account__form">
			<AppInput
				v-model="name"
				label="Название"
				placeholder="Основная карта"
				:error="errors.name" />

			<div class="field">
				<label class="field__label tp-label-md-medium">Тип счёта</label>
				<AppSelect
					v-model="type"
					:options="ACCOUNT_TYPES" />
			</div>

			<div class="row-2">
				<div class="field">
					<label class="field__label tp-label-md-medium">Валюта</label>
					<AppSelect
						v-model="currency"
						:options="currencyOptions" />
				</div>
				<AppInput
					:model-value="initialBalance"
					@update:model-value="onBalanceInput"
					label="Начальный баланс"
					type="text"
					inputmode="decimal"
					placeholder="0"
					:error="errors.balance" />
			</div>

			<ColorPicker
				v-model="color"
				label="Цвет" />
			<IconPicker
				v-model="icon"
				label="Иконка"
				:icons="ACCOUNT_ICONS" />
			<AppInput
				v-model="notes"
				label="Заметка"
				placeholder="Необязательно" />

			<AppButton
				full-width
				size="lg"
				:loading="isSubmitting"
				@click="submit">
				Создать счёт
			</AppButton>
		</div>
	</div>
</template>

<style scoped>
.add-account {
	display: flex;
	flex-direction: column;
	max-width: 540px;
	margin: 0 auto;
}
.add-account__header {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-5) var(--space-5) var(--space-3);
}
.back-btn {
	display: inline-flex;
	align-items: center;
	gap: var(--space-1);
	background: none;
	border: none;
	color: var(--accent-primary);
	cursor: pointer;
}

.preview-card {
	margin: 0 var(--space-5) var(--space-4);
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-4);
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-left: 4px solid var(--acc-color, var(--accent-primary));
	border-radius: var(--radius-lg);
}
.preview-card__icon {
	width: 44px;
	height: 44px;
	border-radius: var(--radius-md);
	background: var(--acc-color, var(--accent-primary));
	display: flex;
	align-items: center;
	justify-content: center;
	color: white;
	opacity: 0.9;
}
.preview-card__info {
	flex: 1;
}
.preview-card__name {
	font-weight: 600;
}
.preview-card__meta {
	color: var(--text-muted);
}
.preview-card__balance {
	font-weight: 700;
	font-variant-numeric: tabular-nums;
}

.add-account__form {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
	padding: 0 var(--space-5) var(--space-8);
	overflow-y: auto;
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
</style>
