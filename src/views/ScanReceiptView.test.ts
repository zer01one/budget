import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import ScanReceiptView from "./ScanReceiptView.vue";
import { useTransactionsStore } from "@/stores/transactions.store";
import type { Transaction } from "@/types";

vi.mock("@/services/qrScanner.service", () => ({
	isScannerAvailable: vi.fn(),
	scanReceiptQr: vi.fn()
}));

import { isScannerAvailable, scanReceiptQr } from "@/services/qrScanner.service";

const VALID_QR = "t=20260707T1530&s=1234.56&fn=1111&i=2222&fp=3333&n=1";
const RECEIPT_TAG = "receipt:1111:2222:3333";

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: "tx-existing",
		type: "expense",
		amount: 1234.56,
		currency: "KZT",
		date: "2026-07-07",
		time: "15:30",
		accountId: "acc-1",
		toAccountId: null,
		categoryId: null,
		comment: "",
		tags: [],
		isRecurring: false,
		recurringParentId: null,
		isDeleted: false,
		updatedAt: "2026-07-07T15:30:00Z",
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

let pinia: ReturnType<typeof createPinia>;

afterEach(() => {
	vi.clearAllMocks();
});

async function mountView() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: "/transactions/scan", name: "scan-receipt", component: ScanReceiptView },
			{ path: "/transactions/add", name: "add-transaction", component: { template: "<div/>" } },
			{ path: "/transactions/:id", name: "transaction-detail", component: { template: "<div/>" } }
		]
	});
	router.push("/transactions/scan");
	await router.isReady();
	const wrapper = mount(ScanReceiptView, { global: { plugins: [pinia, router] } });
	return { wrapper, router };
}

describe("ScanReceiptView", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("shows the scanning state while the scan is in progress", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		vi.mocked(scanReceiptQr).mockReturnValue(new Promise(() => {}));
		const { wrapper } = await mountView();
		await wrapper.vm.$nextTick();
		expect(wrapper.text()).toContain("Сканирование");
	});

	it("calls scanReceiptQr on mount when scanner is available", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		vi.mocked(scanReceiptQr).mockReturnValue(new Promise(() => {}));
		await mountView();
		expect(scanReceiptQr).toHaveBeenCalledOnce();
	});

	it("shows an unavailable message and does not scan when the scanner is unavailable (desktop)", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(false);
		const { wrapper } = await mountView();
		await flushPromises();
		expect(wrapper.text()).toContain("недоступно");
		expect(scanReceiptQr).not.toHaveBeenCalled();
	});

	it("navigates to add-transaction with parsed fields on a successful scan", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		vi.mocked(scanReceiptQr).mockResolvedValue(VALID_QR);
		const { router } = await mountView();
		await flushPromises();
		expect(router.currentRoute.value.name).toBe("add-transaction");
		expect(router.currentRoute.value.query).toEqual({
			type: "expense",
			amount: "1234.56",
			date: "2026-07-07",
			time: "15:30",
			receiptTag: RECEIPT_TAG
		});
	});

	it("shows the error state when the scan returns nothing (cancelled or denied)", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		vi.mocked(scanReceiptQr).mockResolvedValue(null);
		const { wrapper } = await mountView();
		await flushPromises();
		expect(wrapper.text()).toContain("Не удалось распознать");
	});

	it("shows the error state when the scanned QR is not a fiscal receipt", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		vi.mocked(scanReceiptQr).mockResolvedValue("https://example.com/not-a-receipt");
		const { wrapper } = await mountView();
		await flushPromises();
		expect(wrapper.text()).toContain("Не удалось распознать");
	});

	it("retries the scan when the retry button is clicked in the error state", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		vi.mocked(scanReceiptQr).mockResolvedValueOnce(null);
		const { wrapper } = await mountView();
		await flushPromises();
		vi.mocked(scanReceiptQr).mockResolvedValueOnce(VALID_QR);
		await wrapper.find("button.scan-receipt__retry").trigger("click");
		await flushPromises();
		expect(scanReceiptQr).toHaveBeenCalledTimes(2);
	});

	it("shows the duplicate state when a transaction with the same receipt tag is already cached", async () => {
		useTransactionsStore()._cache.set("2026-07", [makeTx({ id: "tx-existing", tags: [RECEIPT_TAG] })]);
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		vi.mocked(scanReceiptQr).mockResolvedValue(VALID_QR);
		const { wrapper } = await mountView();
		await flushPromises();
		expect(wrapper.text()).toContain("уже добавлен");
	});

	it("'Открыть операцию' navigates to the existing transaction", async () => {
		useTransactionsStore()._cache.set("2026-07", [makeTx({ id: "tx-existing", tags: [RECEIPT_TAG] })]);
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		vi.mocked(scanReceiptQr).mockResolvedValue(VALID_QR);
		const { wrapper, router } = await mountView();
		await flushPromises();
		const pushSpy = vi.spyOn(router, "push");
		await wrapper.find("button.scan-receipt__open-duplicate").trigger("click");
		expect(pushSpy).toHaveBeenCalledWith("/transactions/tx-existing");
	});

	it("'Добавить всё равно' navigates to add-transaction despite the duplicate", async () => {
		useTransactionsStore()._cache.set("2026-07", [makeTx({ id: "tx-existing", tags: [RECEIPT_TAG] })]);
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		vi.mocked(scanReceiptQr).mockResolvedValue(VALID_QR);
		const { wrapper, router } = await mountView();
		await flushPromises();
		const replaceSpy = vi.spyOn(router, "replace");
		await wrapper.find("button.scan-receipt__add-anyway").trigger("click");
		expect(replaceSpy).toHaveBeenCalledWith({
			name: "add-transaction",
			query: {
				type: "expense",
				amount: "1234.56",
				date: "2026-07-07",
				time: "15:30",
				receiptTag: RECEIPT_TAG
			}
		});
	});

	it("back button navigates back", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(true);
		vi.mocked(scanReceiptQr).mockReturnValue(new Promise(() => {}));
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back");
		await wrapper.find(".scan-receipt__back").trigger("click");
		expect(backSpy).toHaveBeenCalledOnce();
	});
});
