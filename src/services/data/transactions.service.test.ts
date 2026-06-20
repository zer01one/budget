import { describe, it, expect, vi, beforeEach } from "vitest";

// transactionsService uses a module-level Map (_lastKnownModified) that persists
// across imports. We reset it between tests by re-importing with vi.resetModules().

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn()
}));

async function freshService() {
	vi.resetModules();
	const mod = await import("./transactions.service");
	return mod.transactionsService;
}

// в”Ђв”Ђ listMonths в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("transactionsService.listMonths вЂ“ filename filtering and sorting", () => {
	beforeEach(() => vi.resetModules());

	it("includes valid YYYY-MM.json filenames", async () => {
		const { getFileSystemAdapter } = await import("@/services/filesystem");
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			listFiles: vi.fn(() => Promise.resolve(["2026-06.json", "2026-05.json"])),
			readJson: vi.fn(),
			writeJson: vi.fn(),
			exportFile: vi.fn(),
			pickFolder: vi.fn(),
			importFile: vi.fn()
		} as never);
		const svc = await freshService();
		const months = await svc.listMonths();
		expect(months).toContain("2026-06");
		expect(months).toContain("2026-05");
	});

	it("strips .json extension from the result", async () => {
		const { getFileSystemAdapter } = await import("@/services/filesystem");
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			listFiles: vi.fn(() => Promise.resolve(["2026-06.json"])),
			readJson: vi.fn(),
			writeJson: vi.fn(),
			exportFile: vi.fn(),
			pickFolder: vi.fn(),
			importFile: vi.fn()
		} as never);
		const svc = await freshService();
		const months = await svc.listMonths();
		expect(months[0]).toBe("2026-06");
		expect(months[0]).not.toContain(".json");
	});

	it("sorts months in descending order (newest first)", async () => {
		const { getFileSystemAdapter } = await import("@/services/filesystem");
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			listFiles: vi.fn(() => Promise.resolve(["2026-03.json", "2026-01.json", "2026-06.json", "2025-12.json"])),
			readJson: vi.fn(),
			writeJson: vi.fn(),
			exportFile: vi.fn(),
			pickFolder: vi.fn(),
			importFile: vi.fn()
		} as never);
		const svc = await freshService();
		const months = await svc.listMonths();
		expect(months).toEqual(["2026-06", "2026-03", "2026-01", "2025-12"]);
	});

	it("excludes files that do not match YYYY-MM.json pattern", async () => {
		const { getFileSystemAdapter } = await import("@/services/filesystem");
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			listFiles: vi.fn(() =>
				Promise.resolve([
					"2026-06.json", // valid
					"readme.txt", // wrong extension
					"202-06.json", // year too short
					"20266-06.json", // year too long
					"2026-6.json", // month not zero-padded
					"2026-06.JSON", // uppercase extension
					"2026-06.json.bak", // extra suffix
					".2026-06.json" // leading dot
				])
			),
			readJson: vi.fn(),
			writeJson: vi.fn(),
			exportFile: vi.fn(),
			pickFolder: vi.fn(),
			importFile: vi.fn()
		} as never);
		const svc = await freshService();
		const months = await svc.listMonths();
		expect(months).toEqual(["2026-06"]);
	});

	it("returns empty array when transactions folder is empty", async () => {
		const { getFileSystemAdapter } = await import("@/services/filesystem");
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			listFiles: vi.fn(() => Promise.resolve([])),
			readJson: vi.fn(),
			writeJson: vi.fn(),
			exportFile: vi.fn(),
			pickFolder: vi.fn(),
			importFile: vi.fn()
		} as never);
		const svc = await freshService();
		expect(await svc.listMonths()).toEqual([]);
	});
});

// в”Ђв”Ђ loadMonth вЂ“ isLoading + conflict detection в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("transactionsService.loadMonth вЂ“ conflict detection", () => {
	beforeEach(() => vi.resetModules());

	it("returns null when file does not exist", async () => {
		const { getFileSystemAdapter } = await import("@/services/filesystem");
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			readJson: vi.fn(() => Promise.resolve(null)),
			writeJson: vi.fn(),
			listFiles: vi.fn(),
			exportFile: vi.fn(),
			pickFolder: vi.fn(),
			importFile: vi.fn()
		} as never);
		const svc = await freshService();
		expect(await svc.loadMonth("2026-06")).toBeNull();
	});

	it("returns transactions without conflict on first load", async () => {
		const { getFileSystemAdapter } = await import("@/services/filesystem");
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			readJson: vi.fn(() =>
				Promise.resolve({
					modifiedAt: "2026-06-01T10:00:00Z",
					data: { month: "2026-06", transactions: [] }
				})
			),
			writeJson: vi.fn(),
			listFiles: vi.fn(),
			exportFile: vi.fn(),
			pickFolder: vi.fn(),
			importFile: vi.fn()
		} as never);
		const svc = await freshService();
		const result = await svc.loadMonth("2026-06");
		expect(result?.conflict).toBeNull();
	});

	it("detects conflict when disk modifiedAt is newer than last known", async () => {
		const { getFileSystemAdapter } = await import("@/services/filesystem");
		const readJson = vi.fn();
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			readJson,
			writeJson: vi.fn(),
			listFiles: vi.fn(),
			exportFile: vi.fn(),
			pickFolder: vi.fn(),
			importFile: vi.fn()
		} as never);

		// First load вЂ” establishes baseline modifiedAt
		readJson.mockResolvedValueOnce({
			modifiedAt: "2026-06-01T10:00:00Z",
			data: { month: "2026-06", transactions: [] }
		});
		const svc = await freshService();
		await svc.loadMonth("2026-06");

		// Second load вЂ” disk has a newer modifiedAt в†’ conflict
		readJson.mockResolvedValueOnce({
			modifiedAt: "2026-06-01T12:00:00Z",
			data: { month: "2026-06", transactions: [] }
		});
		const result = await svc.loadMonth("2026-06");
		expect(result?.conflict).not.toBeNull();
		expect(result?.conflict?.resolvedBy).toBe("disk");
		expect(result?.conflict?.localUpdatedAt).toBe("2026-06-01T10:00:00Z");
		expect(result?.conflict?.diskModifiedAt).toBe("2026-06-01T12:00:00Z");
	});

	it("no conflict when disk modifiedAt matches last known", async () => {
		const { getFileSystemAdapter } = await import("@/services/filesystem");
		const readJson = vi.fn();
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			readJson,
			writeJson: vi.fn(),
			listFiles: vi.fn(),
			exportFile: vi.fn(),
			pickFolder: vi.fn(),
			importFile: vi.fn()
		} as never);
		const payload = { modifiedAt: "2026-06-01T10:00:00Z", data: { month: "2026-06", transactions: [] } };
		readJson.mockResolvedValue(payload);
		const svc = await freshService();
		await svc.loadMonth("2026-06"); // first вЂ” sets baseline
		const result = await svc.loadMonth("2026-06"); // second вЂ” same modifiedAt
		expect(result?.conflict).toBeNull();
	});

	it("filters out isDeleted transactions from returned list", async () => {
		const { getFileSystemAdapter } = await import("@/services/filesystem");
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			readJson: vi.fn(() =>
				Promise.resolve({
					modifiedAt: "2026-06-01T10:00:00Z",
					data: {
						month: "2026-06",
						transactions: [
							{ id: "a", isDeleted: false },
							{ id: "b", isDeleted: true },
							{ id: "c", isDeleted: false }
						]
					}
				})
			),
			writeJson: vi.fn(),
			listFiles: vi.fn(),
			exportFile: vi.fn(),
			pickFolder: vi.fn(),
			importFile: vi.fn()
		} as never);
		const svc = await freshService();
		const result = await svc.loadMonth("2026-06");
		expect(result?.transactions).toHaveLength(2);
		expect(result?.transactions.map((t) => t.id)).toEqual(["a", "c"]);
	});
});

