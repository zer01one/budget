import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import ScanReceiptModal from "./ScanReceiptModal.vue";
import { useTransactionsStore } from "@/stores/transactions.store";
import type { Transaction } from "@/types";

vi.mock("@/services/qrScanner.service", () => ({
	isScannerAvailable: vi.fn(),
	scanReceiptQr: vi.fn(),
	scanReceiptQrFromImage: vi.fn(),
	scanReceiptQrFromBlob: vi.fn()
}));

import { isScannerAvailable, scanReceiptQr, scanReceiptQrFromImage, scanReceiptQrFromBlob } from "@/services/qrScanner.service";

const VALID_QR = "t=20260707T1530&s=1234.56&fn=1111&i=2222&fp=3333&n=1";
const RECEIPT_TAG = "receipt:1111:2222:3333";

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: "tx-existing",
		type: "expense",
		amount: 1234.56,
		currency: "RUB",
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

async function mountModal() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: "/", component: { template: "<div/>" } },
			{ path: "/transactions/:id", name: "transaction-detail", component: { template: "<div/>" } }
		]
	});
	router.push("/");
	await router.isReady();
	const wrapper = mount(ScanReceiptModal, { global: { plugins: [pinia, router] } });
	return { wrapper, router };
}

describe("ScanReceiptModal", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		vi.mocked(isScannerAvailable).mockReturnValue(true);
	});

	it("initially shows camera and gallery option buttons", async () => {
		const { wrapper } = await mountModal();
		expect(document.body.querySelector(".scan-modal__camera")).toBeTruthy();
		expect(document.body.querySelector(".scan-modal__gallery")).toBeTruthy();
		wrapper.unmount();
	});

	it("hides the camera button on desktop but keeps the image option", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(false);
		const { wrapper } = await mountModal();
		expect(document.body.querySelector(".scan-modal__camera")).toBeNull();
		expect(document.body.querySelector(".scan-modal__gallery")).toBeTruthy();
		wrapper.unmount();
	});

	it("gallery scan works on desktop too", async () => {
		vi.mocked(isScannerAvailable).mockReturnValue(false);
		vi.mocked(scanReceiptQrFromImage).mockResolvedValue(VALID_QR);
		const { wrapper } = await mountModal();
		(document.body.querySelector(".scan-modal__gallery") as HTMLButtonElement).click();
		await flushPromises();
		expect(wrapper.emitted("apply")).toBeTruthy();
		wrapper.unmount();
	});

	it("emits close when the modal close button is clicked", async () => {
		const { wrapper } = await mountModal();
		(document.body.querySelector(".modal__close") as HTMLButtonElement).click();
		await flushPromises();
		expect(wrapper.emitted("close")).toBeTruthy();
		wrapper.unmount();
	});

	it("camera button triggers scanReceiptQr", async () => {
		vi.mocked(scanReceiptQr).mockReturnValue(new Promise(() => {}));
		const { wrapper } = await mountModal();
		(document.body.querySelector(".scan-modal__camera") as HTMLButtonElement).click();
		await flushPromises();
		expect(scanReceiptQr).toHaveBeenCalledOnce();
		wrapper.unmount();
	});

	it("gallery button triggers scanReceiptQrFromImage", async () => {
		vi.mocked(scanReceiptQrFromImage).mockReturnValue(new Promise(() => {}));
		const { wrapper } = await mountModal();
		(document.body.querySelector(".scan-modal__gallery") as HTMLButtonElement).click();
		await flushPromises();
		expect(scanReceiptQrFromImage).toHaveBeenCalledOnce();
		wrapper.unmount();
	});

	it("shows scanning status while the scan is in progress", async () => {
		vi.mocked(scanReceiptQr).mockReturnValue(new Promise(() => {}));
		const { wrapper } = await mountModal();
		(document.body.querySelector(".scan-modal__camera") as HTMLButtonElement).click();
		await flushPromises();
		expect(document.body.textContent).toContain("Сканирование");
		wrapper.unmount();
	});

	it("emits apply with parsed receipt and fingerprint on a successful camera scan", async () => {
		vi.mocked(scanReceiptQr).mockResolvedValue(VALID_QR);
		const { wrapper } = await mountModal();
		(document.body.querySelector(".scan-modal__camera") as HTMLButtonElement).click();
		await flushPromises();
		const applied = wrapper.emitted("apply");
		expect(applied).toBeTruthy();
		expect(applied![0][0]).toMatchObject({ amount: 1234.56, date: "2026-07-07", time: "15:30", type: "expense" });
		expect(applied![0][1]).toBe(RECEIPT_TAG);
		wrapper.unmount();
	});

	it("emits apply on a successful gallery scan", async () => {
		vi.mocked(scanReceiptQrFromImage).mockResolvedValue(VALID_QR);
		const { wrapper } = await mountModal();
		(document.body.querySelector(".scan-modal__gallery") as HTMLButtonElement).click();
		await flushPromises();
		expect(wrapper.emitted("apply")).toBeTruthy();
		wrapper.unmount();
	});

	it("shows an error and keeps both option buttons when the scan returns nothing", async () => {
		vi.mocked(scanReceiptQr).mockResolvedValue(null);
		const { wrapper } = await mountModal();
		(document.body.querySelector(".scan-modal__camera") as HTMLButtonElement).click();
		await flushPromises();
		expect(document.body.textContent).toContain("Не удалось распознать");
		expect(document.body.querySelector(".scan-modal__camera")).toBeTruthy();
		expect(document.body.querySelector(".scan-modal__gallery")).toBeTruthy();
		expect(wrapper.emitted("apply")).toBeFalsy();
		wrapper.unmount();
	});

	it("shows an error when the QR is not a fiscal receipt", async () => {
		vi.mocked(scanReceiptQr).mockResolvedValue("https://example.com/not-a-receipt");
		const { wrapper } = await mountModal();
		(document.body.querySelector(".scan-modal__camera") as HTMLButtonElement).click();
		await flushPromises();
		expect(document.body.textContent).toContain("Не удалось распознать");
		wrapper.unmount();
	});

	it("retry after an error works", async () => {
		vi.mocked(scanReceiptQr).mockResolvedValueOnce(null).mockResolvedValueOnce(VALID_QR);
		const { wrapper } = await mountModal();
		(document.body.querySelector(".scan-modal__camera") as HTMLButtonElement).click();
		await flushPromises();
		(document.body.querySelector(".scan-modal__camera") as HTMLButtonElement).click();
		await flushPromises();
		expect(scanReceiptQr).toHaveBeenCalledTimes(2);
		expect(wrapper.emitted("apply")).toBeTruthy();
		wrapper.unmount();
	});

	it("shows the duplicate state instead of emitting apply when the receipt tag already exists", async () => {
		useTransactionsStore()._cache.set("2026-07", [makeTx({ tags: [RECEIPT_TAG] })]);
		vi.mocked(scanReceiptQr).mockResolvedValue(VALID_QR);
		const { wrapper } = await mountModal();
		(document.body.querySelector(".scan-modal__camera") as HTMLButtonElement).click();
		await flushPromises();
		expect(document.body.textContent).toContain("уже добавлен");
		expect(wrapper.emitted("apply")).toBeFalsy();
		wrapper.unmount();
	});

	it("'Открыть операцию' navigates to the existing transaction and emits close", async () => {
		useTransactionsStore()._cache.set("2026-07", [makeTx({ id: "tx-existing", tags: [RECEIPT_TAG] })]);
		vi.mocked(scanReceiptQr).mockResolvedValue(VALID_QR);
		const { wrapper, router } = await mountModal();
		const pushSpy = vi.spyOn(router, "push");
		(document.body.querySelector(".scan-modal__camera") as HTMLButtonElement).click();
		await flushPromises();
		(document.body.querySelector(".scan-modal__open-duplicate") as HTMLButtonElement).click();
		await flushPromises();
		expect(pushSpy).toHaveBeenCalledWith("/transactions/tx-existing");
		expect(wrapper.emitted("close")).toBeTruthy();
		wrapper.unmount();
	});

	describe("drag & drop (desktop)", () => {
		const imageFile = new File(["img"], "receipt.png", { type: "image/png" });
		const textFile = new File(["txt"], "notes.txt", { type: "text/plain" });

		function dispatchDrop(files: File[]) {
			const dropzone = document.body.querySelector(".scan-modal__dropzone")!;
			const event = new Event("drop", { bubbles: true, cancelable: true }) as Event & { dataTransfer: { files: File[] } };
			event.dataTransfer = { files };
			dropzone.dispatchEvent(event);
		}

		beforeEach(() => {
			vi.mocked(isScannerAvailable).mockReturnValue(false);
		});

		it("shows the dropzone on desktop", async () => {
			const { wrapper } = await mountModal();
			expect(document.body.querySelector(".scan-modal__dropzone")).toBeTruthy();
			wrapper.unmount();
		});

		it("does not show the dropzone on a native platform", async () => {
			vi.mocked(isScannerAvailable).mockReturnValue(true);
			const { wrapper } = await mountModal();
			expect(document.body.querySelector(".scan-modal__dropzone")).toBeNull();
			wrapper.unmount();
		});

		it("dropping an image decodes it and emits apply", async () => {
			vi.mocked(scanReceiptQrFromBlob).mockResolvedValue(VALID_QR);
			const { wrapper } = await mountModal();
			dispatchDrop([imageFile]);
			await flushPromises();
			expect(scanReceiptQrFromBlob).toHaveBeenCalledWith(imageFile);
			expect(wrapper.emitted("apply")).toBeTruthy();
			wrapper.unmount();
		});

		it("picks the first image out of mixed dropped files", async () => {
			vi.mocked(scanReceiptQrFromBlob).mockResolvedValue(VALID_QR);
			const { wrapper } = await mountModal();
			dispatchDrop([textFile, imageFile]);
			await flushPromises();
			expect(scanReceiptQrFromBlob).toHaveBeenCalledWith(imageFile);
			wrapper.unmount();
		});

		it("dropping a non-image file shows the error without scanning", async () => {
			const { wrapper } = await mountModal();
			dispatchDrop([textFile]);
			await flushPromises();
			expect(scanReceiptQrFromBlob).not.toHaveBeenCalled();
			expect(document.body.textContent).toContain("Не удалось распознать");
			expect(wrapper.emitted("apply")).toBeFalsy();
			wrapper.unmount();
		});

		it("highlights the dropzone on dragover and clears it on dragleave", async () => {
			const { wrapper } = await mountModal();
			const dropzone = document.body.querySelector(".scan-modal__dropzone")!;
			dropzone.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
			await flushPromises();
			expect(dropzone.classList.contains("scan-modal__dropzone--active")).toBe(true);
			dropzone.dispatchEvent(new Event("dragleave", { bubbles: true }));
			await flushPromises();
			expect(dropzone.classList.contains("scan-modal__dropzone--active")).toBe(false);
			wrapper.unmount();
		});
	});

	describe("clipboard paste (desktop)", () => {
		const imageFile = new File(["img"], "screenshot.png", { type: "image/png" });

		function dispatchPaste(files: File[]) {
			const event = new Event("paste") as Event & { clipboardData: { files: File[] } };
			event.clipboardData = { files };
			window.dispatchEvent(event);
		}

		beforeEach(() => {
			vi.mocked(isScannerAvailable).mockReturnValue(false);
		});

		it("pasting an image decodes it and emits apply", async () => {
			vi.mocked(scanReceiptQrFromBlob).mockResolvedValue(VALID_QR);
			const { wrapper } = await mountModal();
			dispatchPaste([imageFile]);
			await flushPromises();
			expect(scanReceiptQrFromBlob).toHaveBeenCalledWith(imageFile);
			expect(wrapper.emitted("apply")).toBeTruthy();
			wrapper.unmount();
		});

		it("pasting without an image shows the error without scanning", async () => {
			const { wrapper } = await mountModal();
			dispatchPaste([]);
			await flushPromises();
			expect(scanReceiptQrFromBlob).not.toHaveBeenCalled();
			expect(document.body.textContent).toContain("Не удалось распознать");
			wrapper.unmount();
		});

		it("paste is not handled on a native platform", async () => {
			vi.mocked(isScannerAvailable).mockReturnValue(true);
			const { wrapper } = await mountModal();
			dispatchPaste([imageFile]);
			await flushPromises();
			expect(scanReceiptQrFromBlob).not.toHaveBeenCalled();
			wrapper.unmount();
		});

		it("paste is ignored while a scan is already in progress", async () => {
			vi.mocked(scanReceiptQrFromImage).mockReturnValue(new Promise(() => {}));
			const { wrapper } = await mountModal();
			(document.body.querySelector(".scan-modal__gallery") as HTMLButtonElement).click();
			await flushPromises();
			dispatchPaste([imageFile]);
			await flushPromises();
			expect(scanReceiptQrFromBlob).not.toHaveBeenCalled();
			wrapper.unmount();
		});

		it("paste is ignored in the duplicate state", async () => {
			useTransactionsStore()._cache.set("2026-07", [makeTx({ tags: [RECEIPT_TAG] })]);
			vi.mocked(scanReceiptQrFromImage).mockResolvedValue(VALID_QR);
			const { wrapper } = await mountModal();
			(document.body.querySelector(".scan-modal__gallery") as HTMLButtonElement).click();
			await flushPromises();
			dispatchPaste([imageFile]);
			await flushPromises();
			expect(scanReceiptQrFromBlob).not.toHaveBeenCalled();
			wrapper.unmount();
		});

		it("the paste listener is removed on unmount", async () => {
			vi.mocked(scanReceiptQrFromBlob).mockResolvedValue(VALID_QR);
			const { wrapper } = await mountModal();
			wrapper.unmount();
			dispatchPaste([imageFile]);
			await flushPromises();
			expect(scanReceiptQrFromBlob).not.toHaveBeenCalled();
		});
	});

	it("'Добавить всё равно' emits apply despite the duplicate", async () => {
		useTransactionsStore()._cache.set("2026-07", [makeTx({ tags: [RECEIPT_TAG] })]);
		vi.mocked(scanReceiptQr).mockResolvedValue(VALID_QR);
		const { wrapper } = await mountModal();
		(document.body.querySelector(".scan-modal__camera") as HTMLButtonElement).click();
		await flushPromises();
		(document.body.querySelector(".scan-modal__add-anyway") as HTMLButtonElement).click();
		await flushPromises();
		const applied = wrapper.emitted("apply");
		expect(applied).toBeTruthy();
		expect(applied![0][1]).toBe(RECEIPT_TAG);
		wrapper.unmount();
	});
});
