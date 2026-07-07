import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockIsNativePlatform, mockIsAvailable, mockInstall, mockAddListener, mockScan } = vi.hoisted(() => ({
	mockIsNativePlatform: vi.fn(() => false),
	mockIsAvailable: vi.fn(async () => ({ available: true })),
	mockInstall: vi.fn(async () => {}),
	mockAddListener: vi.fn(async (_event: string, cb: (e: { state: number }) => void) => {
		(mockAddListener as any).lastCb = cb;
		return { remove: vi.fn() };
	}),
	mockScan: vi.fn(async () => ({ barcodes: [{ rawValue: "raw-qr-data" }] }))
}));

vi.mock("@capacitor/core", () => ({
	Capacitor: { isNativePlatform: mockIsNativePlatform }
}));

vi.mock("@capacitor-mlkit/barcode-scanning", () => ({
	BarcodeScanner: {
		isGoogleBarcodeScannerModuleAvailable: mockIsAvailable,
		installGoogleBarcodeScannerModule: mockInstall,
		addListener: mockAddListener,
		scan: mockScan
	},
	BarcodeFormat: { QrCode: "QR_CODE" },
	GoogleBarcodeScannerModuleInstallState: {
		UNKNOWN: 0,
		PENDING: 1,
		DOWNLOADING: 2,
		CANCELED: 3,
		COMPLETED: 4,
		FAILED: 5,
		INSTALLING: 6,
		DOWNLOAD_PAUSED: 7
	}
}));

import { isScannerAvailable, scanReceiptQr } from "./qrScanner.service";

beforeEach(() => {
	vi.clearAllMocks();
	mockIsAvailable.mockResolvedValue({ available: true });
	mockScan.mockResolvedValue({ barcodes: [{ rawValue: "raw-qr-data" }] });
});

describe("isScannerAvailable", () => {
	it("returns false when not on a native platform", () => {
		mockIsNativePlatform.mockReturnValue(false);
		expect(isScannerAvailable()).toBe(false);
	});

	it("returns true when on a native platform", () => {
		mockIsNativePlatform.mockReturnValue(true);
		expect(isScannerAvailable()).toBe(true);
	});
});

describe("scanReceiptQr – non-native platform", () => {
	beforeEach(() => mockIsNativePlatform.mockReturnValue(false));

	it("returns null without touching the plugin", async () => {
		const result = await scanReceiptQr();
		expect(result).toBeNull();
		expect(mockIsAvailable).not.toHaveBeenCalled();
		expect(mockScan).not.toHaveBeenCalled();
	});
});

describe("scanReceiptQr – native, module already available", () => {
	beforeEach(() => mockIsNativePlatform.mockReturnValue(true));

	it("does not attempt to install the module", async () => {
		await scanReceiptQr();
		expect(mockInstall).not.toHaveBeenCalled();
	});

	it("scans restricted to the QR_CODE format", async () => {
		await scanReceiptQr();
		expect(mockScan).toHaveBeenCalledWith({ formats: ["QR_CODE"] });
	});

	it("returns the raw value of the first detected barcode", async () => {
		const result = await scanReceiptQr();
		expect(result).toBe("raw-qr-data");
	});

	it("returns null when no barcode is detected", async () => {
		mockScan.mockResolvedValueOnce({ barcodes: [] });
		const result = await scanReceiptQr();
		expect(result).toBeNull();
	});

	it("returns null when scan() throws (user cancelled / permission denied)", async () => {
		mockScan.mockRejectedValueOnce(new Error("cancelled"));
		const result = await scanReceiptQr();
		expect(result).toBeNull();
	});
});

describe("scanReceiptQr – native, module needs installing", () => {
	beforeEach(() => {
		mockIsNativePlatform.mockReturnValue(true);
		mockIsAvailable.mockResolvedValue({ available: false });
	});

	it("triggers module installation", async () => {
		const promise = scanReceiptQr();
		await vi.waitFor(() => expect(mockInstall).toHaveBeenCalledOnce());
		(mockAddListener as any).lastCb({ state: 4 }); // COMPLETED
		await promise;
		expect(mockInstall).toHaveBeenCalledOnce();
	});

	it("scans after installation completes", async () => {
		const promise = scanReceiptQr();
		await vi.waitFor(() => expect(mockAddListener).toHaveBeenCalledOnce());
		(mockAddListener as any).lastCb({ state: 4 }); // COMPLETED
		const result = await promise;
		expect(result).toBe("raw-qr-data");
	});

	it("returns null without scanning when installation fails", async () => {
		const promise = scanReceiptQr();
		await vi.waitFor(() => expect(mockAddListener).toHaveBeenCalledOnce());
		(mockAddListener as any).lastCb({ state: 5 }); // FAILED
		const result = await promise;
		expect(result).toBeNull();
		expect(mockScan).not.toHaveBeenCalled();
	});

	it("returns null without scanning when installation is cancelled", async () => {
		const promise = scanReceiptQr();
		await vi.waitFor(() => expect(mockAddListener).toHaveBeenCalledOnce());
		(mockAddListener as any).lastCb({ state: 3 }); // CANCELED
		const result = await promise;
		expect(result).toBeNull();
		expect(mockScan).not.toHaveBeenCalled();
	});
});
