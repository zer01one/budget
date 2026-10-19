import { Capacitor } from "@capacitor/core";

export function isScannerAvailable(): boolean {
	return Capacitor.isNativePlatform();
}

async function ensureModuleInstalled(
	scanner: typeof import("@capacitor-mlkit/barcode-scanning").BarcodeScanner,
	InstallState: typeof import("@capacitor-mlkit/barcode-scanning").GoogleBarcodeScannerModuleInstallState
): Promise<boolean> {
	const { available } = await scanner.isGoogleBarcodeScannerModuleAvailable();
	if (available) return true;

	return new Promise<boolean>((resolve) => {
		let settled = false;
		scanner.addListener("googleBarcodeScannerModuleInstallProgress", (event) => {
			if (settled) return;
			if (event.state === InstallState.COMPLETED) {
				settled = true;
				resolve(true);
			} else if (event.state === InstallState.FAILED || event.state === InstallState.CANCELED) {
				settled = true;
				resolve(false);
			}
		});
		scanner.installGoogleBarcodeScannerModule();
	});
}

export async function scanReceiptQr(): Promise<string | null> {
	if (!isScannerAvailable()) return null;

	const { BarcodeScanner, BarcodeFormat, GoogleBarcodeScannerModuleInstallState } = await import("@capacitor-mlkit/barcode-scanning");

	const ready = await ensureModuleInstalled(BarcodeScanner, GoogleBarcodeScannerModuleInstallState);
	if (!ready) return null;

	try {
		const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
		return barcodes[0]?.rawValue ?? null;
	} catch {
		return null;
	}
}

export async function scanReceiptQrFromImage(): Promise<string | null> {
	return isScannerAvailable() ? scanImageNative() : scanImageDesktop();
}

// For images that arrive as a Blob directly (drag & drop, clipboard paste).
export async function scanReceiptQrFromBlob(blob: Blob): Promise<string | null> {
	const { decodeQrFromBlob } = await import("@/utils/qrImageDecoder");
	return decodeQrFromBlob(blob);
}

async function scanImageNative(): Promise<string | null> {
	const { FilePicker } = await import("@capawesome/capacitor-file-picker");
	const { BarcodeScanner, BarcodeFormat } = await import("@capacitor-mlkit/barcode-scanning");

	try {
		const { files } = await FilePicker.pickImages({ limit: 1 });
		const path = files[0]?.path;
		if (!path) return null;
		const { barcodes } = await BarcodeScanner.readBarcodesFromImage({ path, formats: [BarcodeFormat.QrCode] });
		return barcodes[0]?.rawValue ?? null;
	} catch {
		return null;
	}
}

// A plain <input type="file"> works in the Tauri WebView without any fs/dialog
// permissions, and decoding happens in JS — no native plugins on desktop.
async function scanImageDesktop(): Promise<string | null> {
	const file = await new Promise<File | null>((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.onchange = () => resolve(input.files?.[0] ?? null);
		input.oncancel = () => resolve(null);
		input.click();
	});
	if (!file) return null;
	return scanReceiptQrFromBlob(file);
}
