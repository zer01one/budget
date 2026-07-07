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
