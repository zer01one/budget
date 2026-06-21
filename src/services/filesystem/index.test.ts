import { describe, it, expect, vi } from "vitest";

const { mockIsNativePlatform, mockSetTauriVaultPath, mockSetCapacitorVaultUri } = vi.hoisted(() => ({
	mockIsNativePlatform: vi.fn(() => false),
	mockSetTauriVaultPath: vi.fn(),
	mockSetCapacitorVaultUri: vi.fn()
}));

vi.mock("@capacitor/core", () => ({
	Capacitor: { isNativePlatform: mockIsNativePlatform }
}));

vi.mock("./tauri.adapter", () => ({
	TauriAdapter: class TauriAdapter {
		_type = "tauri";
	},
	setTauriVaultPath: mockSetTauriVaultPath
}));

vi.mock("./capacitor.adapter", () => ({
	CapacitorAdapter: class CapacitorAdapter {
		_type = "capacitor";
	},
	setCapacitorVaultUri: mockSetCapacitorVaultUri
}));

// vi.resetModules() resets module INSTANCES but NOT mock factory registrations.
// The mocks above remain active after resetModules().
async function freshIndex() {
	vi.resetModules();
	return await import("./index");
}

describe("getFileSystemAdapter – Tauri path", () => {
	it("creates TauriAdapter when isNativePlatform = false", async () => {
		mockIsNativePlatform.mockReturnValue(false);
		const { getFileSystemAdapter } = await freshIndex();
		const adapter = await getFileSystemAdapter();
		expect((adapter as unknown as { _type: string })._type).toBe("tauri");
	});

	it("returns a truthy adapter", async () => {
		mockIsNativePlatform.mockReturnValue(false);
		const { getFileSystemAdapter } = await freshIndex();
		const adapter = await getFileSystemAdapter();
		expect(adapter).toBeTruthy();
	});
});

describe("getFileSystemAdapter – Capacitor path", () => {
	it("creates CapacitorAdapter when isNativePlatform = true", async () => {
		mockIsNativePlatform.mockReturnValue(true);
		const { getFileSystemAdapter } = await freshIndex();
		const adapter = await getFileSystemAdapter();
		expect((adapter as unknown as { _type: string })._type).toBe("capacitor");
		mockIsNativePlatform.mockReturnValue(false);
	});
});

describe("getFileSystemAdapter – singleton", () => {
	it("second call returns the same instance", async () => {
		mockIsNativePlatform.mockReturnValue(false);
		const { getFileSystemAdapter } = await freshIndex();
		const a1 = await getFileSystemAdapter();
		const a2 = await getFileSystemAdapter();
		expect(a1).toBe(a2);
	});
});

describe("setVaultPath", () => {
	it("calls setTauriVaultPath when not native", async () => {
		mockIsNativePlatform.mockReturnValue(false);
		const { setVaultPath } = await freshIndex();
		mockSetTauriVaultPath.mockClear();
		await setVaultPath("/some/path");
		expect(mockSetTauriVaultPath).toHaveBeenCalledWith("/some/path");
	});

	it("calls setCapacitorVaultUri when native", async () => {
		mockIsNativePlatform.mockReturnValue(true);
		const { setVaultPath } = await freshIndex();
		mockSetCapacitorVaultUri.mockClear();
		await setVaultPath("content://uri/path");
		expect(mockSetCapacitorVaultUri).toHaveBeenCalledWith("content://uri/path");
		mockIsNativePlatform.mockReturnValue(false);
	});
});
