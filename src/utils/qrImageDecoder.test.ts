import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { decodeQrFromBlob } from "./qrImageDecoder";

const { mockJsQR } = vi.hoisted(() => ({
	mockJsQR: vi.fn()
}));

vi.mock("jsqr", () => ({ default: mockJsQR }));

const IMAGE_DATA = { data: new Uint8ClampedArray(4), width: 2, height: 2 };

let mockDrawImage: ReturnType<typeof vi.fn>;
let mockGetImageData: ReturnType<typeof vi.fn>;
let createElementOriginal: typeof document.createElement;

beforeEach(() => {
	vi.clearAllMocks();
	mockJsQR.mockReturnValue({ data: "decoded-qr-payload" });

	vi.stubGlobal(
		"createImageBitmap",
		vi.fn(async () => ({ width: 2, height: 2, close: vi.fn() }))
	);

	mockDrawImage = vi.fn();
	mockGetImageData = vi.fn(() => IMAGE_DATA);
	createElementOriginal = document.createElement.bind(document);
	vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
		if (tag === "canvas") {
			return {
				width: 0,
				height: 0,
				getContext: vi.fn(() => ({ drawImage: mockDrawImage, getImageData: mockGetImageData }))
			} as unknown as HTMLCanvasElement;
		}
		return createElementOriginal(tag);
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("decodeQrFromBlob", () => {
	it("draws the bitmap on a canvas and returns the decoded QR payload", async () => {
		const result = await decodeQrFromBlob(new Blob(["fake-image"]));
		expect(result).toBe("decoded-qr-payload");
		expect(mockDrawImage).toHaveBeenCalledOnce();
		expect(mockJsQR).toHaveBeenCalledWith(IMAGE_DATA.data, 2, 2);
	});

	it("returns null when no QR code is found in the image", async () => {
		mockJsQR.mockReturnValue(null);
		const result = await decodeQrFromBlob(new Blob(["fake-image"]));
		expect(result).toBeNull();
	});

	it("returns null when the blob is not a decodable image", async () => {
		vi.stubGlobal(
			"createImageBitmap",
			vi.fn(async () => {
				throw new Error("not an image");
			})
		);
		const result = await decodeQrFromBlob(new Blob(["garbage"]));
		expect(result).toBeNull();
	});

	it("returns null when the canvas 2d context is unavailable", async () => {
		vi.mocked(document.createElement).mockImplementation((tag: string) => {
			if (tag === "canvas") {
				return { width: 0, height: 0, getContext: vi.fn(() => null) } as unknown as HTMLCanvasElement;
			}
			return createElementOriginal(tag);
		});
		const result = await decodeQrFromBlob(new Blob(["fake-image"]));
		expect(result).toBeNull();
	});
});
