import { describe, it, expect, beforeEach, vi } from "vitest";

const mockIsNativePlatform = vi.fn(() => false);
vi.mock("@capacitor/core", () => ({
	Capacitor: { isNativePlatform: mockIsNativePlatform }
}));

const mockCheck = vi.fn();
vi.mock("@tauri-apps/plugin-updater", () => ({
	check: mockCheck
}));

async function freshUpdater() {
	vi.resetModules();
	const mod = await import("./useUpdater");
	return mod.useUpdater();
}

describe("useUpdater – dismissUpdate", () => {
	it("clears updateAvailable", async () => {
		const { updateAvailable, dismissUpdate } = await freshUpdater();
		updateAvailable.value = { version: "2.0.0", body: "New features" };
		dismissUpdate();
		expect(updateAvailable.value).toBeNull();
	});

	it("is idempotent when already null", async () => {
		const { updateAvailable, dismissUpdate } = await freshUpdater();
		expect(updateAvailable.value).toBeNull();
		dismissUpdate();
		expect(updateAvailable.value).toBeNull();
	});
});

describe("useUpdater – installUpdate", () => {
	it("does not set isInstalling when updateAvailable is null", async () => {
		const { isInstalling, installUpdate } = await freshUpdater();
		await installUpdate();
		expect(isInstalling.value).toBe(false);
	});

	it("does not call check() when updateAvailable is null", async () => {
		mockCheck.mockClear();
		const { installUpdate } = await freshUpdater();
		await installUpdate();
		expect(mockCheck).not.toHaveBeenCalled();
	});

	it("sets isInstalling=false after completion", async () => {
		const downloadAndInstall = vi.fn(async () => {});
		mockCheck.mockResolvedValueOnce({ available: true, downloadAndInstall });
		const { updateAvailable, isInstalling, installUpdate } = await freshUpdater();
		updateAvailable.value = { version: "2.0.0", body: "" };
		await installUpdate();
		expect(isInstalling.value).toBe(false);
	});

	it("sets isInstalling=false even on error", async () => {
		mockCheck.mockRejectedValueOnce(new Error("network error"));
		const { updateAvailable, isInstalling, installUpdate } = await freshUpdater();
		updateAvailable.value = { version: "2.0.0", body: "" };
		await installUpdate();
		expect(isInstalling.value).toBe(false);
	});

	it("sets updateError when exception thrown", async () => {
		mockCheck.mockRejectedValueOnce(new Error("install failed"));
		const { updateAvailable, updateError, installUpdate } = await freshUpdater();
		updateAvailable.value = { version: "2.0.0", body: "" };
		await installUpdate();
		expect(updateError.value).toBe("install failed");
	});

	it("sets updateError as generic string for non-Error exceptions", async () => {
		mockCheck.mockRejectedValueOnce("string error");
		const { updateAvailable, updateError, installUpdate } = await freshUpdater();
		updateAvailable.value = { version: "2.0.0", body: "" };
		await installUpdate();
		expect(updateError.value).toBeTruthy();
	});
});

describe("useUpdater – checkForUpdates", () => {
	beforeEach(() => mockCheck.mockReset());

	it("does nothing when __TAURI_INTERNALS__ is undefined", async () => {
		delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
		const { checkForUpdates } = await freshUpdater();
		await checkForUpdates();
		expect(mockCheck).not.toHaveBeenCalled();
	});

	it("does nothing when on native Capacitor platform", async () => {
		mockIsNativePlatform.mockReturnValue(true);
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
		const { checkForUpdates } = await freshUpdater();
		await checkForUpdates();
		expect(mockCheck).not.toHaveBeenCalled();
		mockIsNativePlatform.mockReturnValue(false);
		delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
	});

	it("calls check() when on Tauri desktop", async () => {
		mockIsNativePlatform.mockReturnValue(false);
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
		mockCheck.mockResolvedValueOnce(null);
		const { checkForUpdates } = await freshUpdater();
		await checkForUpdates();
		expect(mockCheck).toHaveBeenCalledOnce();
		delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
	});

	it("sets updateAvailable when update is available", async () => {
		mockIsNativePlatform.mockReturnValue(false);
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
		mockCheck.mockResolvedValueOnce({ available: true, version: "3.0.0", body: "Fixes" });
		const { updateAvailable, checkForUpdates } = await freshUpdater();
		await checkForUpdates();
		expect(updateAvailable.value).toEqual({ version: "3.0.0", body: "Fixes" });
		delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
	});

	it("does not set updateAvailable when update.available is false", async () => {
		mockIsNativePlatform.mockReturnValue(false);
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
		mockCheck.mockResolvedValueOnce({ available: false });
		const { updateAvailable, checkForUpdates } = await freshUpdater();
		await checkForUpdates();
		expect(updateAvailable.value).toBeNull();
		delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
	});

	it("silently swallows errors from check()", async () => {
		mockIsNativePlatform.mockReturnValue(false);
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
		mockCheck.mockRejectedValueOnce(new Error("endpoint not configured"));
		const { checkForUpdates } = await freshUpdater();
		await expect(checkForUpdates()).resolves.toBeUndefined();
		delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
	});

	it("uses version fallback 'новая версия' when version is null", async () => {
		mockIsNativePlatform.mockReturnValue(false);
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
		mockCheck.mockResolvedValueOnce({ available: true, version: null, body: null });
		const { updateAvailable, checkForUpdates } = await freshUpdater();
		await checkForUpdates();
		expect(updateAvailable.value?.version).toBe("новая версия");
		expect(updateAvailable.value?.body).toBe("");
		delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
	});
});
