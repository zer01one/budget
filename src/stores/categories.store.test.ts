import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useCategoriesStore } from "./categories.store";
import { getFileSystemAdapter } from "@/services/filesystem";
import type { Category } from "@/types";

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn(() =>
		Promise.resolve({
			readJson: vi.fn(() => Promise.resolve(null)),
			writeJson: vi.fn(() => Promise.resolve())
		})
	)
}));

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({ settings: { deviceId: "device-x" } }))
}));

function makeCat(overrides: Partial<Category> = {}): Category {
	return {
		id: "cat-1",
		name: "Food",
		type: "expense",
		color: "#ff0000",
		icon: "food",
		parentId: null,
		isSystem: false,
		isArchived: false,
		sortOrder: 0,
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "dev",
		version: 1,
		...overrides
	};
}

type AddInput = Omit<Category, "id" | "updatedAt" | "deviceId" | "version" | "isSystem">;

function makeInput(overrides: Partial<AddInput> = {}): AddInput {
	return {
		name: "New Cat",
		type: "expense",
		color: "#aabbcc",
		icon: "default",
		parentId: null,
		isArchived: false,
		sortOrder: 0,
		...overrides
	};
}

// в”Ђв”Ђ expenseCategories в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("expenseCategories", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("returns only expense + non-archived categories", () => {
		const store = useCategoriesStore();
		store.categories = [
			makeCat({ id: "1", type: "expense", isArchived: false }),
			makeCat({ id: "2", type: "income", isArchived: false }),
			makeCat({ id: "3", type: "expense", isArchived: true })
		];
		expect(store.expenseCategories).toHaveLength(1);
		expect(store.expenseCategories[0].id).toBe("1");
	});

	it("returns empty when no expense categories", () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ type: "income" })];
		expect(store.expenseCategories).toHaveLength(0);
	});
});

// в”Ђв”Ђ incomeCategories в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("incomeCategories", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("returns only income + non-archived categories", () => {
		const store = useCategoriesStore();
		store.categories = [
			makeCat({ id: "1", type: "income", isArchived: false }),
			makeCat({ id: "2", type: "expense", isArchived: false }),
			makeCat({ id: "3", type: "income", isArchived: true })
		];
		expect(store.incomeCategories).toHaveLength(1);
		expect(store.incomeCategories[0].id).toBe("1");
	});
});

// в”Ђв”Ђ byType в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("byType", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("filters by expense type", () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "e", type: "expense" }), makeCat({ id: "i", type: "income" })];
		const result = store.byType("expense");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("e");
	});

	it("filters by income type", () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "e", type: "expense" }), makeCat({ id: "i", type: "income" })];
		expect(store.byType("income")).toHaveLength(1);
	});

	it("filters by transfer type", () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "t", type: "transfer" }), makeCat({ id: "e", type: "expense" })];
		const result = store.byType("transfer");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("t");
	});

	it("excludes archived categories", () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ type: "expense", isArchived: true }), makeCat({ id: "2", type: "expense", isArchived: false })];
		expect(store.byType("expense")).toHaveLength(1);
	});

	it("returns empty array when no matches", () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ type: "expense" })];
		expect(store.byType("income")).toHaveLength(0);
	});
});

// в”Ђв”Ђ getById в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("getById", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("returns category by id", () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "target" })];
		expect(store.getById("target")?.id).toBe("target");
	});

	it("returns undefined for unknown id", () => {
		const store = useCategoriesStore();
		expect(store.getById("nope")).toBeUndefined();
	});
});

// в”Ђв”Ђ addCategory в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("addCategory", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("adds category to the array", async () => {
		const store = useCategoriesStore();
		await store.addCategory(makeInput());
		expect(store.categories).toHaveLength(1);
	});

	it("always sets isSystem to false", async () => {
		const store = useCategoriesStore();
		const result = await store.addCategory(makeInput());
		expect(result.isSystem).toBe(false);
	});

	it("sets version to 1", async () => {
		const store = useCategoriesStore();
		const result = await store.addCategory(makeInput());
		expect(result.version).toBe(1);
	});

	it("sets deviceId from settings", async () => {
		const store = useCategoriesStore();
		const result = await store.addCategory(makeInput());
		expect(result.deviceId).toBe("device-x");
	});

	it("assigns a non-empty UUID", async () => {
		const store = useCategoriesStore();
		const result = await store.addCategory(makeInput());
		expect(result.id).toMatch(/^[0-9a-f-]{36}$/i);
	});

	it("preserves name, type, color, icon, parentId, sortOrder", async () => {
		const store = useCategoriesStore();
		const input = makeInput({ name: "Travel", type: "expense", color: "#123456", icon: "plane", parentId: "parent-1", sortOrder: 5 });
		const result = await store.addCategory(input);
		expect(result.name).toBe("Travel");
		expect(result.type).toBe("expense");
		expect(result.color).toBe("#123456");
		expect(result.icon).toBe("plane");
		expect(result.parentId).toBe("parent-1");
		expect(result.sortOrder).toBe(5);
	});

	it("each call generates a unique id", async () => {
		const store = useCategoriesStore();
		const a = await store.addCategory(makeInput());
		const b = await store.addCategory(makeInput());
		expect(a.id).not.toBe(b.id);
	});
});

// в”Ђв”Ђ updateCategory в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("updateCategory", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("updates the specified field", async () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "a", name: "Old" })];
		await store.updateCategory("a", { name: "New" });
		expect(store.categories[0].name).toBe("New");
	});

	it("bumps version by 1", async () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "a", version: 2 })];
		await store.updateCategory("a", { color: "#fff" });
		expect(store.categories[0].version).toBe(3);
	});

	it("sets deviceId from settings", async () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "a", deviceId: "old" })];
		await store.updateCategory("a", { name: "X" });
		expect(store.categories[0].deviceId).toBe("device-x");
	});

	it("does nothing when id not found", async () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "a", name: "Original" })];
		await store.updateCategory("missing", { name: "Changed" });
		expect(store.categories[0].name).toBe("Original");
	});

	it("does not touch other categories", async () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "a" }), makeCat({ id: "b", name: "B" })];
		await store.updateCategory("a", { name: "X" });
		expect(store.categories[1].name).toBe("B");
	});
});

// в”Ђв”Ђ deleteCategory в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("deleteCategory", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("archives a non-system category (soft delete)", async () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "a", isSystem: false, isArchived: false })];
		await store.deleteCategory("a");
		expect(store.categories[0].isArchived).toBe(true);
	});

	it("keeps the category in the array (does not hard-delete)", async () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "a", isSystem: false })];
		await store.deleteCategory("a");
		expect(store.categories).toHaveLength(1);
	});

	it("DOES NOT archive system categories вЂ” guard is active", async () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "sys", isSystem: true, isArchived: false })];
		await store.deleteCategory("sys");
		expect(store.categories[0].isArchived).toBe(false);
	});

	it("system category stays in expenseCategories after delete attempt", async () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "sys", isSystem: true, type: "expense", isArchived: false })];
		await store.deleteCategory("sys");
		expect(store.expenseCategories).toHaveLength(1);
	});

	it("archived category disappears from byType", async () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "a", type: "expense", isSystem: false })];
		await store.deleteCategory("a");
		expect(store.byType("expense")).toHaveLength(0);
	});

	it("does nothing for unknown id", async () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "a", isArchived: false })];
		await store.deleteCategory("missing");
		expect(store.categories[0].isArchived).toBe(false);
	});

	it("does not affect other categories", async () => {
		const store = useCategoriesStore();
		store.categories = [makeCat({ id: "a", isSystem: false }), makeCat({ id: "b", isArchived: false })];
		await store.deleteCategory("a");
		expect(store.categories.find((c) => c.id === "b")?.isArchived).toBe(false);
	});
});

// ── load ──────────────────────────────────────────────────────────────────────

describe("load", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("sets isLoaded to true when readJson returns null", async () => {
		const store = useCategoriesStore();
		expect(store.isLoaded).toBe(false);
		await store.load();
		expect(store.isLoaded).toBe(true);
	});

	it("keeps categories empty when readJson returns null", async () => {
		const store = useCategoriesStore();
		await store.load();
		expect(store.categories).toHaveLength(0);
	});

	it("populates categories when readJson returns data", async () => {
		const stored = [makeCat({ id: "from-file" })];
		vi.mocked(getFileSystemAdapter).mockResolvedValueOnce({
			readJson: vi.fn().mockResolvedValue({ data: { categories: stored }, modifiedAt: "2026-01-01T00:00:00Z" }),
			writeJson: vi.fn().mockResolvedValue(undefined)
		} as any);
		const store = useCategoriesStore();
		await store.load();
		expect(store.categories).toHaveLength(1);
		expect(store.categories[0].id).toBe("from-file");
	});

	it("sets isLoaded to true after loading data", async () => {
		const stored = [makeCat()];
		vi.mocked(getFileSystemAdapter).mockResolvedValueOnce({
			readJson: vi.fn().mockResolvedValue({ data: { categories: stored }, modifiedAt: "2026-01-01T00:00:00Z" }),
			writeJson: vi.fn().mockResolvedValue(undefined)
		} as any);
		const store = useCategoriesStore();
		await store.load();
		expect(store.isLoaded).toBe(true);
	});

	it("does not overwrite categories when load called twice and second returns null", async () => {
		const stored = [makeCat({ id: "first" })];
		vi.mocked(getFileSystemAdapter).mockResolvedValueOnce({
			readJson: vi.fn().mockResolvedValue({ data: { categories: stored }, modifiedAt: "2026-01-01T00:00:00Z" }),
			writeJson: vi.fn().mockResolvedValue(undefined)
		} as any);
		const store = useCategoriesStore();
		await store.load();
		await store.load();
		expect(store.categories).toHaveLength(1);
	});
});

// ── save ──────────────────────────────────────────────────────────────────────

describe("save", () => {
	beforeEach(() => setActivePinia(createPinia()));

	it("calls writeJson with current categories", async () => {
		const mockWriteJson = vi.fn().mockResolvedValue(undefined);
		vi.mocked(getFileSystemAdapter).mockResolvedValueOnce({
			readJson: vi.fn().mockResolvedValue(null),
			writeJson: mockWriteJson
		} as any);
		const store = useCategoriesStore();
		const cat = makeCat({ id: "x" });
		store.categories = [cat];
		await store.save();
		expect(mockWriteJson).toHaveBeenCalledWith("categories.json", { categories: [cat] });
	});

	it("calls writeJson with empty array when no categories", async () => {
		const mockWriteJson = vi.fn().mockResolvedValue(undefined);
		vi.mocked(getFileSystemAdapter).mockResolvedValueOnce({
			readJson: vi.fn().mockResolvedValue(null),
			writeJson: mockWriteJson
		} as any);
		const store = useCategoriesStore();
		await store.save();
		expect(mockWriteJson).toHaveBeenCalledWith("categories.json", { categories: [] });
	});
});
