import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockIsNativePlatform, mockIsAvailable, mockInstall, mockAddListener, mockScan, mockReadFromImage, mockPickImages } = vi.hoisted(
	() => ({
		mockIsNativePlatform: vi.fn(() => false),
		mockIsAvailable: vi.fn(async () => ({ available: true })),
		mockInstall: vi.fn(async () => {}),
		mockAddListener: vi.fn(async (_event: string, cb: (e: { state: number }) => void) => {
			(mockAddListener as any).lastCb = cb;
			return { remove: vi.fn() };
		}),
		mockScan: vi.fn(async () => ({ barcodes: [{ rawValue: "raw-qr-data" }] })),
		mockReadFromImage: vi.fn(async () => ({ barcodes: [{ rawValue: "raw-qr-from-image" }] })),
		mockPickImages: vi.fn(async () => ({ files: [{ path: "/gallery/receipt.jpg" }] }))
	})
);

vi.mock("@capacitor/core", () => ({
	Capacitor: { isNativePlatform: mockIsNativePlatform }
}));

vi.mock("@capawesome/capacitor-file-picker", () => ({
	FilePicker: {
		pickImages: mockPickImages
	}
}));

const { mockDecodeQrFromBlob } = vi.hoisted(() => ({
	mockDecodeQrFromBlob: vi.fn()
}));

vi.mock("@/utils/qrImageDecoder", () => ({
	decodeQrFromBlob: mockDecodeQrFromBlob
}));

vi.mock("@capacitor-mlkit/barcode-scanning", () => ({
	BarcodeScanner: {
		isGoogleBarcodeScannerModuleAvailable: mockIsAvailable,
		installGoogleBarcodeScannerModule: mockInstall,
		addListener: mockAddListener,
		scan: mockScan,
		readBarcodesFromImage: mockReadFromImage
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

import { isScannerAvailable, scanReceiptQr, scanReceiptQrFromImage } from "./qrScanner.service";

beforeEach(() => {
	vi.clearAllMocks();
	mockIsAvailable.mockResolvedValue({ available: true });
	mockScan.mockResolvedValue({ barcodes: [{ rawValue: "raw-qr-data" }] });
	mockReadFromImage.mockResolvedValue({ barcodes: [{ rawValue: "raw-qr-from-image" }] });
	mockPickImages.mockResolvedValue({ files: [{ path: "/gallery/receipt.jpg" }] });
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

describe("scanReceiptQrFromImage – desktop (non-native) platform", () => {
	let fakeInput: {
		type: string;
		accept: string;
		files: File[];
		onchange: (() => void) | null;
		oncancel: (() => void) | null;
		click: () => void;
	};
	let createElementOriginal: typeof document.createElement;

	beforeEach(() => {
		mockIsNativePlatform.mockReturnValue(false);
		mockDecodeQrFromBlob.mockResolvedValue("raw-qr-from-file");
		fakeInput = {
			type: "",
			accept: "",
			files: [new File(["img"], "receipt.png", { type: "image/png" })],
			onchange: null,
			oncancel: null,
			click() {
				this.onchange?.();
			}
		};
		createElementOriginal = document.createElement.bind(document);
		vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
			if (tag === "input") return fakeInput as unknown as HTMLInputElement;
			return createElementOriginal(tag);
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("does not use the Capacitor picker or ML Kit", async () => {
		await scanReceiptQrFromImage();
		expect(mockPickImages).not.toHaveBeenCalled();
		expect(mockReadFromImage).not.toHaveBeenCalled();
	});

	it("opens a file input restricted to images and decodes the chosen file", async () => {
		const result = await scanReceiptQrFromImage();
		expect(fakeInput.type).toBe("file");
		expect(fakeInput.accept).toBe("image/*");
		expect(mockDecodeQrFromBlob).toHaveBeenCalledWith(fakeInput.files[0]);
		expect(result).toBe("raw-qr-from-file");
	});

	it("returns null when the user cancels the file dialog", async () => {
		fakeInput.click = function () {
			this.oncancel?.();
		};
		const result = await scanReceiptQrFromImage();
		expect(result).toBeNull();
		expect(mockDecodeQrFromBlob).not.toHaveBeenCalled();
	});

	it("returns null when no file is selected", async () => {
		fakeInput.files = [];
		const result = await scanReceiptQrFromImage();
		expect(result).toBeNull();
		expect(mockDecodeQrFromBlob).not.toHaveBeenCalled();
	});

	it("returns null when the image contains no QR code", async () => {
		mockDecodeQrFromBlob.mockResolvedValue(null);
		const result = await scanReceiptQrFromImage();
		expect(result).toBeNull();
	});
});

describe("scanReceiptQrFromImage – native platform", () => {
	beforeEach(() => mockIsNativePlatform.mockReturnValue(true));

	it("picks a single image from the gallery", async () => {
		await scanReceiptQrFromImage();
		expect(mockPickImages).toHaveBeenCalledWith({ limit: 1 });
	});

	it("reads barcodes from the picked image path restricted to QR_CODE", async () => {
		await scanReceiptQrFromImage();
		expect(mockReadFromImage).toHaveBeenCalledWith({ path: "/gallery/receipt.jpg", formats: ["QR_CODE"] });
	});

	it("returns the raw value of the first detected barcode", async () => {
		const result = await scanReceiptQrFromImage();
		expect(result).toBe("raw-qr-from-image");
	});

	it("returns null when the user picks nothing", async () => {
		mockPickImages.mockResolvedValueOnce({ files: [] });
		const result = await scanReceiptQrFromImage();
		expect(result).toBeNull();
		expect(mockReadFromImage).not.toHaveBeenCalled();
	});

	it("returns null when the picked file has no path", async () => {
		mockPickImages.mockResolvedValueOnce({ files: [{ path: undefined as unknown as string }] });
		const result = await scanReceiptQrFromImage();
		expect(result).toBeNull();
		expect(mockReadFromImage).not.toHaveBeenCalled();
	});

	it("returns null when the image contains no QR code", async () => {
		mockReadFromImage.mockResolvedValueOnce({ barcodes: [] });
		const result = await scanReceiptQrFromImage();
		expect(result).toBeNull();
	});

	it("returns null when the picker throws (user cancelled)", async () => {
		mockPickImages.mockRejectedValueOnce(new Error("pickImages canceled"));
		const result = await scanReceiptQrFromImage();
		expect(result).toBeNull();
	});

	it("returns null when readBarcodesFromImage throws", async () => {
		mockReadFromImage.mockRejectedValueOnce(new Error("decode failed"));
		const result = await scanReceiptQrFromImage();
		expect(result).toBeNull();
	});
});
