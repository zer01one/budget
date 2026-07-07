<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import AppButton from "@/components/ui/AppButton.vue";
import { isScannerAvailable, scanReceiptQr } from "@/services/qrScanner.service";
import { parseFiscalReceiptQr, receiptFingerprint, type ParsedReceipt } from "@/utils/receiptQr";
import { useTransactionsStore } from "@/stores/transactions.store";

const router = useRouter();
const txStore = useTransactionsStore();

type State = "scanning" | "unavailable" | "error" | "duplicate";
const state = ref<State>("scanning");
const duplicateTxId = ref<string | null>(null);

let pendingParsed: ParsedReceipt | null = null;
let pendingFingerprint = "";

function goToAddTransaction(parsed: ParsedReceipt, fingerprint: string) {
	router.replace({
		name: "add-transaction",
		query: {
			type: parsed.type,
			amount: String(parsed.amount),
			date: parsed.date,
			time: parsed.time,
			receiptTag: fingerprint
		}
	});
}

async function startScan() {
	if (!isScannerAvailable()) {
		state.value = "unavailable";
		return;
	}
	state.value = "scanning";
	const raw = await scanReceiptQr();
	if (!raw) {
		state.value = "error";
		return;
	}
	const parsed = parseFiscalReceiptQr(raw);
	if (!parsed) {
		state.value = "error";
		return;
	}
	const fingerprint = receiptFingerprint(parsed);
	const dup = txStore.allCached.find((t) => t.tags.includes(fingerprint));
	if (dup) {
		pendingParsed = parsed;
		pendingFingerprint = fingerprint;
		duplicateTxId.value = dup.id;
		state.value = "duplicate";
		return;
	}
	goToAddTransaction(parsed, fingerprint);
}

function addAnyway() {
	if (!pendingParsed) return;
	goToAddTransaction(pendingParsed, pendingFingerprint);
}

function openDuplicate() {
	if (duplicateTxId.value) router.push(`/transactions/${duplicateTxId.value}`);
}

onMounted(startScan);
</script>

<template>
	<div class="scan-receipt">
		<div class="scan-receipt__header">
			<button
				class="scan-receipt__back"
				@click="router.back()">
				← Назад
			</button>
			<h2 class="scan-receipt__title">Сканировать чек</h2>
		</div>

		<div class="scan-receipt__body">
			<template v-if="state === 'scanning'">
				<p class="scan-receipt__status">Сканирование...</p>
			</template>

			<template v-else-if="state === 'unavailable'">
				<p class="scan-receipt__status">Сканирование чеков недоступно на этом устройстве</p>
				<AppButton @click="router.back()">Назад</AppButton>
			</template>

			<template v-else-if="state === 'error'">
				<p class="scan-receipt__status">Не удалось распознать чек</p>
				<AppButton
					class="scan-receipt__retry"
					@click="startScan">
					Повторить
				</AppButton>
			</template>

			<template v-else-if="state === 'duplicate'">
				<p class="scan-receipt__status">Этот чек уже добавлен</p>
				<AppButton
					class="scan-receipt__open-duplicate"
					@click="openDuplicate">
					Открыть операцию
				</AppButton>
				<AppButton
					class="scan-receipt__add-anyway"
					variant="secondary"
					@click="addAnyway">
					Добавить всё равно
				</AppButton>
			</template>
		</div>
	</div>
</template>

<style scoped>
.scan-receipt {
	display: flex;
	flex-direction: column;
	max-width: 540px;
	margin: 0 auto;
}
.scan-receipt__header {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-5) var(--space-5) var(--space-3);
}
.scan-receipt__back {
	background: none;
	border: none;
	color: var(--accent-primary);
	cursor: pointer;
	font-size: var(--font-md);
}
.scan-receipt__title {
	font-size: var(--font-xl);
	font-weight: 700;
}
.scan-receipt__body {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-4);
	padding: var(--space-8) var(--space-5);
	text-align: center;
}
.scan-receipt__status {
	font-size: var(--font-md);
	color: var(--text-secondary);
}
</style>
