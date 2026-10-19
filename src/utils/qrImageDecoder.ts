/**
 * Decodes a QR code from an image blob entirely in JS (jsqr) — works in any
 * WebView, no camera, no native plugins, no network.
 */
export async function decodeQrFromBlob(blob: Blob): Promise<string | null> {
	try {
		const bitmap = await createImageBitmap(blob);
		const canvas = document.createElement("canvas");
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;
		ctx.drawImage(bitmap, 0, 0);
		const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
		const { default: jsQR } = await import("jsqr");
		const result = jsQR(imageData.data, imageData.width, imageData.height);
		return result?.data ?? null;
	} catch {
		return null;
	}
}
