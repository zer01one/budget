import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_CATEGORIES } from "@/types";
import { vaultService } from "./vault.service";

const { mockReadJson, mockWriteJson } = vi.hoisted(() => ({
	mockReadJson: vi.fn(),
	mockWriteJson: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn().mockResolvedValue({
		readJson: mockReadJson,
		writeJson: mockWriteJson
	})
}));

// ─── computeLevel ─────────────────────────────────────────────────────────────

describe("vaultService.computeLevel", () => {
	it("returns novice at xp=0", () => {
		expect(vaultService.computeLevel(0)).toBe("novice");
	});

	it("stays novice just below apprentice threshold (499)", () => {
		expect(vaultService.computeLevel(499)).toBe("novice");
	});

	it("returns apprentice at xp=500", () => {
		expect(vaultService.computeLevel(500)).toBe("apprentice");
	});

	it("stays apprentice just below practitioner threshold (1499)", () => {
		expect(vaultService.computeLevel(1499)).toBe("apprentice");
	});

	it("returns practitioner at xp=1500", () => {
		expect(vaultService.computeLevel(1500)).toBe("practitioner");
	});

	it("stays practitioner just below expert threshold (2999)", () => {
		expect(vaultService.computeLevel(2999)).toBe("practitioner");
	});

	it("returns expert at xp=3000", () => {
		expect(vaultService.computeLevel(3000)).toBe("expert");
	});

	it("stays expert just below master threshold (5999)", () => {
		expect(vaultService.computeLevel(5999)).toBe("expert");
	});

	it("returns master at xp=6000", () => {
		expect(vaultService.computeLevel(6000)).toBe("master");
	});

	it("stays master well beyond threshold", () => {
		expect(vaultService.computeLevel(99999)).toBe("master");
	});

	it("returns novice for negative xp", () => {
		expect(vaultService.computeLevel(-1)).toBe("novice");
	});

	it("returns novice for xp=1 (still below 500)", () => {
		expect(vaultService.computeLevel(1)).toBe("novice");
	});
});

// ─── readMetadata ─────────────────────────────────────────────────────────────

describe("vaultService.readMetadata", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns null when file does not exist", async () => {
		mockReadJson.mockResolvedValue(null);
		expect(await vaultService.readMetadata()).toBeNull();
	});

	it("reads from metadata.json", async () => {
		mockReadJson.mockResolvedValue(null);
		await vaultService.readMetadata();
		expect(mockReadJson).toHaveBeenCalledWith("metadata.json");
	});

	it("returns the metadata object from the file", async () => {
		const meta = {
			appVersion: "0.1.0",
			schemaVersion: 1,
			deviceId: "dev-1",
			createdAt: "2026-01-01T00:00:00.000Z",
			vaultName: "Мои финансы",
			updatedAt: "2026-01-01T00:00:00.000Z",
			version: 1
		};
		mockReadJson.mockResolvedValue({ data: { metadata: meta }, modifiedAt: "2026-01-01T00:00:00.000Z" });
		expect(await vaultService.readMetadata()).toEqual(meta);
	});
});

// ─── initNewVault ─────────────────────────────────────────────────────────────

describe("vaultService.initNewVault", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockWriteJson.mockResolvedValue(undefined);
	});

	it("writes exactly 5 files", async () => {
		await vaultService.initNewVault("device-1");
		expect(mockWriteJson).toHaveBeenCalledTimes(5);
	});

	it("writes metadata.json first with correct structure", async () => {
		await vaultService.initNewVault("device-42");
		const [path, data] = mockWriteJson.mock.calls[0];
		expect(path).toBe("metadata.json");
		expect(data.metadata.deviceId).toBe("device-42");
		expect(data.metadata.appVersion).toBe("0.1.0");
		expect(data.metadata.schemaVersion).toBe(1);
		expect(data.metadata.vaultName).toBe("Мои финансы");
		expect(data.metadata.version).toBe(1);
		expect(data.metadata.createdAt).toBe(data.metadata.updatedAt);
		expect(new Date(data.metadata.createdAt).getTime()).not.toBeNaN();
	});

	it("writes categories.json second with all DEFAULT_CATEGORIES seeded", async () => {
		await vaultService.initNewVault("device-1");
		const [path, data] = mockWriteJson.mock.calls[1];
		expect(path).toBe("categories.json");
		expect(data.categories).toHaveLength(DEFAULT_CATEGORIES.length);
	});

	it("each category maps seed fields correctly", async () => {
		await vaultService.initNewVault("device-1");
		const [, data] = mockWriteJson.mock.calls[1];
		data.categories.forEach((cat: ReturnType<typeof Object.assign>, i: number) => {
			const seed = DEFAULT_CATEGORIES[i];
			expect(cat.name).toBe(seed.name);
			expect(cat.type).toBe(seed.type);
			expect(cat.color).toBe(seed.color);
			expect(cat.icon).toBe(seed.icon);
		});
	});

	it("each category has correct fixed fields", async () => {
		await vaultService.initNewVault("device-1");
		const [, data] = mockWriteJson.mock.calls[1];
		data.categories.forEach((cat: ReturnType<typeof Object.assign>) => {
			expect(cat.parentId).toBeNull();
			expect(cat.isSystem).toBe(true);
			expect(cat.isArchived).toBe(false);
			expect(cat.version).toBe(1);
			expect(cat.deviceId).toBe("device-1");
			expect(cat.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
		});
	});

	it("categories have sequential sortOrder", async () => {
		await vaultService.initNewVault("device-1");
		const [, data] = mockWriteJson.mock.calls[1];
		data.categories.forEach((cat: ReturnType<typeof Object.assign>, i: number) => {
			expect(cat.sortOrder).toBe(i);
		});
	});

	it("writes accounts.json third with empty accounts array", async () => {
		await vaultService.initNewVault("device-1");
		const [path, data] = mockWriteJson.mock.calls[2];
		expect(path).toBe("accounts.json");
		expect(data.accounts).toEqual([]);
	});

	it("writes budgets.json fourth with empty budgets array", async () => {
		await vaultService.initNewVault("device-1");
		const [path, data] = mockWriteJson.mock.calls[3];
		expect(path).toBe("budgets.json");
		expect(data.budgets).toEqual([]);
	});

	it("writes gamification.json fifth with zeroed initial state", async () => {
		await vaultService.initNewVault("device-1");
		const [path, data] = mockWriteJson.mock.calls[4];
		expect(path).toBe("gamification.json");
		const g = data.gamification;
		expect(g.xp).toBe(0);
		expect(g.level).toBe("novice");
		expect(g.currentStreak).toBe(0);
		expect(g.longestStreak).toBe(0);
		expect(g.lastLoggedDate).toBeNull();
		expect(g.totalTransactions).toBe(0);
		expect(g.categoriesCreated).toBe(0);
		expect(g.budgetsKept).toBe(0);
		expect(g.deviceId).toBe("device-1");
		expect(g.version).toBe(1);
	});

	it("gamification has all 6 achievements with null unlock state", async () => {
		await vaultService.initNewVault("device-1");
		const [, data] = mockWriteJson.mock.calls[4];
		const achievements = data.gamification.achievements;
		expect(achievements).toHaveLength(6);
		const keys = achievements.map((a: ReturnType<typeof Object.assign>) => a.key);
		expect(keys).toContain("first_transaction");
		expect(keys).toContain("streak_7");
		expect(keys).toContain("streak_30");
		expect(keys).toContain("budget_keeper");
		expect(keys).toContain("century");
		expect(keys).toContain("category_master");
		achievements.forEach((a: ReturnType<typeof Object.assign>) => {
			expect(a.unlockedAt).toBeNull();
			expect(a.progress).toBe(0);
			expect(a.notifiedAt).toBeNull();
		});
	});

	it("all written records share the same timestamp", async () => {
		await vaultService.initNewVault("device-1");
		const metaNow = mockWriteJson.mock.calls[0][1].metadata.createdAt;
		const catNow = mockWriteJson.mock.calls[1][1].categories[0].updatedAt;
		const gamNow = mockWriteJson.mock.calls[4][1].gamification.updatedAt;
		expect(metaNow).toBe(catNow);
		expect(metaNow).toBe(gamNow);
	});

	it("uses the provided deviceId across all written records", async () => {
		await vaultService.initNewVault("my-device");
		expect(mockWriteJson.mock.calls[0][1].metadata.deviceId).toBe("my-device");
		mockWriteJson.mock.calls[1][1].categories.forEach((cat: ReturnType<typeof Object.assign>) => {
			expect(cat.deviceId).toBe("my-device");
		});
		expect(mockWriteJson.mock.calls[4][1].gamification.deviceId).toBe("my-device");
	});
});
