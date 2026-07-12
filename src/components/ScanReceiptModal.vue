<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AppModal from "@/components/ui/AppModal.vue";
import AppButton from "@/components/ui/AppButton.vue";
import { isScannerAvailable, scanReceiptQr, scanReceiptQrFromImage, scanReceiptQrFromBlob } from "@/services/qrScanner.service";
import { parseFiscalReceiptQr, receiptFingerprint, type ParsedReceipt } from "@/utils/receiptQr";
import { useTransactionsStore } from "@/stores/transactions.store";

const emit = defineEmits<{
	close: [];
	apply: [parsed: ParsedReceipt, fingerprint: string];
}>();

const router = useRouter();
const txStore = useTransactionsStore();

type State = "choose" | "scanning" | "duplicate";
const state = ref<State>("choose");
const hasError = ref(false);
const duplicateTxId = ref<string | null>(null);

let pendingParsed: ParsedReceipt | null = null;
let pendingFingerprint = "";

async function scanWith(scan: () => Promise<string | null>) {
	state.value = "scanning";
	hasError.value = false;
	const raw = await scan();
	const parsed = raw ? parseFiscalReceiptQr(raw) : null;
	if (!parsed) {
		state.value = "choose";
		hasError.value = true;
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
	emit("apply", parsed, fingerprint);
}

function addAnyway() {
	if (!pendingParsed) return;
	emit("apply", pendingParsed, pendingFingerprint);
}

function openDuplicate() {
	if (!duplicateTxId.value) return;
	router.push(`/transactions/${duplicateTxId.value}`);
	emit("close");
}

const isDragOver = ref(false);

function firstImage(files: FileList | File[] | null | undefined): File | null {
	return Array.from(files ?? []).find((f) => f.type.startsWith("image/")) ?? null;
}

function scanBlob(file: File | null) {
	if (!file) {
		hasError.value = true;
		return;
	}
	scanWith(() => scanReceiptQrFromBlob(file));
}

function onDrop(event: DragEvent) {
	isDragOver.value = false;
	scanBlob(firstImage(event.dataTransfer?.files));
}

function onPaste(event: ClipboardEvent) {
	if (state.value !== "choose") return;
	scanBlob(firstImage(event.clipboardData?.files));
}

onMounted(() => {
	if (!isScannerAvailable()) window.addEventListener("paste", onPaste);
});
onBeforeUnmount(() => {
	window.removeEventListener("paste", onPaste);
});
</script>

<template>
	<AppModal
		title="Сканировать чек"
		size="sm"
		@close="emit('close')">
		<div class="scan-modal">
			<template v-if="state === 'scanning'">
				<p class="scan-modal__status">Сканирование...</p>
			</template>

			<template v-else-if="state === 'duplicate'">
				<p class="scan-modal__status">Этот чек уже добавлен</p>
				<AppButton
					class="scan-modal__open-duplicate"
					full-width
					@click="openDuplicate">
					Открыть операцию
				</AppButton>
				<AppButton
					class="scan-modal__add-anyway"
					full-width
					variant="secondary"
					@click="addAnyway">
					Добавить всё равно
				</AppButton>
			</template>

			<template v-else>
				<p
					v-if="hasError"
					class="scan-modal__error">
					Не удалось распознать чек
				</p>
				<AppButton
					v-if="isScannerAvailable()"
					class="scan-modal__camera"
					full-width
					@click="scanWith(scanReceiptQr)">
					Камера
				</AppButton>
				<AppButton
					class="scan-modal__gallery"
					full-width
					:variant="isScannerAvailable() ? 'secondary' : 'primary'"
					@click="scanWith(scanReceiptQrFromImage)">
					Выбрать изображение
				</AppButton>
				<div
					v-if="!isScannerAvailable()"
					class="scan-modal__dropzone"
					:class="{ 'scan-modal__dropzone--active': isDragOver }"
					@dragover.prevent="isDragOver = true"
					@dragleave="isDragOver = false"
					@drop.prevent="onDrop">
					Перетащите изображение сюда<br />
					или вставьте из буфера обмена (Ctrl+V)
				</div>
			</template>
		</div>
	</AppModal>
</template>

<style scoped>
.scan-modal {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}
.scan-modal__status {
	text-align: center;
	color: var(--text-secondary);
	padding: var(--space-4) 0;
}
.scan-modal__error {
	text-align: center;
	color: var(--accent-danger);
}
.scan-modal__dropzone {
	text-align: center;
	color: var(--text-secondary);
	font-size: 0.875rem;
	border: 1px dashed var(--border);
	border-radius: var(--radius-md);
	padding: var(--space-4);
	transition:
		border-color 0.15s,
		background-color 0.15s;
}
.scan-modal__dropzone--active {
	border-color: var(--accent-primary);
	background-color: color-mix(in srgb, var(--accent-primary) 10%, transparent);
}
</style>
