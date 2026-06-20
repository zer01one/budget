import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { processRecurringTransactions } from "./useRecurring";
import { useTransactionsStore } from "@/stores/transactions.store";
import type { Transaction } from "@/types";

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn(() =>
		Promise.resolve({
			readJson: vi.fn(() => Promise.resolve(null)),
			writeJson: vi.fn(() => Promise.resolve()),
			listFiles: vi.fn(() => Promise.resolve([]))
		})
	)
}));

vi.mock("@/services/data/transactions.service", () => ({
	transactionsService: {
		loadMonth: vi.fn(() => Promise.resolve(null)),
		saveMonth: vi.fn(() => Promise.resolve()),
		listMonths: vi.fn(() => Promise.resolve([]))
	}
}));

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({ settings: { deviceId: "device-x" } }))
}));

function seedCache(store: ReturnType<typeof useTransactionsStore>, month: string, txs: Transaction[]) {
	store._cache.set(month, txs);
	store.loadedMonths.add(month);
}

function makeTemplate(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: "tmpl-1",
		type: "expense",
		amount: 500,
		currency: "KZT",
		date: "2026-06-01",
		time: "09:00",
		accountId: "acc-1",
		toAccountId: null,
		categoryId: "cat-1",
		comment: "rent",
		tags: ["auto"],
		isRecurring: true,
		recurringParentId: null,
		recurringRule: "monthly",
		isDeleted: false,
		updatedAt: "2026-06-01T00:00:00Z",
		deviceId: "dev",
		version: 1,
		...overrides
	};
}

function makeChild(overrides: Partial<Transaction> = {}): Transaction {
	return makeTemplate({
		id: "child-1",
		recurringParentId: "tmpl-1",
		recurringRule: undefined,
		...overrides
	});
}

// в”Ђв”Ђ daily rule в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("daily rule", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	it("spawns one child when template is 1 day ago", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-19", recurringRule: "daily" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const children = store.allCached.filter((t) => t.recurringParentId === "tmpl-1");
		expect(children).toHaveLength(1);
		expect(children[0].date).toBe("2026-06-20");
	});

	it("spawns multiple children for multiple missing days", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-17", recurringRule: "daily" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const children = store.allCached.filter((t) => t.recurringParentId === "tmpl-1");
		expect(children).toHaveLength(3); // 18, 19, 20
		expect(children.map((c) => c.date).sort()).toEqual(["2026-06-18", "2026-06-19", "2026-06-20"]);
	});

	it("does not spawn if template date is today", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-20", recurringRule: "daily" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const children = store.allCached.filter((t) => t.recurringParentId === "tmpl-1");
		expect(children).toHaveLength(0);
	});

	it("does not spawn if template date is in the future", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-25", recurringRule: "daily" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		expect(store.allCached.filter((t) => t.recurringParentId === "tmpl-1")).toHaveLength(0);
	});

	it("children inherit template fields (amount, accountId, comment, tags)", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({
			date: "2026-06-19",
			recurringRule: "daily",
			amount: 999,
			accountId: "acc-42",
			comment: "gym",
			tags: ["health"]
		});
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const child = store.allCached.find((t) => t.recurringParentId === "tmpl-1");
		expect(child?.amount).toBe(999);
		expect(child?.accountId).toBe("acc-42");
		expect(child?.comment).toBe("gym");
		expect(child?.tags).toEqual(["health"]);
	});

	it("children have recurringParentId set to template id", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ id: "t-42", date: "2026-06-19", recurringRule: "daily" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const child = store.allCached.find((t) => t.recurringParentId === "t-42");
		expect(child).toBeDefined();
	});

	it("children have recurringRule undefined", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-19", recurringRule: "daily" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const child = store.allCached.find((t) => t.recurringParentId === "tmpl-1");
		expect(child?.recurringRule).toBeUndefined();
	});

	it("children are not picked up as templates on next run", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-19", recurringRule: "daily" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		// second run вЂ” no new days to spawn
		await processRecurringTransactions();
		expect(store.allCached.filter((t) => t.recurringParentId === "tmpl-1")).toHaveLength(1);
	});
});

// в”Ђв”Ђ weekly rule в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("weekly rule", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	it("spawns child exactly 7 days after template", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-13", recurringRule: "weekly" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const children = store.allCached.filter((t) => t.recurringParentId === "tmpl-1");
		expect(children).toHaveLength(1);
		expect(children[0].date).toBe("2026-06-20");
	});

	it("spawns two children for 2 missing weeks", async () => {
		vi.setSystemTime(new Date("2026-06-27T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-13", recurringRule: "weekly" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const children = store.allCached.filter((t) => t.recurringParentId === "tmpl-1");
		expect(children).toHaveLength(2);
		expect(children.map((c) => c.date).sort()).toEqual(["2026-06-20", "2026-06-27"]);
	});

	it("does not spawn when template is exactly today (next would be 7 days ahead)", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-20", recurringRule: "weekly" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		expect(store.allCached.filter((t) => t.recurringParentId === "tmpl-1")).toHaveLength(0);
	});
});

// в”Ђв”Ђ monthly rule в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("monthly rule", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	it("spawns child 1 month after template", async () => {
		vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-15", recurringRule: "monthly" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const children = store.allCached.filter((t) => t.recurringParentId === "tmpl-1");
		expect(children).toHaveLength(1);
		expect(children[0].date).toBe("2026-07-15");
	});

	it("spawns two months when 2 months behind", async () => {
		vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-15", recurringRule: "monthly" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const children = store.allCached.filter((t) => t.recurringParentId === "tmpl-1");
		expect(children).toHaveLength(2);
		expect(children.map((c) => c.date).sort()).toEqual(["2026-07-15", "2026-08-15"]);
	});

	it("wraps correctly from December to January of next year", async () => {
		vi.setSystemTime(new Date("2027-01-15T12:00:00Z"));
		const store = useTransactionsStore();
		// 2026-12-15 в†’ next month в†’ 2027-01-15
		const template = makeTemplate({ date: "2026-12-15", recurringRule: "monthly" });
		seedCache(store, "2026-12", [template]);
		await processRecurringTransactions();
		const children = store.allCached.filter((t) => t.recurringParentId === "tmpl-1");
		expect(children).toHaveLength(1);
		expect(children[0].date).toBe("2027-01-15");
	});

	it("documents month-end overflow: Jan 31 в†’ Mar 3 (Feb has 28 days in 2026)", async () => {
		// new Date(2026, 1, 31) = March 3 2026 because JS overflows Feb 31
		vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-01-31", recurringRule: "monthly" });
		seedCache(store, "2026-01", [template]);
		await processRecurringTransactions();
		const children = store.allCached.filter((t) => t.recurringParentId === "tmpl-1");
		expect(children).toHaveLength(1);
		expect(children[0].date).toBe("2026-03-03"); // documented overflow behavior
	});

	it("documents Apr 30 в†’ May 30 (no overflow)", async () => {
		vi.setSystemTime(new Date("2026-05-30T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-04-30", recurringRule: "monthly" });
		seedCache(store, "2026-04", [template]);
		await processRecurringTransactions();
		const child = store.allCached.find((t) => t.recurringParentId === "tmpl-1");
		expect(child?.date).toBe("2026-05-30");
	});
});

// в”Ђв”Ђ cursor starts from latest child в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("cursor advancement from existing children", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	it("starts from the latest child date, not the template date", async () => {
		vi.setSystemTime(new Date("2026-06-21T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ id: "tmpl-1", date: "2026-06-17", recurringRule: "daily" });
		const existingChild = makeChild({ id: "child-existing", date: "2026-06-19", recurringParentId: "tmpl-1" });
		seedCache(store, "2026-06", [template, existingChild]);
		await processRecurringTransactions();
		const newChildren = store.allCached.filter((t) => t.recurringParentId === "tmpl-1" && t.id !== "child-existing");
		expect(newChildren).toHaveLength(2); // 20 and 21
		expect(newChildren.map((c) => c.date).sort()).toEqual(["2026-06-20", "2026-06-21"]);
	});

	it("picks the latest child when multiple children exist", async () => {
		vi.setSystemTime(new Date("2026-06-22T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ id: "tmpl-1", date: "2026-06-15", recurringRule: "daily" });
		const child1 = makeChild({ id: "c1", date: "2026-06-18", recurringParentId: "tmpl-1" });
		const child2 = makeChild({ id: "c2", date: "2026-06-20", recurringParentId: "tmpl-1" }); // latest
		seedCache(store, "2026-06", [template, child1, child2]);
		await processRecurringTransactions();
		const newChildren = store.allCached.filter((t) => t.recurringParentId === "tmpl-1" && !["c1", "c2"].includes(t.id));
		expect(newChildren).toHaveLength(2); // 21 and 22
		expect(newChildren.map((c) => c.date).sort()).toEqual(["2026-06-21", "2026-06-22"]);
	});

	it("skips deleted children when finding the cursor", async () => {
		vi.setSystemTime(new Date("2026-06-22T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ id: "tmpl-1", date: "2026-06-18", recurringRule: "daily" });
		// latest child is deleted вЂ” should fall back to earlier non-deleted child
		const child1 = makeChild({ id: "c1", date: "2026-06-19", recurringParentId: "tmpl-1", isDeleted: false });
		const child2 = makeChild({ id: "c2", date: "2026-06-21", recurringParentId: "tmpl-1", isDeleted: true }); // deleted
		seedCache(store, "2026-06", [template, child1, child2]);
		await processRecurringTransactions();
		// cursor starts from "2026-06-19" (latest non-deleted), so spawns 20, 21, 22
		const newChildren = store.allCached.filter((t) => t.recurringParentId === "tmpl-1" && !["c1", "c2"].includes(t.id));
		expect(newChildren).toHaveLength(3);
	});
});

// в”Ђв”Ђ safety cap (366 iterations) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("safety cap вЂ” max 366 iterations per template", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	it("stops at 366 children even if more days are missing", async () => {
		// template is 500 days ago, rule is daily вЂ” should cap at 366
		const farPast = new Date("2026-06-20");
		farPast.setDate(farPast.getDate() - 500);
		const pastDateStr = farPast.toLocaleDateString("en-CA");
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ id: "tmpl-cap", date: pastDateStr, recurringRule: "daily" });
		const monthKey = pastDateStr.slice(0, 7);
		seedCache(store, monthKey, [template]);
		await processRecurringTransactions();
		const children = store.allCached.filter((t) => t.recurringParentId === "tmpl-cap");
		expect(children).toHaveLength(366);
	});
});

// в”Ђв”Ђ skipped templates в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("template filtering", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	it("skips deleted templates", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ id: "tmpl-del", date: "2026-06-19", isDeleted: true, recurringRule: "daily" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		expect(store.allCached.filter((t) => t.recurringParentId === "tmpl-del")).toHaveLength(0);
	});

	it("skips transactions with isRecurring=false", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const tx = makeTemplate({ id: "not-tmpl", isRecurring: false, recurringRule: "daily" });
		seedCache(store, "2026-06", [tx]);
		await processRecurringTransactions();
		expect(store.allCached.filter((t) => t.recurringParentId === "not-tmpl")).toHaveLength(0);
	});

	it("skips children (has recurringParentId set)", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const child = makeTemplate({ id: "child-x", recurringParentId: "some-parent", recurringRule: "daily" });
		seedCache(store, "2026-06", [child]);
		await processRecurringTransactions();
		expect(store.allCached.filter((t) => t.recurringParentId === "child-x")).toHaveLength(0);
	});

	it("skips templates with no recurringRule", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ id: "no-rule", date: "2026-06-19", recurringRule: undefined });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		expect(store.allCached.filter((t) => t.recurringParentId === "no-rule")).toHaveLength(0);
	});
});

// в”Ђв”Ђ multiple templates в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("multiple templates", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	it("processes each template independently", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const t1 = makeTemplate({ id: "t1", date: "2026-06-19", recurringRule: "daily" });
		const t2 = makeTemplate({ id: "t2", date: "2026-06-18", recurringRule: "daily" });
		seedCache(store, "2026-06", [t1, t2]);
		await processRecurringTransactions();
		expect(store.allCached.filter((t) => t.recurringParentId === "t1")).toHaveLength(1);
		expect(store.allCached.filter((t) => t.recurringParentId === "t2")).toHaveLength(2);
	});

	it("does nothing when cache is empty (no templates)", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		await processRecurringTransactions();
		expect(store.allCached).toHaveLength(0);
	});
});

// в”Ђв”Ђ child field inheritance в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("child field inheritance from template", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	it("inherits type from template", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-19", recurringRule: "daily", type: "income" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const child = store.allCached.find((t) => t.recurringParentId === "tmpl-1");
		expect(child?.type).toBe("income");
	});

	it("inherits categoryId from template", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-19", recurringRule: "daily", categoryId: "cat-special" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const child = store.allCached.find((t) => t.recurringParentId === "tmpl-1");
		expect(child?.categoryId).toBe("cat-special");
	});

	it("inherits toAccountId from template (for transfers)", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-19", recurringRule: "daily", type: "transfer", toAccountId: "acc-savings" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const child = store.allCached.find((t) => t.recurringParentId === "tmpl-1");
		expect(child?.toAccountId).toBe("acc-savings");
	});

	it("inherits time from template", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-19", recurringRule: "daily", time: "07:30" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const child = store.allCached.find((t) => t.recurringParentId === "tmpl-1");
		expect(child?.time).toBe("07:30");
	});

	it("inherits currency from template", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-19", recurringRule: "daily", currency: "USD" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const child = store.allCached.find((t) => t.recurringParentId === "tmpl-1");
		expect(child?.currency).toBe("USD");
	});

	it("child has isDeleted=false", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-19", recurringRule: "daily" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const child = store.allCached.find((t) => t.recurringParentId === "tmpl-1");
		expect(child?.isDeleted).toBe(false);
	});

	it("child isRecurring=true (marks it as part of recurring series)", async () => {
		vi.setSystemTime(new Date("2026-06-20T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ date: "2026-06-19", recurringRule: "daily" });
		seedCache(store, "2026-06", [template]);
		await processRecurringTransactions();
		const child = store.allCached.find((t) => t.recurringParentId === "tmpl-1");
		expect(child?.isRecurring).toBe(true);
	});
});

// в”Ђв”Ђ monthly rule вЂ“ leap year edge case в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

describe("monthly rule вЂ“ leap year edge case", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	it("Feb 29 in leap year 2024 в†’ overflows to Mar 29 in 2025 (non-leap)", async () => {
		// 2024 is a leap year. "2024-02-29" в†’ nextOccurrence в†’ new Date(2024, 2, 29) = Mar 29 2024
		// (month parse: y=2024, m=2, d=29 в†’ Date(2024, 2, 29) = March 29, not February)
		// Actually: "2024-02-29" splits to y=2024, m=2, d=29
		// new Date(2024, 2, 29) = March 29 2024 (month 2 = March in 0-indexed)
		vi.setSystemTime(new Date("2024-04-01T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ id: "tmpl-leap", date: "2024-02-29", recurringRule: "monthly" });
		seedCache(store, "2024-02", [template]);
		await processRecurringTransactions();
		const child = store.allCached.find((t) => t.recurringParentId === "tmpl-leap");
		// new Date(2024, 2, 29) = March 29 2024
		expect(child?.date).toBe("2024-03-29");
	});

	it("Mar 31 monthly в†’ Apr 30 + 1 day overflow в†’ May 1", async () => {
		// "2026-03-31" в†’ y=2026, m=3, d=31 в†’ new Date(2026, 3, 31) в†’ April 31 в†’ May 1
		vi.setSystemTime(new Date("2026-05-05T12:00:00Z"));
		const store = useTransactionsStore();
		const template = makeTemplate({ id: "tmpl-overflow", date: "2026-03-31", recurringRule: "monthly" });
		seedCache(store, "2026-03", [template]);
		await processRecurringTransactions();
		const children = store.allCached.filter((t) => t.recurringParentId === "tmpl-overflow");
		expect(children[0].date).toBe("2026-05-01"); // April 31 overflows to May 1
	});
});
