<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import { PhCaretLeft } from "@phosphor-icons/vue";
import AppSelect from "@/components/ui/AppSelect.vue";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useAccountsStore } from "@/stores/accounts.store";
import { useCategoriesStore } from "@/stores/categories.store";
import { useSettingsStore } from "@/stores/settings.store";
import { useGamificationStore } from "@/stores/gamification.store";
import { parseCsv, autoDetectMapping, applyMapping, previewRowsToTransactions } from "@/services/data/import.service";
import type { ColumnMapping, CsvRow, ImportPreviewRow } from "@/services/data/import.service";
import { getFileSystemAdapter } from "@/services/filesystem";

const router = useRouter();
const txStore = useTransactionsStore();
const accountsStore = useAccountsStore();
const categoriesStore = useCategoriesStore();
const settingsStore = useSettingsStore();
const gamificationStore = useGamificationStore();

type Step = "pick" | "map" | "preview" | "done";
const step = ref<Step>("pick");
const error = ref("");
const isImporting = ref(false);

const headers = ref<string[]>([]);
const rawRows = ref<CsvRow[]>([]);
const mapping = ref<ColumnMapping>({
	date: "",
	amount: "",
	type: "",
	comment: "",
	accountId: accountsStore.activeAccounts[0]?.id ?? "",
	categoryId: ""
});

const previewRows = computed<ImportPreviewRow[]>(() => {
	if (!mapping.value.date || !mapping.value.amount) return [];
	return applyMapping(rawRows.value, mapping.value);
});

const validCount = computed(() => previewRows.value.filter((r) => r.valid).length);
const errorCount = computed(() => previewRows.value.filter((r) => !r.valid).length);

// Step 1: pick file
async function pickFile() {
	error.value = "";
	try {
		const fs = await getFileSystemAdapter();
		const result = await fs.importFile([".csv"]);
		if (!result) return;

		const { headers: h, rows } = parseCsv(result.content);
		if (!h.length) {
			error.value = "Не удалось прочитать CSV";
			return;
		}

		headers.value = h;
		rawRows.value = rows;
		const detected = autoDetectMapping(h);
		mapping.value = {
			...mapping.value,
			date: detected.date ?? h[0],
			amount: detected.amount ?? h[1],
			type: detected.type ?? "",
			comment: detected.comment ?? ""
		};
		step.value = "map";
	} catch (e) {
		error.value = e instanceof Error ? e.message : "Ошибка выбора файла";
	}
}

// Step 2 → 3: validate mapping
function goPreview() {
	if (!mapping.value.date || !mapping.value.amount) {
		error.value = "Укажите колонки Дата и Сумма";
		return;
	}
	if (!mapping.value.accountId) {
		error.value = "Выберите счёт для импорта";
		return;
	}
	error.value = "";
	step.value = "preview";
}

// Step 3 → import
async function doImport() {
	isImporting.value = true;
	error.value = "";
	try {
		const deviceId = settingsStore.settings.deviceId;
		const txDrafts = previewRowsToTransactions(previewRows.value, mapping.value, deviceId);

		for (const draft of txDrafts) {
			const tx = await txStore.addTransaction(draft);
			gamificationStore.onTransactionAdded(tx);
		}
		step.value = "done";
	} catch (e) {
		error.value = e instanceof Error ? e.message : "Ошибка импорта";
	} finally {
		isImporting.value = false;
	}
}

const EMPTY_COL = "— не использовать —";
const colOptions = computed(() => [EMPTY_COL, ...headers.value]);

const headerOptions = computed(() => headers.value.map((h) => ({ value: h, label: h })));
const colMappingOptions = computed(() =>
	colOptions.value.map((o) => ({ value: o === EMPTY_COL ? "" : o, label: o }))
);
const importAccountOptions = computed(() =>
	accountsStore.activeAccounts.map((a) => ({ value: a.id, label: a.name }))
);
const importCategoryOptions = computed(() => [
	{ value: "", label: "— без категории —" },
	...categoriesStore.categories
		.filter((c) => !c.isArchived)
		.map((c) => ({ value: c.id, label: c.name })),
]);
</script>

<template>
	<div class="import-view">
		<div class="import-view__header">
			<button
				class="back-btn tp-body-lg-regular"
				@click="router.back()">
				<PhCaretLeft :size="18" />
				Назад
			</button>
			<h2 class="import-view__title tp-heading-md-bold">Импорт CSV</h2>
		</div>

		<!-- Step indicator -->
		<div class="steps tp-caption-md-regular">
			<div :class="['step', { 'step--active': step === 'pick', 'step--done': step !== 'pick' }]">1 Файл</div>
			<div class="step-sep">›</div>
			<div :class="['step', { 'step--active': step === 'map', 'step--done': step === 'preview' || step === 'done' }]">2 Колонки</div>
			<div class="step-sep">›</div>
			<div :class="['step', { 'step--active': step === 'preview', 'step--done': step === 'done' }]">3 Проверка</div>
			<div class="step-sep">›</div>
			<div :class="['step', { 'step--active': step === 'done' }]">4 Готово</div>
		</div>

		<!-- Error -->
		<p
			v-if="error"
			class="import-error tp-body-md-regular">
			{{ error }}
		</p>

		<!-- ── Step 1: pick file ── -->
		<div
			v-if="step === 'pick'"
			class="import-card">
			<div class="import-card__icon">📂</div>
			<p class="import-card__desc tp-body-md-regular">
				Поддерживаются CSV-файлы от большинства банков.<br />
				Разделитель: запятая или точка с запятой.
			</p>
			<AppButton
				full-width
				size="lg"
				@click="pickFile"
				>Выбрать файл CSV</AppButton
			>
		</div>

		<!-- ── Step 2: map columns ── -->
		<div
			v-else-if="step === 'map'"
			class="import-card">
			<p class="import-card__hint tp-body-md-regular">Найдено строк: {{ rawRows.length }}. Укажите какие колонки соответствуют полям:</p>

			<div class="map-grid">
				<div class="map-field">
					<label class="map-field__label tp-label-sm-medium">Дата *</label>
					<AppSelect
						v-model="mapping.date"
						:options="headerOptions" />
				</div>
				<div class="map-field">
					<label class="map-field__label tp-label-sm-medium">Сумма *</label>
					<AppSelect
						v-model="mapping.amount"
						:options="headerOptions" />
				</div>
				<div class="map-field">
					<label class="map-field__label tp-label-sm-medium">Тип (доход/расход)</label>
					<AppSelect
						v-model="mapping.type"
						:options="colMappingOptions" />
				</div>
				<div class="map-field">
					<label class="map-field__label tp-label-sm-medium">Комментарий</label>
					<AppSelect
						v-model="mapping.comment"
						:options="colMappingOptions" />
				</div>
				<div class="map-field map-field--full">
					<label class="map-field__label tp-label-sm-medium">Счёт *</label>
					<AppSelect
						v-model="mapping.accountId"
						:options="importAccountOptions" />
				</div>
				<div class="map-field map-field--full">
					<label class="map-field__label tp-label-sm-medium">Категория по умолчанию</label>
					<AppSelect
						v-model="mapping.categoryId"
						:options="importCategoryOptions" />
				</div>
			</div>

			<div class="import-actions">
				<AppButton
					variant="secondary"
					@click="step = 'pick'"
					>Назад</AppButton
				>
				<AppButton @click="goPreview">Далее</AppButton>
			</div>
		</div>

		<!-- ── Step 3: preview ── -->
		<div
			v-else-if="step === 'preview'"
			class="import-card import-card--preview">
			<div class="preview-summary tp-body-md-semibold">
				<span class="text-income">✓ {{ validCount }} строк готовы к импорту</span>
				<span
					v-if="errorCount > 0"
					class="text-expense"
					>✕ {{ errorCount }} строк с ошибками (пропустятся)</span
				>
			</div>

			<div class="preview-table-wrap">
				<table class="preview-table tp-caption-md-regular">
					<thead>
						<tr>
							<th>Дата</th>
							<th>Сумма</th>
							<th>Тип</th>
							<th>Комментарий</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="(row, i) in previewRows.slice(0, 20)"
							:key="i"
							:class="{ 'row--error': !row.valid }">
							<td>{{ row.date }}</td>
							<td :class="row.type === 'income' ? 'text-income' : 'text-expense'">
								{{ row.type === "income" ? "+" : "-" }}{{ row.amount.toLocaleString("ru-RU") }}
							</td>
							<td>{{ row.type === "income" ? "Доход" : "Расход" }}</td>
							<td class="truncate">{{ row.comment }}</td>
							<td>
								<span
									v-if="!row.valid"
									class="row-error"
									:title="row.error"
									>✕</span
								>
								<span
									v-else
									class="row-ok"
									>✓</span
								>
							</td>
						</tr>
					</tbody>
				</table>
				<p
					v-if="previewRows.length > 20"
					class="preview-more tp-caption-md-regular">
					… и ещё {{ previewRows.length - 20 }} строк
				</p>
			</div>

			<div class="import-actions">
				<AppButton
					variant="secondary"
					@click="step = 'map'"
					>Назад</AppButton
				>
				<AppButton
					:loading="isImporting"
					:disabled="validCount === 0"
					@click="doImport">
					Импортировать {{ validCount }} операций
				</AppButton>
			</div>
		</div>

		<!-- ── Step 4: done ── -->
		<div
			v-else
			class="import-card import-card--done">
			<div class="import-card__icon">🎉</div>
			<h3>Импорт завершён!</h3>
			<p class="text-muted">Импортировано {{ validCount }} операций</p>
			<AppButton
				full-width
				@click="router.push('/transactions')"
				>Перейти к операциям</AppButton
			>
		</div>
	</div>
</template>

<style scoped>
.import-view {
	display: flex;
	flex-direction: column;
	max-width: 600px;
	margin: 0 auto;
}
.import-view__header {
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

.steps {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	padding: 0 var(--space-5) var(--space-4);
	color: var(--text-muted);
}
.step {
	padding: var(--space-1) var(--space-2);
	border-radius: var(--radius-sm);
}
.step--active {
	color: var(--accent-primary);
	font-weight: 600;
	background: var(--accent-primary-soft);
}
.step--done {
	color: var(--accent-success);
}
.step-sep {
	color: var(--border);
}

.import-error {
	margin: 0 var(--space-5) var(--space-3);
	padding: var(--space-3);
	background: var(--accent-danger-soft);
	border-radius: var(--radius-md);
	color: var(--accent-danger);
}

.import-card {
	margin: 0 var(--space-5);
	padding: var(--space-6);
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-xl);
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
}
.import-card--preview {
	padding: var(--space-4);
}
.import-card--done {
	align-items: center;
	text-align: center;
	padding: var(--space-10);
}
.import-card__icon {
	font-size: 48px;
	text-align: center;
}
.import-card__desc {
	color: var(--text-secondary);
	line-height: 1.6;
	text-align: center;
}
.import-card__hint {
	color: var(--text-secondary);
}

.map-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--space-3);
}
.map-field {
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.map-field--full {
	grid-column: span 2;
}
.map-field__label {
	color: var(--text-muted);
}
.map-field__select {
	height: 40px;
	padding: 0 var(--space-3);
	border-radius: var(--radius-md);
	border: 1px solid var(--border);
	background: var(--bg-input);
	color: var(--text-primary);
}

.import-actions {
	display: flex;
	gap: var(--space-3);
	justify-content: flex-end;
}

.preview-summary {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-4);
}

.preview-table-wrap {
	overflow-x: auto;
	max-height: 320px;
	overflow-y: auto;
}
.preview-table {
	width: 100%;
	border-collapse: collapse;
}
.preview-table th {
	position: sticky;
	top: 0;
	background: var(--bg-elevated);
	padding: var(--space-2) var(--space-3);
	text-align: left;
	font-weight: 600;
	color: var(--text-secondary);
	white-space: nowrap;
}
.preview-table td {
	padding: var(--space-2) var(--space-3);
	border-bottom: 1px solid var(--border);
}
.preview-table .truncate {
	max-width: 160px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.row--error td {
	color: var(--text-muted);
}
.row-ok {
	color: var(--accent-success);
}
.row-error {
	color: var(--accent-danger);
	cursor: help;
}
.preview-more {
	color: var(--text-muted);
	text-align: center;
	padding: var(--space-2);
}
</style>
