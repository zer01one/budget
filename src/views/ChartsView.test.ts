import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import ChartsView from "@/views/ChartsView.vue";
import { useTransactionsStore } from "@/stores/transactions.store";
import { useCategoriesStore } from "@/stores/categories.store";
import type { Transaction, Category } from "@/types";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockLoadMonth } = vi.hoisted(() => ({
	mockLoadMonth: vi.fn().mockResolvedValue(null)
}));

vi.mock("@/services/data/transactions.service", () => ({
	transactionsService: {
		saveMonth: vi.fn().mockResolvedValue(undefined),
		loadMonth: mockLoadMonth,
		listMonths: vi.fn().mockResolvedValue([])
	}
}));

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn().mockResolvedValue({
		readJson: vi.fn().mockResolvedValue(null),
		writeJson: vi.fn().mockResolvedValue(undefined)
	})
}));

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({ settings: { deviceId: "test-device" } }))
}));

// ── Globals ───────────────────────────────────────────────────────────────────

beforeAll(() => {
	vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
});

afterEach(() => {
	vi.clearAllMocks();
	mockLoadMonth.mockResolvedValue(null);
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MONTH = "2026-06";

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
	return {
		id: "tx-1",
		type: "expense",
		amount: 1000,
		currency: "KZT",
		date: "2026-06-01",
		time: "10:00",
		accountId: "acc-1",
		toAccountId: null,
		categoryId: "cat-1",
		comment: "",
		tags: [],
		isRecurring: false,
		recurringParentId: null,
		isDeleted: false,
		updatedAt: "2026-06-01T10:00:00Z",
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

function makeCat(overrides: Partial<Category> = {}): Category {
	return {
		id: "cat-1",
		name: "Еда",
		type: "expense",
		color: "#FF0000",
		icon: "food",
		parentId: null,
		isSystem: false,
		isArchived: false,
		sortOrder: 0,
		updatedAt: "2026-06-01T00:00:00Z",
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

// ── Mount helper ──────────────────────────────────────────────────────────────

let pinia: ReturnType<typeof createPinia>;

async function mountView() {
	const wrapper = mount(ChartsView, {
		global: {
			plugins: [pinia],
			stubs: { VChart: { template: '<div class="vchart-stub" />' } }
		}
	});
	await flushPromises();
	return wrapper;
}

async function setCache(month: string, txs: Transaction[]) {
	useTransactionsStore()._cache.set(month, txs);
	await nextTick();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ChartsView – rendering", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	it("renders the charts view container", async () => {
		const w = await mountView();
		expect(w.find(".charts-view").exists()).toBe(true);
	});

	it("renders 4 VChart stubs", async () => {
		const w = await mountView();
		expect(w.findAll(".vchart-stub")).toHaveLength(4);
	});

	it("renders all 4 chart card titles", async () => {
		const w = await mountView();
		const titles = w.findAll(".chart-card__title").map((el) => el.text());
		expect(titles).toContain("Расходы по категориям");
		expect(titles).toContain("Топ-5 категорий");
		expect(titles).toContain("Доходы и расходы за 6 месяцев");
		expect(titles).toContain("Динамика за месяц");
	});

	it("calls loadCurrentAndPrevMonth on mount (loads 2 months)", async () => {
		await mountView();
		expect(mockLoadMonth).toHaveBeenCalledTimes(2);
		expect(mockLoadMonth).toHaveBeenCalledWith(MONTH);
	});
});

// ── Month navigation ──────────────────────────────────────────────────────────

describe("ChartsView – month navigation", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	it("displays current month label on mount", async () => {
		const w = await mountView();
		expect(w.find(".month-nav__label").text()).toContain("2026");
	});

	it("nextMonth button is disabled when on current month", async () => {
		const w = await mountView();
		const [, nextBtn] = w.findAll(".month-nav__btn");
		expect(nextBtn.attributes("disabled")).toBeDefined();
	});

	it("prevMonth click changes the month label", async () => {
		const w = await mountView();
		const before = w.find(".month-nav__label").text();
		await w.findAll(".month-nav__btn")[0].trigger("click");
		expect(w.find(".month-nav__label").text()).not.toBe(before);
	});

	it("prevMonth navigates across year boundary Jan → Dec", async () => {
		vi.setSystemTime(new Date("2026-01-15"));
		pinia = createPinia();
		setActivePinia(pinia);
		const w = await mountView();
		await w.findAll(".month-nav__btn")[0].trigger("click");
		expect(w.find(".month-nav__label").text()).toContain("2025");
	});

	it("nextMonth button is enabled after navigating to past month", async () => {
		const w = await mountView();
		await w.findAll(".month-nav__btn")[0].trigger("click");
		expect(w.findAll(".month-nav__btn")[1].attributes("disabled")).toBeUndefined();
	});

	it("nextMonth click advances from past month", async () => {
		const w = await mountView();
		await w.findAll(".month-nav__btn")[0].trigger("click"); // → May
		const labelMay = w.find(".month-nav__label").text();
		await w.findAll(".month-nav__btn")[1].trigger("click"); // → June
		expect(w.find(".month-nav__label").text()).not.toBe(labelMay);
	});

	it("nextMonth click stays when advancing would exceed current month", async () => {
		const w = await mountView();
		const before = w.find(".month-nav__label").text();
		await w.findAll(".month-nav__btn")[1].trigger("click");
		expect(w.find(".month-nav__label").text()).toBe(before);
	});

	it("nextMonth navigates across year boundary Dec → Jan", async () => {
		vi.setSystemTime(new Date("2027-06-01"));
		pinia = createPinia();
		setActivePinia(pinia);
		const w = await mountView();
		// Go back far enough to Dec 2026
		for (let i = 0; i < 6; i++) await w.findAll(".month-nav__btn")[0].trigger("click");
		const labelBefore = w.find(".month-nav__label").text();
		await w.findAll(".month-nav__btn")[1].trigger("click");
		expect(w.find(".month-nav__label").text()).not.toBe(labelBefore);
	});
});

// ── Summary pills ─────────────────────────────────────────────────────────────

describe("ChartsView – summary pills", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	it("renders 3 summary pills", async () => {
		const w = await mountView();
		expect(w.findAll(".summary-pill")).toHaveLength(3);
	});

	it("income pill shows correct amount", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "i1", type: "income", amount: 50000 })]);
		expect(w.findAll(".summary-pill")[0].find(".summary-pill__value").text()).toContain("50");
	});

	it("expense pill shows correct amount", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "e1", type: "expense", amount: 30000 })]);
		expect(w.findAll(".summary-pill")[1].find(".summary-pill__value").text()).toContain("30");
	});

	it("net pill has --income class when net > 0", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "i1", type: "income", amount: 5000 }), makeTx({ id: "e1", type: "expense", amount: 3000 })]);
		expect(w.findAll(".summary-pill")[2].classes()).toContain("summary-pill--income");
	});

	it("net pill has --income class when net === 0", async () => {
		const w = await mountView();
		await setCache(MONTH, []);
		expect(w.findAll(".summary-pill")[2].classes()).toContain("summary-pill--income");
	});

	it("net pill has --expense class when net < 0", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "i1", type: "income", amount: 1000 }), makeTx({ id: "e1", type: "expense", amount: 5000 })]);
		expect(w.findAll(".summary-pill")[2].classes()).toContain("summary-pill--expense");
	});

	it("net value has + prefix when positive", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "i1", type: "income", amount: 5000 })]);
		expect(w.findAll(".summary-pill")[2].find(".summary-pill__value").text().startsWith("+")).toBe(true);
	});

	it("net value has no + prefix when negative", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "e1", type: "expense", amount: 5000 })]);
		expect(w.findAll(".summary-pill")[2].find(".summary-pill__value").text().startsWith("+")).toBe(false);
	});

	it("deleted transactions excluded from summary", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "d1", type: "income", amount: 99999, isDeleted: true })]);
		expect(w.findAll(".summary-pill")[0].find(".summary-pill__value").text()).not.toContain("99");
	});

	it("transactions from other months excluded from summary", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "o1", type: "income", amount: 77777, date: "2025-01-01" })]);
		expect(w.findAll(".summary-pill")[0].find(".summary-pill__value").text()).not.toContain("77");
	});

	it("transfer type not counted in income or expense", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "t1", type: "transfer" as any, amount: 9999 })]);
		// income and expense pills remain 0
		expect(w.findAll(".summary-pill")[0].find(".summary-pill__value").text()).not.toContain("9999");
		expect(w.findAll(".summary-pill")[1].find(".summary-pill__value").text()).not.toContain("9999");
	});
});

// ── donutOption ───────────────────────────────────────────────────────────────

describe("ChartsView – donutOption", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	function getDonut(w: any) {
		return (w.vm as any).$.setupState.donutOption;
	}

	it("shows 'Нет данных' fallback when no expense transactions", async () => {
		const w = await mountView();
		await setCache(MONTH, []);
		expect(getDonut(w).series[0].data[0].name).toBe("Нет данных");
	});

	it("skips income transactions (type !== expense)", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "i1", type: "income", amount: 1000 })]);
		expect(getDonut(w).series[0].data[0].name).toBe("Нет данных");
	});

	it("skips transactions without categoryId", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "e1", type: "expense", categoryId: null as any })]);
		expect(getDonut(w).series[0].data[0].name).toBe("Нет данных");
	});

	it("uses category name and color when category is found", async () => {
		const w = await mountView();
		useCategoriesStore().categories = [makeCat({ id: "cat-1", name: "Транспорт", color: "#00FF00" })];
		await setCache(MONTH, [makeTx({ id: "e1", type: "expense", amount: 500, categoryId: "cat-1" })]);
		const data = getDonut(w).series[0].data;
		expect(data[0].name).toBe("Транспорт");
		expect(data[0].itemStyle.color).toBe("#00FF00");
	});

	it("falls back to 'Прочее' and #6B7280 when category not found", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "e1", type: "expense", amount: 500, categoryId: "ghost" })]);
		const data = getDonut(w).series[0].data;
		expect(data[0].name).toBe("Прочее");
		expect(data[0].itemStyle.color).toBe("#6B7280");
	});

	it("groups amounts by category (accumulates)", async () => {
		const w = await mountView();
		useCategoriesStore().categories = [makeCat({ id: "cat-1", name: "Еда" })];
		await setCache(MONTH, [
			makeTx({ id: "e1", type: "expense", amount: 1000, categoryId: "cat-1" }),
			makeTx({ id: "e2", type: "expense", amount: 500, categoryId: "cat-1" })
		]);
		expect(getDonut(w).series[0].data[0].value).toBe(1500);
	});

	it("sorts data descending by value", async () => {
		const w = await mountView();
		useCategoriesStore().categories = [makeCat({ id: "cat-1", name: "Малая" }), makeCat({ id: "cat-2", name: "Большая" })];
		await setCache(MONTH, [
			makeTx({ id: "e1", type: "expense", amount: 100, categoryId: "cat-1" }),
			makeTx({ id: "e2", type: "expense", amount: 900, categoryId: "cat-2" })
		]);
		const data = getDonut(w).series[0].data;
		expect(data[0].value).toBeGreaterThan(data[1].value);
	});

	it("tooltip formatter returns name, value and percent", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "e1", type: "expense", amount: 1000 })]);
		const result = getDonut(w).tooltip.formatter({ name: "Еда", value: 1000, percent: 42 });
		expect(result).toContain("Еда");
		expect(result).toContain("42%");
	});
});

// ── topCatsOption ─────────────────────────────────────────────────────────────

describe("ChartsView – topCatsOption", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	function getTopCats(w: any) {
		return (w.vm as any).$.setupState.topCatsOption;
	}

	it("returns empty yAxis data when no expense transactions", async () => {
		const w = await mountView();
		await setCache(MONTH, []);
		expect(getTopCats(w).yAxis.data).toHaveLength(0);
	});

	it("skips income transactions", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "i1", type: "income", amount: 5000 })]);
		expect(getTopCats(w).yAxis.data).toHaveLength(0);
	});

	it("skips transactions without categoryId", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "e1", type: "expense", categoryId: null as any })]);
		expect(getTopCats(w).yAxis.data).toHaveLength(0);
	});

	it("uses category name when found", async () => {
		const w = await mountView();
		useCategoriesStore().categories = [makeCat({ id: "cat-1", name: "Рестораны", color: "#AABBCC" })];
		await setCache(MONTH, [makeTx({ id: "e1", type: "expense", amount: 2000, categoryId: "cat-1" })]);
		expect(getTopCats(w).yAxis.data).toContain("Рестораны");
	});

	it("uses '#6B7280' color when category not found", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "e1", type: "expense", amount: 2000, categoryId: "ghost" })]);
		const opt = getTopCats(w);
		expect(opt.series[0].data[0].itemStyle.color).toBe("#6B7280");
	});

	it("falls back to '?' name when category not found", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "e1", type: "expense", amount: 2000, categoryId: "ghost" })]);
		expect(getTopCats(w).yAxis.data).toContain("?");
	});

	it("limits results to top 5 categories", async () => {
		const w = await mountView();
		const txs = Array.from({ length: 8 }, (_, i) => makeTx({ id: `e${i}`, type: "expense", amount: (8 - i) * 100, categoryId: `cat-${i}` }));
		await setCache(MONTH, txs);
		expect(getTopCats(w).yAxis.data.length).toBeLessThanOrEqual(5);
	});

	it("rounds values with Math.round", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "e1", type: "expense", amount: 333.7, categoryId: "cat-1" })]);
		const opt = getTopCats(w);
		expect(opt.series[0].data[0].value).toBe(334);
	});

	it("tooltip formatter returns name and value", async () => {
		const w = await mountView();
		await setCache(MONTH, []);
		const result = getTopCats(w).tooltip.formatter([{ name: "Еда", value: 2000 }]);
		expect(result).toContain("Еда");
		expect(result).toContain("2");
	});

	it("xAxis formatter shows k suffix for values >= 1000", async () => {
		const w = await mountView();
		await setCache(MONTH, []);
		const fmt = getTopCats(w).xAxis.axisLabel.formatter;
		expect(fmt(2000)).toBe("2k");
		expect(fmt(500)).toBe("500");
	});
});

// ── lineOption ────────────────────────────────────────────────────────────────

describe("ChartsView – lineOption", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	function getLine(w: any) {
		return (w.vm as any).$.setupState.lineOption;
	}

	it("current month: maxDay equals today's day (15)", async () => {
		const w = await mountView();
		await setCache(MONTH, []);
		expect(getLine(w).xAxis.data).toHaveLength(15);
		expect(getLine(w).xAxis.data).not.toContain("16");
	});

	it("past month: maxDay equals full days in month (May = 31)", async () => {
		const w = await mountView();
		await w.findAll(".month-nav__btn")[0].trigger("click"); // → May 2026
		await setCache("2026-05", [makeTx({ id: "e1", type: "expense", amount: 100, date: "2026-05-31" })]);
		expect(getLine(w).xAxis.data).toContain("31");
		expect(getLine(w).xAxis.data).toHaveLength(31);
	});

	it("cumulates expense per day", async () => {
		const w = await mountView();
		await setCache(MONTH, [
			makeTx({ id: "e1", type: "expense", amount: 100, date: "2026-06-01" }),
			makeTx({ id: "e2", type: "expense", amount: 200, date: "2026-06-02" })
		]);
		const cumExp = getLine(w).series[0].data;
		expect(cumExp[0]).toBe(100);
		expect(cumExp[1]).toBe(300);
	});

	it("cumulates income per day", async () => {
		const w = await mountView();
		await setCache(MONTH, [
			makeTx({ id: "i1", type: "income", amount: 500, date: "2026-06-01" }),
			makeTx({ id: "i2", type: "income", amount: 300, date: "2026-06-02" })
		]);
		const cumInc = getLine(w).series[1].data;
		expect(cumInc[0]).toBe(500);
		expect(cumInc[1]).toBe(800);
	});

	it("excludes deleted transactions from daily accumulation", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "e1", type: "expense", amount: 9999, isDeleted: true, date: "2026-06-01" })]);
		expect(getLine(w).series[0].data[0]).toBe(0);
	});

	it("rounds cumulative values", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "e1", type: "expense", amount: 100.7, date: "2026-06-01" })]);
		expect(getLine(w).series[0].data[0]).toBe(101);
	});

	it("tooltip formatter returns day label and series values", async () => {
		const w = await mountView();
		await setCache(MONTH, []);
		const result = getLine(w).tooltip.formatter([{ marker: "●", seriesName: "Расходы", value: 500, axisValue: "5" }]);
		expect(result).toContain("День 5");
		expect(result).toContain("Расходы");
	});

	it("yAxis formatter shows k suffix for values >= 1000", async () => {
		const w = await mountView();
		await setCache(MONTH, []);
		const fmt = getLine(w).yAxis.axisLabel.formatter;
		expect(fmt(3000)).toBe("3k");
		expect(fmt(999)).toBe("999");
	});
});

// ── barMonthlyOption ──────────────────────────────────────────────────────────

describe("ChartsView – barMonthlyOption", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	function getBar(w: any) {
		return (w.vm as any).$.setupState.barMonthlyOption;
	}

	it("has 6 data points per series", async () => {
		const w = await mountView();
		await setCache(MONTH, []);
		expect(getBar(w).series[0].data).toHaveLength(6);
		expect(getBar(w).series[1].data).toHaveLength(6);
	});

	it("last slot (index 5) corresponds to selected month", async () => {
		const w = await mountView();
		await setCache(MONTH, [
			makeTx({ id: "i1", type: "income", amount: 10000, date: "2026-06-10" }),
			makeTx({ id: "e1", type: "expense", amount: 5000, date: "2026-06-10" })
		]);
		const bar = getBar(w);
		expect(bar.series[0].data[5]).toBe(10000);
		expect(bar.series[1].data[5]).toBe(5000);
	});

	it("earlier slots are 0 when no data for those months", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "i1", type: "income", amount: 1000, date: "2026-06-01" })]);
		const bar = getBar(w);
		expect(bar.series[0].data[0]).toBe(0); // Jan 2026 — no data
	});

	it("excludes deleted transactions", async () => {
		const w = await mountView();
		await setCache(MONTH, [makeTx({ id: "i1", type: "income", amount: 99999, isDeleted: true, date: "2026-06-10" })]);
		expect(getBar(w).series[0].data[5]).toBe(0);
	});

	it("tooltip formatter joins all params", async () => {
		const w = await mountView();
		await setCache(MONTH, []);
		const result = getBar(w).tooltip.formatter([
			{ marker: "●", seriesName: "Доходы", value: 3000 },
			{ marker: "●", seriesName: "Расходы", value: 1000 }
		]);
		expect(result).toContain("Доходы");
		expect(result).toContain("Расходы");
	});

	it("yAxis formatter shows k suffix for values >= 1000", async () => {
		const w = await mountView();
		await setCache(MONTH, []);
		const fmt = getBar(w).yAxis.axisLabel.formatter;
		expect(fmt(5000)).toBe("5k");
		expect(fmt(100)).toBe("100");
	});

	it("xAxis labels use short month names", async () => {
		const w = await mountView();
		await setCache(MONTH, []);
		const labels = getBar(w).xAxis.data as string[];
		expect(labels).toHaveLength(6);
		labels.forEach((l) => expect(l.length).toBeGreaterThan(0));
	});
});

// ── last6Months computed ──────────────────────────────────────────────────────

describe("ChartsView – last6Months computed", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-15"));
		pinia = createPinia();
		setActivePinia(pinia);
	});
	afterEach(() => vi.useRealTimers());

	it("always returns exactly 6 months", async () => {
		const w = await mountView();
		const months = (w.vm as any).$.setupState.last6Months as string[];
		expect(months).toHaveLength(6);
	});

	it("last entry equals selected month", async () => {
		const w = await mountView();
		const months = (w.vm as any).$.setupState.last6Months as string[];
		expect(months[5]).toBe(MONTH);
	});

	it("months are in ascending order", async () => {
		const w = await mountView();
		const months = (w.vm as any).$.setupState.last6Months as string[];
		for (let i = 1; i < months.length; i++) {
			expect(months[i] > months[i - 1]).toBe(true);
		}
	});

	it("spans year boundary correctly (Mar 2026 → starts Oct 2025)", async () => {
		vi.setSystemTime(new Date("2026-03-15"));
		pinia = createPinia();
		setActivePinia(pinia);
		const w = await mountView();
		const months = (w.vm as any).$.setupState.last6Months as string[];
		expect(months[0]).toBe("2025-10");
		expect(months[5]).toBe("2026-03");
	});
});
