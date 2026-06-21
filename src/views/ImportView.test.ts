import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import ImportView from "@/views/ImportView.vue";
import { useAccountsStore } from "@/stores/accounts.store";
import { useCategoriesStore } from "@/stores/categories.store";
import { useGamificationStore } from "@/stores/gamification.store";
import { useTransactionsStore } from "@/stores/transactions.store";
import type { Account, Category, Transaction } from "@/types";
import type { ImportPreviewRow } from "@/services/data/import.service";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockImportFile, mockParseCsv, mockAutoDetectMapping, mockApplyMapping, mockPreviewRowsToTransactions } = vi.hoisted(() => ({
	mockImportFile: vi.fn().mockResolvedValue(null),
	mockParseCsv: vi.fn().mockReturnValue({ headers: [], rows: [] }),
	mockAutoDetectMapping: vi.fn().mockReturnValue({}),
	mockApplyMapping: vi.fn().mockReturnValue([]),
	mockPreviewRowsToTransactions: vi.fn().mockReturnValue([])
}));

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn().mockResolvedValue({
		importFile: mockImportFile,
		readJson: vi.fn().mockResolvedValue(null),
		writeJson: vi.fn().mockResolvedValue(undefined)
	})
}));

vi.mock("@/services/data/import.service", () => ({
	parseCsv: mockParseCsv,
	autoDetectMapping: mockAutoDetectMapping,
	applyMapping: mockApplyMapping,
	previewRowsToTransactions: mockPreviewRowsToTransactions
}));

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({ settings: { deviceId: "test-device" } }))
}));

vi.mock("@/services/data/transactions.service", () => ({
	transactionsService: {
		saveMonth: vi.fn().mockResolvedValue(undefined),
		loadMonth: vi.fn().mockResolvedValue(null),
		listMonths: vi.fn().mockResolvedValue([])
	}
}));

// ── Globals ───────────────────────────────────────────────────────────────────

beforeAll(() => {
	vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
});

afterEach(() => {
	vi.clearAllMocks();
	mockImportFile.mockResolvedValue(null);
	mockParseCsv.mockReturnValue({ headers: [], rows: [] });
	mockAutoDetectMapping.mockReturnValue({});
	mockApplyMapping.mockReturnValue([]);
	mockPreviewRowsToTransactions.mockReturnValue([]);
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeAccount(o: Partial<Account> = {}): Account {
	return {
		id: "acc-1",
		name: "Основной",
		type: "bank",
		currency: "KZT",
		initialBalance: 0,
		color: "#7C3AED",
		icon: "bank",
		isArchived: false,
		sortOrder: 0,
		notes: "",
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "test-device",
		version: 1,
		...o
	};
}

function makeCategory(o: Partial<Category> = {}): Category {
	return {
		id: "cat-1",
		name: "Еда",
		type: "expense",
		color: "#f00",
		icon: "food",
		parentId: null,
		isSystem: false,
		isArchived: false,
		sortOrder: 0,
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "test-device",
		version: 1,
		...o
	};
}

function makeRow(o: Partial<ImportPreviewRow> = {}): ImportPreviewRow {
	return { date: "2026-06-01", amount: 1000, type: "expense", comment: "Coffee", valid: true, ...o };
}

function makeTx(o: Partial<Transaction> = {}): Transaction {
	return {
		id: "tx-1",
		type: "expense",
		amount: 1000,
		currency: "KZT",
		date: "2026-06-01",
		time: "12:00",
		accountId: "acc-1",
		toAccountId: null,
		categoryId: null,
		comment: "Coffee",
		tags: ["imported"],
		isRecurring: false,
		recurringParentId: null,
		isDeleted: false,
		updatedAt: "2026-06-01T12:00:00Z",
		deviceId: "test-device",
		version: 1,
		...o
	};
}

// ── Test infrastructure ───────────────────────────────────────────────────────

let pinia: ReturnType<typeof createPinia>;

beforeEach(() => {
	pinia = createPinia();
	setActivePinia(pinia);
	useAccountsStore().accounts = [makeAccount()];
	useCategoriesStore().categories = [makeCategory()];
});

async function mountView() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: "/", component: ImportView },
			{ path: "/transactions", component: { template: "<div/>" } }
		]
	});
	router.push("/");
	await router.isReady();
	const wrapper = mount(ImportView, { global: { plugins: [pinia, router] } });
	await flushPromises();
	return { wrapper, router };
}

// Finds an AppButton (class .app-btn) by text — excludes the plain .back-btn header button
function appBtn(wrapper: ReturnType<typeof mount>, text: string) {
	const b = wrapper.findAll(".app-btn").find((b) => b.text().trim().includes(text));
	if (!b) throw new Error(`AppButton "${text}" not found`);
	return b;
}

const HEADERS = ["Дата", "Сумма", "Тип", "Описание"];
const ROWS = [{ Дата: "2026-01-01", Сумма: "1000" }];

async function toMapStep(wrapper: ReturnType<typeof mount>) {
	mockImportFile.mockResolvedValue({ filename: "t.csv", content: "" });
	mockParseCsv.mockReturnValue({ headers: HEADERS, rows: ROWS });
	mockAutoDetectMapping.mockReturnValue({ date: "Дата", amount: "Сумма", type: "Тип", comment: "Описание" });
	await appBtn(wrapper, "Выбрать файл CSV").trigger("click");
	await flushPromises();
}

async function toPreviewStep(wrapper: ReturnType<typeof mount>, rows: ImportPreviewRow[] = [makeRow()]) {
	await toMapStep(wrapper);
	mockApplyMapping.mockReturnValue(rows);
	await appBtn(wrapper, "Далее").trigger("click");
	await flushPromises();
}

async function toDoneStep(wrapper: ReturnType<typeof mount>) {
	await toPreviewStep(wrapper, [makeRow()]);
	vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
	vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
	mockPreviewRowsToTransactions.mockReturnValue([{} as never]);
	await appBtn(wrapper, "Импортировать").trigger("click");
	await flushPromises();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ImportView", () => {
	describe("step pick — initial render", () => {
		it("renders pick card with Выбрать файл CSV button", async () => {
			const { wrapper } = await mountView();
			expect(wrapper.find(".import-card").exists()).toBe(true);
			expect(appBtn(wrapper, "Выбрать файл CSV").exists()).toBe(true);
		});

		it("does not show error initially", async () => {
			const { wrapper } = await mountView();
			expect(wrapper.find(".import-error").exists()).toBe(false);
		});

		it("does not render map, preview or done sections", async () => {
			const { wrapper } = await mountView();
			expect(wrapper.find(".map-grid").exists()).toBe(false);
			expect(wrapper.find(".preview-table").exists()).toBe(false);
			expect(wrapper.find(".import-card--done").exists()).toBe(false);
		});
	});

	describe("back button", () => {
		it("calls router.back() when header ← Назад is clicked", async () => {
			const { wrapper, router } = await mountView();
			const backSpy = vi.spyOn(router, "back").mockImplementation(() => Promise.resolve());
			await wrapper.find(".back-btn").trigger("click");
			expect(backSpy).toHaveBeenCalledOnce();
		});
	});

	describe("pickFile()", () => {
		it("stays at pick step when importFile returns null", async () => {
			const { wrapper } = await mountView();
			mockImportFile.mockResolvedValue(null);
			await appBtn(wrapper, "Выбрать файл CSV").trigger("click");
			await flushPromises();
			expect(wrapper.find(".map-grid").exists()).toBe(false);
			expect(appBtn(wrapper, "Выбрать файл CSV").exists()).toBe(true);
		});

		it("shows error when CSV has no headers", async () => {
			const { wrapper } = await mountView();
			mockImportFile.mockResolvedValue({ filename: "t.csv", content: "" });
			mockParseCsv.mockReturnValue({ headers: [], rows: [] });
			await appBtn(wrapper, "Выбрать файл CSV").trigger("click");
			await flushPromises();
			expect(wrapper.find(".import-error").text()).toContain("Не удалось прочитать CSV");
			expect(wrapper.find(".map-grid").exists()).toBe(false);
		});

		it("advances to map step on success", async () => {
			const { wrapper } = await mountView();
			await toMapStep(wrapper);
			expect(wrapper.find(".map-grid").exists()).toBe(true);
		});

		it("auto-fills date and amount from autoDetectMapping", async () => {
			const { wrapper } = await mountView();
			mockImportFile.mockResolvedValue({ filename: "t.csv", content: "" });
			mockParseCsv.mockReturnValue({ headers: ["Дата", "Сумма"], rows: [] });
			mockAutoDetectMapping.mockReturnValue({ date: "Дата", amount: "Сумма" });
			await appBtn(wrapper, "Выбрать файл CSV").trigger("click");
			await flushPromises();
			const selects = wrapper.findAll("select");
			expect((selects[0].element as HTMLSelectElement).value).toBe("Дата");
			expect((selects[1].element as HTMLSelectElement).value).toBe("Сумма");
		});

		it("falls back to h[0]/h[1] when autoDetectMapping returns empty", async () => {
			const { wrapper } = await mountView();
			mockImportFile.mockResolvedValue({ filename: "t.csv", content: "" });
			mockParseCsv.mockReturnValue({ headers: ["ColA", "ColB"], rows: [] });
			mockAutoDetectMapping.mockReturnValue({});
			await appBtn(wrapper, "Выбрать файл CSV").trigger("click");
			await flushPromises();
			const selects = wrapper.findAll("select");
			expect((selects[0].element as HTMLSelectElement).value).toBe("ColA");
			expect((selects[1].element as HTMLSelectElement).value).toBe("ColB");
		});

		it("shows e.message when importFile throws Error", async () => {
			const { wrapper } = await mountView();
			mockImportFile.mockRejectedValue(new Error("диск недоступен"));
			await appBtn(wrapper, "Выбрать файл CSV").trigger("click");
			await flushPromises();
			expect(wrapper.find(".import-error").text()).toContain("диск недоступен");
		});

		it("shows generic message when importFile throws non-Error", async () => {
			const { wrapper } = await mountView();
			mockImportFile.mockRejectedValue("boom");
			await appBtn(wrapper, "Выбрать файл CSV").trigger("click");
			await flushPromises();
			expect(wrapper.find(".import-error").text()).toContain("Ошибка выбора файла");
		});

		it("clears previous error on next pickFile attempt", async () => {
			const { wrapper } = await mountView();
			mockImportFile.mockResolvedValue({ filename: "t.csv", content: "" });
			mockParseCsv.mockReturnValue({ headers: [], rows: [] });
			await appBtn(wrapper, "Выбрать файл CSV").trigger("click");
			await flushPromises();
			expect(wrapper.find(".import-error").exists()).toBe(true);

			mockImportFile.mockResolvedValue(null);
			await appBtn(wrapper, "Выбрать файл CSV").trigger("click");
			await flushPromises();
			expect(wrapper.find(".import-error").exists()).toBe(false);
		});
	});

	describe("step map — render", () => {
		it("shows CSV row count in hint", async () => {
			const { wrapper } = await mountView();
			await toMapStep(wrapper);
			expect(wrapper.find(".import-card__hint").text()).toContain(String(ROWS.length));
		});

		it("renders CSV headers in date and amount selects", async () => {
			const { wrapper } = await mountView();
			await toMapStep(wrapper);
			const optionTexts = wrapper
				.findAll("select")[0]
				.findAll("option")
				.map((o) => o.text());
			expect(optionTexts).toContain("Дата");
			expect(optionTexts).toContain("Сумма");
		});

		it("renders EMPTY_COL as first option in type select", async () => {
			const { wrapper } = await mountView();
			await toMapStep(wrapper);
			const typeSelect = wrapper.findAll("select")[2];
			expect(typeSelect.findAll("option")[0].text()).toContain("не использовать");
		});

		it("renders EMPTY_COL as first option in comment select", async () => {
			const { wrapper } = await mountView();
			await toMapStep(wrapper);
			const commentSelect = wrapper.findAll("select")[3];
			expect(commentSelect.findAll("option")[0].text()).toContain("не использовать");
		});

		it("renders active accounts in account select", async () => {
			const { wrapper } = await mountView();
			await toMapStep(wrapper);
			const accountSelect = wrapper.findAll("select")[4];
			const optionTexts = accountSelect.findAll("option").map((o) => o.text());
			expect(optionTexts).toContain("Основной");
		});

		it("does not render archived accounts in account select", async () => {
			useAccountsStore().accounts = [makeAccount({ isArchived: true, name: "Archived" })];
			const { wrapper } = await mountView();
			await toMapStep(wrapper);
			const accountSelect = wrapper.findAll("select")[4];
			const optionTexts = accountSelect.findAll("option").map((o) => o.text());
			expect(optionTexts).not.toContain("Archived");
		});

		it("renders non-archived categories in category select", async () => {
			const { wrapper } = await mountView();
			await toMapStep(wrapper);
			const catSelect = wrapper.findAll("select")[5];
			const optionTexts = catSelect.findAll("option").map((o) => o.text());
			expect(optionTexts).toContain("Еда");
		});

		it("does not render archived categories in category select", async () => {
			useCategoriesStore().categories = [makeCategory({ isArchived: true, name: "ArchivedCat" })];
			const { wrapper } = await mountView();
			await toMapStep(wrapper);
			const catSelect = wrapper.findAll("select")[5];
			const optionTexts = catSelect.findAll("option").map((o) => o.text());
			expect(optionTexts).not.toContain("ArchivedCat");
		});

		it("Назад button returns to pick step", async () => {
			const { wrapper } = await mountView();
			await toMapStep(wrapper);
			await wrapper.find(".import-actions").findAll("button")[0].trigger("click");
			await flushPromises();
			expect(wrapper.find(".map-grid").exists()).toBe(false);
			expect(appBtn(wrapper, "Выбрать файл CSV").exists()).toBe(true);
		});
	});

	describe("goPreview() — validation", () => {
		it("shows error when date column is empty", async () => {
			const { wrapper } = await mountView();
			mockImportFile.mockResolvedValue({ filename: "t.csv", content: "" });
			mockParseCsv.mockReturnValue({ headers: ["Сумма"], rows: [] });
			mockAutoDetectMapping.mockReturnValue({ date: "", amount: "Сумма" });
			await appBtn(wrapper, "Выбрать файл CSV").trigger("click");
			await flushPromises();
			await appBtn(wrapper, "Далее").trigger("click");
			await flushPromises();
			expect(wrapper.find(".import-error").text()).toContain("Укажите колонки Дата и Сумма");
		});

		it("shows error when amount column is empty", async () => {
			const { wrapper } = await mountView();
			mockImportFile.mockResolvedValue({ filename: "t.csv", content: "" });
			mockParseCsv.mockReturnValue({ headers: ["Дата"], rows: [] });
			mockAutoDetectMapping.mockReturnValue({ date: "Дата", amount: "" });
			await appBtn(wrapper, "Выбрать файл CSV").trigger("click");
			await flushPromises();
			await appBtn(wrapper, "Далее").trigger("click");
			await flushPromises();
			expect(wrapper.find(".import-error").text()).toContain("Укажите колонки Дата и Сумма");
		});

		it("date/amount error takes priority over accountId error", async () => {
			useAccountsStore().accounts = [];
			const { wrapper } = await mountView();
			mockImportFile.mockResolvedValue({ filename: "t.csv", content: "" });
			mockParseCsv.mockReturnValue({ headers: ["Дата"], rows: [] });
			mockAutoDetectMapping.mockReturnValue({ date: "Дата", amount: "" });
			await appBtn(wrapper, "Выбрать файл CSV").trigger("click");
			await flushPromises();
			await appBtn(wrapper, "Далее").trigger("click");
			await flushPromises();
			expect(wrapper.find(".import-error").text()).toContain("Укажите колонки Дата и Сумма");
		});

		it("shows error when accountId is empty", async () => {
			useAccountsStore().accounts = [];
			const { wrapper } = await mountView();
			await toMapStep(wrapper);
			await appBtn(wrapper, "Далее").trigger("click");
			await flushPromises();
			expect(wrapper.find(".import-error").text()).toContain("Выберите счёт для импорта");
		});

		it("advances to preview and clears error when all required fields are set", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper);
			expect(wrapper.find(".preview-table").exists()).toBe(true);
			expect(wrapper.find(".import-error").exists()).toBe(false);
		});
	});

	describe("step preview — render", () => {
		it("shows valid row count in summary", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper, [makeRow({ valid: true }), makeRow({ valid: false })]);
			expect(wrapper.find(".text-income").text()).toContain("1");
		});

		it("shows error row count when errorCount > 0", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper, [makeRow({ valid: false }), makeRow({ valid: false })]);
			expect(wrapper.find(".preview-summary .text-expense").exists()).toBe(true);
			expect(wrapper.find(".preview-summary .text-expense").text()).toContain("2");
		});

		it("does not show error count when errorCount = 0", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper, [makeRow({ valid: true })]);
			expect(wrapper.findAll(".preview-summary .text-expense").length).toBe(0);
		});

		it("renders up to 20 rows in preview table", async () => {
			const { wrapper } = await mountView();
			const rows = Array.from({ length: 25 }, (_, i) => makeRow({ comment: `row-${i}` }));
			await toPreviewStep(wrapper, rows);
			expect(wrapper.findAll(".preview-table tbody tr").length).toBe(20);
		});

		it("shows overflow message when > 20 rows", async () => {
			const { wrapper } = await mountView();
			const rows = Array.from({ length: 25 }, () => makeRow());
			await toPreviewStep(wrapper, rows);
			expect(wrapper.find(".preview-more").text()).toContain("5");
		});

		it("does not show overflow message when ≤ 20 rows", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(
				wrapper,
				Array.from({ length: 20 }, () => makeRow())
			);
			expect(wrapper.find(".preview-more").exists()).toBe(false);
		});

		it("income row shows + prefix and Доход label with income class", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper, [makeRow({ type: "income", amount: 500 })]);
			const row = wrapper.find(".preview-table tbody tr");
			expect(row.find("td.text-income").exists()).toBe(true);
			expect(row.text()).toContain("+");
			expect(row.text()).toContain("Доход");
		});

		it("expense row shows - prefix and Расход label with expense class", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper, [makeRow({ type: "expense", amount: 500 })]);
			const row = wrapper.find(".preview-table tbody tr");
			expect(row.find("td.text-expense").exists()).toBe(true);
			expect(row.text()).toContain("-");
			expect(row.text()).toContain("Расход");
		});

		it("valid row shows ✓ icon without row--error class", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper, [makeRow({ valid: true })]);
			const row = wrapper.find(".preview-table tbody tr");
			expect(row.classes()).not.toContain("row--error");
			expect(row.find(".row-ok").text()).toBe("✓");
			expect(row.find(".row-error").exists()).toBe(false);
		});

		it("invalid row shows ✕ icon and row--error class", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper, [makeRow({ valid: false, error: "bad date" })]);
			const row = wrapper.find(".preview-table tbody tr");
			expect(row.classes()).toContain("row--error");
			expect(row.find(".row-error").text()).toBe("✕");
			expect(row.find(".row-ok").exists()).toBe(false);
		});

		it("import button is disabled when validCount = 0", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper, [makeRow({ valid: false })]);
			expect((appBtn(wrapper, "Импортировать").element as HTMLButtonElement).disabled).toBe(true);
		});

		it("import button is enabled when validCount > 0", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper, [makeRow({ valid: true })]);
			expect((appBtn(wrapper, "Импортировать").element as HTMLButtonElement).disabled).toBe(false);
		});

		it("Назад button returns to map step", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper);
			await wrapper.find(".import-actions").findAll("button")[0].trigger("click");
			await flushPromises();
			expect(wrapper.find(".map-grid").exists()).toBe(true);
			expect(wrapper.find(".preview-table").exists()).toBe(false);
		});
	});

	describe("doImport()", () => {
		it("calls previewRowsToTransactions with previewRows, mapping, and deviceId", async () => {
			const { wrapper } = await mountView();
			const row = makeRow();
			await toPreviewStep(wrapper, [row]);
			vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
			vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
			mockPreviewRowsToTransactions.mockReturnValue([{} as never]);
			await appBtn(wrapper, "Импортировать").trigger("click");
			await flushPromises();
			expect(mockPreviewRowsToTransactions).toHaveBeenCalledWith(expect.arrayContaining([row]), expect.any(Object), "test-device");
		});

		it("calls addTransaction once per draft", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper, [makeRow(), makeRow({ comment: "r2" })]);
			const addTxSpy = vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
			vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
			mockPreviewRowsToTransactions.mockReturnValue([{} as never, {} as never]);
			await appBtn(wrapper, "Импортировать").trigger("click");
			await flushPromises();
			expect(addTxSpy).toHaveBeenCalledTimes(2);
		});

		it("calls onTransactionAdded with the returned transaction", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper, [makeRow()]);
			const tx = makeTx();
			vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(tx);
			const gamifySpy = vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
			mockPreviewRowsToTransactions.mockReturnValue([{} as never]);
			await appBtn(wrapper, "Импортировать").trigger("click");
			await flushPromises();
			expect(gamifySpy).toHaveBeenCalledWith(tx);
		});

		it("advances to done step after successful import", async () => {
			const { wrapper } = await mountView();
			await toDoneStep(wrapper);
			expect(wrapper.find(".import-card--done").exists()).toBe(true);
		});

		it("shows e.message when addTransaction throws Error", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper, [makeRow()]);
			vi.spyOn(useTransactionsStore(), "addTransaction").mockRejectedValue(new Error("сохранение не удалось"));
			vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
			mockPreviewRowsToTransactions.mockReturnValue([{} as never]);
			await appBtn(wrapper, "Импортировать").trigger("click");
			await flushPromises();
			expect(wrapper.find(".import-error").text()).toContain("сохранение не удалось");
		});

		it("shows generic error when addTransaction throws non-Error", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper, [makeRow()]);
			vi.spyOn(useTransactionsStore(), "addTransaction").mockRejectedValue("unknown");
			vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
			mockPreviewRowsToTransactions.mockReturnValue([{} as never]);
			await appBtn(wrapper, "Импортировать").trigger("click");
			await flushPromises();
			expect(wrapper.find(".import-error").text()).toContain("Ошибка импорта");
		});
	});

	describe("step done — render", () => {
		it("shows Импорт завершён! heading", async () => {
			const { wrapper } = await mountView();
			await toDoneStep(wrapper);
			expect(wrapper.text()).toContain("Импорт завершён!");
		});

		it("shows count of imported operations", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper, [makeRow(), makeRow({ comment: "r2" })]);
			vi.spyOn(useTransactionsStore(), "addTransaction").mockResolvedValue(makeTx());
			vi.spyOn(useGamificationStore(), "onTransactionAdded").mockImplementation(() => {});
			mockPreviewRowsToTransactions.mockReturnValue([{} as never, {} as never]);
			await appBtn(wrapper, "Импортировать").trigger("click");
			await flushPromises();
			expect(wrapper.find(".import-card--done").text()).toContain("2");
		});

		it("Перейти к операциям navigates to /transactions", async () => {
			const { wrapper, router } = await mountView();
			await toDoneStep(wrapper);
			const pushSpy = vi.spyOn(router, "push");
			await appBtn(wrapper, "Перейти к операциям").trigger("click");
			await flushPromises();
			expect(pushSpy).toHaveBeenCalledWith("/transactions");
		});
	});

	describe("step indicator CSS classes", () => {
		it("step pick: step 1 active, steps 2–4 neither active nor done", async () => {
			const { wrapper } = await mountView();
			const steps = wrapper.findAll(".step");
			expect(steps[0].classes()).toContain("step--active");
			expect(steps[0].classes()).not.toContain("step--done");
			expect(steps[1].classes()).not.toContain("step--active");
			expect(steps[1].classes()).not.toContain("step--done");
			expect(steps[2].classes()).not.toContain("step--active");
			expect(steps[3].classes()).not.toContain("step--active");
		});

		it("step map: step 1 done, step 2 active, steps 3–4 plain", async () => {
			const { wrapper } = await mountView();
			await toMapStep(wrapper);
			const steps = wrapper.findAll(".step");
			expect(steps[0].classes()).toContain("step--done");
			expect(steps[0].classes()).not.toContain("step--active");
			expect(steps[1].classes()).toContain("step--active");
			expect(steps[1].classes()).not.toContain("step--done");
			expect(steps[2].classes()).not.toContain("step--active");
			expect(steps[2].classes()).not.toContain("step--done");
		});

		it("step preview: steps 1–2 done, step 3 active, step 4 plain", async () => {
			const { wrapper } = await mountView();
			await toPreviewStep(wrapper);
			const steps = wrapper.findAll(".step");
			expect(steps[0].classes()).toContain("step--done");
			expect(steps[1].classes()).toContain("step--done");
			expect(steps[2].classes()).toContain("step--active");
			expect(steps[2].classes()).not.toContain("step--done");
			expect(steps[3].classes()).not.toContain("step--active");
			expect(steps[3].classes()).not.toContain("step--done");
		});

		it("step done: steps 1–3 done, step 4 active", async () => {
			const { wrapper } = await mountView();
			await toDoneStep(wrapper);
			const steps = wrapper.findAll(".step");
			expect(steps[0].classes()).toContain("step--done");
			expect(steps[1].classes()).toContain("step--done");
			expect(steps[2].classes()).toContain("step--done");
			expect(steps[3].classes()).toContain("step--active");
			expect(steps[3].classes()).not.toContain("step--done");
		});
	});
});
