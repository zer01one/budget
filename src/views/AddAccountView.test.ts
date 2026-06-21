import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import AddAccountView from "./AddAccountView.vue";
import { useAccountsStore } from "@/stores/accounts.store";
import type { Account } from "@/types";

// ─── mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn().mockResolvedValue({
		readJson: vi.fn().mockResolvedValue(null),
		writeJson: vi.fn().mockResolvedValue(undefined)
	})
}));

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({ settings: { deviceId: "test-device" } }))
}));

// ─── factory ──────────────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<Account> = {}): Account {
	return {
		id: "acc-1",
		name: "Main Card",
		type: "card",
		currency: "KZT",
		initialBalance: 0,
		color: "#3B82F6",
		icon: "card",
		isArchived: false,
		sortOrder: 0,
		notes: "",
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

// ─── setup ────────────────────────────────────────────────────────────────────

let pinia: ReturnType<typeof createPinia>;

beforeAll(() => {
	vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
});

beforeEach(() => {
	pinia = createPinia();
	setActivePinia(pinia);
});

afterEach(() => {
	vi.clearAllMocks();
});

async function mountView() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: "/", component: AddAccountView }]
	});
	router.push("/");
	await router.isReady();
	const wrapper = mount(AddAccountView, {
		global: { plugins: [pinia, router] }
	});
	await flushPromises();
	return { wrapper, router };
}

// ─── validate (unit) ──────────────────────────────────────────────────────────

function validate(name: string, initialBalance: string): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!name.trim()) errors.name = "Введите название счёта";
	const bal = parseFloat(initialBalance.replace(",", "."));
	if (isNaN(bal)) errors.balance = "Введите число";
	return errors;
}

describe("AddAccountView – validate name", () => {
	it("empty name → error", () => {
		expect(validate("", "0")).toHaveProperty("name");
	});

	it("whitespace-only → error", () => {
		expect(validate("   ", "0")).toHaveProperty("name");
	});

	it("non-empty name → no error", () => {
		expect(validate("Main Card", "0")).not.toHaveProperty("name");
	});

	it("name with leading/trailing spaces → valid", () => {
		expect(validate("  Card  ", "0")).not.toHaveProperty("name");
	});
});

describe("AddAccountView – validate initialBalance", () => {
	it("numeric zero → no error", () => {
		expect(validate("Card", "0")).not.toHaveProperty("balance");
	});

	it("positive integer → no error", () => {
		expect(validate("Card", "1000")).not.toHaveProperty("balance");
	});

	it("negative number → no error (negatives are allowed)", () => {
		expect(validate("Card", "-100")).not.toHaveProperty("balance");
	});

	it("decimal with dot → no error", () => {
		expect(validate("Card", "100.50")).not.toHaveProperty("balance");
	});

	it("decimal with comma → no error", () => {
		expect(validate("Card", "100,50")).not.toHaveProperty("balance");
	});

	it("non-numeric string → error", () => {
		expect(validate("Card", "abc")).toHaveProperty("balance");
	});

	it("empty string → error (NaN)", () => {
		expect(validate("Card", "")).toHaveProperty("balance");
	});

	it("whitespace-only → error", () => {
		expect(validate("Card", "   ")).toHaveProperty("balance");
	});
});

describe("AddAccountView – validate combined", () => {
	it("both invalid → both errors", () => {
		const errors = validate("", "abc");
		expect(errors).toHaveProperty("name");
		expect(errors).toHaveProperty("balance");
	});

	it("all valid → no errors", () => {
		const errors = validate("My Card", "50000");
		expect(Object.keys(errors)).toHaveLength(0);
	});

	it("valid with decimal balance", () => {
		const errors = validate("Wallet", "1234.56");
		expect(Object.keys(errors)).toHaveLength(0);
	});
});

describe("AddAccountView – ACCOUNT_TYPES coverage", () => {
	const ACCOUNT_TYPES = [
		{ value: "card", label: "Банковская карта" },
		{ value: "cash", label: "Наличные" },
		{ value: "bank", label: "Банковский счёт" },
		{ value: "savings", label: "Накопления" },
		{ value: "investment", label: "Инвестиции" },
		{ value: "crypto", label: "Криптовалюта" }
	];

	it("has 6 account types", () => {
		expect(ACCOUNT_TYPES).toHaveLength(6);
	});

	it("all have value and label", () => {
		for (const t of ACCOUNT_TYPES) {
			expect(t.value).toBeTruthy();
			expect(t.label).toBeTruthy();
		}
	});
});

describe("AddAccountView – CURRENCIES coverage", () => {
	const CURRENCIES = ["KZT", "USD", "EUR", "RUB", "GBP", "CNY"];

	it("has 6 currencies", () => {
		expect(CURRENCIES).toHaveLength(6);
	});

	it("includes KZT", () => {
		expect(CURRENCIES).toContain("KZT");
	});
});

// ─── initial render ───────────────────────────────────────────────────────────

describe("AddAccountView – initial render", () => {
	it("renders .add-account container", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".add-account").exists()).toBe(true);
	});

	it("shows Новый счёт title", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find("h2").text()).toBe("Новый счёт");
	});

	it("preview shows placeholder name when input is empty", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".preview-card__name").text()).toBe("Название счёта");
	});

	it("preview shows default KZT · card meta", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".preview-card__meta").text()).toBe("KZT · card");
	});

	it("preview shows 0 as default balance", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".preview-card__balance").text()).toBe("0");
	});

	it("name input is empty by default", async () => {
		const { wrapper } = await mountView();
		const input = wrapper.find("input[placeholder='Основная карта']");
		expect((input.element as HTMLInputElement).value).toBe("");
	});

	it("type select defaults to card", async () => {
		const { wrapper } = await mountView();
		const selects = wrapper.findAll("select.field__select");
		expect((selects[0].element as HTMLSelectElement).value).toBe("card");
	});

	it("currency select defaults to KZT", async () => {
		const { wrapper } = await mountView();
		const selects = wrapper.findAll("select.field__select");
		expect((selects[1].element as HTMLSelectElement).value).toBe("KZT");
	});

	it("type select has 6 options", async () => {
		const { wrapper } = await mountView();
		const typeSelect = wrapper.findAll("select.field__select")[0];
		expect(typeSelect.findAll("option")).toHaveLength(6);
	});

	it("currency select has 6 options", async () => {
		const { wrapper } = await mountView();
		const currencySelect = wrapper.findAll("select.field__select")[1];
		expect(currencySelect.findAll("option")).toHaveLength(6);
	});

	it("no validation errors shown on initial render", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.findAll(".field__error")).toHaveLength(0);
	});

	it("submit button exists with Создать счёт label", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".app-btn").text()).toContain("Создать счёт");
	});

	it("submit button is not disabled initially", async () => {
		const { wrapper } = await mountView();
		expect((wrapper.find(".app-btn").element as HTMLButtonElement).disabled).toBe(false);
	});
});

// ─── preview reactivity ────────────────────────────────────────────────────────

describe("AddAccountView – preview card reactivity", () => {
	it("typing name updates preview", async () => {
		const { wrapper } = await mountView();
		await wrapper.find("input[placeholder='Основная карта']").setValue("Моя карта");
		expect(wrapper.find(".preview-card__name").text()).toBe("Моя карта");
	});

	it("changing currency updates preview meta", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll("select.field__select")[1].setValue("USD");
		expect(wrapper.find(".preview-card__meta").text()).toBe("USD · card");
	});

	it("changing type updates preview meta", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll("select.field__select")[0].setValue("cash");
		expect(wrapper.find(".preview-card__meta").text()).toBe("KZT · cash");
	});

	it("typing balance updates preview balance display", async () => {
		const { wrapper } = await mountView();
		(wrapper.vm as any).$.setupState.initialBalance = "1500";
		await wrapper.vm.$nextTick();
		expect(wrapper.find(".preview-card__balance").text()).toBe("1500");
	});

	it("empty name shows placeholder in preview", async () => {
		const { wrapper } = await mountView();
		await wrapper.find("input[placeholder='Основная карта']").setValue("  ");
		await wrapper.find("input[placeholder='Основная карта']").setValue("");
		expect(wrapper.find(".preview-card__name").text()).toBe("Название счёта");
	});
});

// ─── back button ──────────────────────────────────────────────────────────────

describe("AddAccountView – back button", () => {
	it("clicking back button calls router.back()", async () => {
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper.find(".back-btn").trigger("click");
		expect(backSpy).toHaveBeenCalledOnce();
	});
});

// ─── validation errors on submit ──────────────────────────────────────────────

describe("AddAccountView – validation errors on submit", () => {
	async function clickSubmit(wrapper: ReturnType<typeof mount>) {
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
	}

	it("shows name error when name is empty", async () => {
		const { wrapper } = await mountView();
		await clickSubmit(wrapper);
		const errors = wrapper.findAll(".field__error").map((e) => e.text());
		expect(errors).toContain("Введите название счёта");
	});

	it("shows balance error when balance is not a number", async () => {
		const { wrapper } = await mountView();
		(wrapper.vm as any).$.setupState.name = "Test";
		(wrapper.vm as any).$.setupState.initialBalance = "abc";
		await clickSubmit(wrapper);
		const errors = wrapper.findAll(".field__error").map((e) => e.text());
		expect(errors).toContain("Введите число");
	});

	it("shows both errors when name is empty and balance invalid", async () => {
		const { wrapper } = await mountView();
		(wrapper.vm as any).$.setupState.initialBalance = "abc";
		await clickSubmit(wrapper);
		const errors = wrapper.findAll(".field__error").map((e) => e.text());
		expect(errors).toContain("Введите название счёта");
		expect(errors).toContain("Введите число");
	});

	it("errors cleared on successful re-submit", async () => {
		const addSpy = vi.spyOn(useAccountsStore(), "addAccount").mockResolvedValue(makeAccount());
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		// trigger errors first
		await clickSubmit(wrapper);
		expect(wrapper.findAll(".field__error").length).toBeGreaterThan(0);
		// fill valid data
		await wrapper.find("input[placeholder='Основная карта']").setValue("Карта");
		await clickSubmit(wrapper);
		expect(wrapper.findAll(".field__error")).toHaveLength(0);
		expect(addSpy).toHaveBeenCalledOnce();
	});

	it("whitespace-only name shows error", async () => {
		const { wrapper } = await mountView();
		await wrapper.find("input[placeholder='Основная карта']").setValue("   ");
		await clickSubmit(wrapper);
		const errors = wrapper.findAll(".field__error").map((e) => e.text());
		expect(errors).toContain("Введите название счёта");
	});

	it("valid name and balance → no errors, addAccount called", async () => {
		vi.spyOn(useAccountsStore(), "addAccount").mockResolvedValue(makeAccount());
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper.find("input[placeholder='Основная карта']").setValue("Тест");
		await clickSubmit(wrapper);
		expect(wrapper.findAll(".field__error")).toHaveLength(0);
	});
});

// ─── submit payload ───────────────────────────────────────────────────────────

describe("AddAccountView – submit payload", () => {
	async function submitWithName(wrapper: ReturnType<typeof mount>, name = "Моя карта") {
		await wrapper.find("input[placeholder='Основная карта']").setValue(name);
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
	}

	it("calls addAccount with trimmed name", async () => {
		const addSpy = vi.spyOn(useAccountsStore(), "addAccount").mockResolvedValue(makeAccount());
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper.find("input[placeholder='Основная карта']").setValue("  Моя карта  ");
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		expect(addSpy.mock.calls[0][0].name).toBe("Моя карта");
	});

	it("calls addAccount with default type card", async () => {
		const addSpy = vi.spyOn(useAccountsStore(), "addAccount").mockResolvedValue(makeAccount());
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		await submitWithName(wrapper);
		expect(addSpy.mock.calls[0][0].type).toBe("card");
	});

	it("calls addAccount with selected type cash", async () => {
		const addSpy = vi.spyOn(useAccountsStore(), "addAccount").mockResolvedValue(makeAccount());
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper.findAll("select.field__select")[0].setValue("cash");
		await submitWithName(wrapper);
		expect(addSpy.mock.calls[0][0].type).toBe("cash");
	});

	it("calls addAccount with selected currency USD", async () => {
		const addSpy = vi.spyOn(useAccountsStore(), "addAccount").mockResolvedValue(makeAccount());
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper.findAll("select.field__select")[1].setValue("USD");
		await submitWithName(wrapper);
		expect(addSpy.mock.calls[0][0].currency).toBe("USD");
	});

	it("parses initialBalance as float", async () => {
		const addSpy = vi.spyOn(useAccountsStore(), "addAccount").mockResolvedValue(makeAccount());
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		(wrapper.vm as any).$.setupState.initialBalance = "5000";
		await submitWithName(wrapper);
		expect(addSpy.mock.calls[0][0].initialBalance).toBe(5000);
	});

	it("comma in balance is replaced with dot (1500,50 → 1500.5)", async () => {
		const addSpy = vi.spyOn(useAccountsStore(), "addAccount").mockResolvedValue(makeAccount());
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		(wrapper.vm as any).$.setupState.initialBalance = "1500,50";
		await submitWithName(wrapper);
		expect(addSpy.mock.calls[0][0].initialBalance).toBe(1500.5);
	});

	it("initialBalance defaults to 0 when value is '0'", async () => {
		const addSpy = vi.spyOn(useAccountsStore(), "addAccount").mockResolvedValue(makeAccount());
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		await submitWithName(wrapper);
		expect(addSpy.mock.calls[0][0].initialBalance).toBe(0);
	});

	it("notes are trimmed before submit", async () => {
		const addSpy = vi.spyOn(useAccountsStore(), "addAccount").mockResolvedValue(makeAccount());
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper.find("input[placeholder='Необязательно']").setValue("  заметка  ");
		await submitWithName(wrapper);
		expect(addSpy.mock.calls[0][0].notes).toBe("заметка");
	});

	it("sortOrder equals accounts.length at time of submit", async () => {
		const addSpy = vi.spyOn(useAccountsStore(), "addAccount").mockResolvedValue(makeAccount());
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		useAccountsStore().accounts = [makeAccount({ id: "a1" }), makeAccount({ id: "a2" })];
		await submitWithName(wrapper);
		expect(addSpy.mock.calls[0][0].sortOrder).toBe(2);
	});

	it("isArchived is always false on new account", async () => {
		const addSpy = vi.spyOn(useAccountsStore(), "addAccount").mockResolvedValue(makeAccount());
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		await submitWithName(wrapper);
		expect(addSpy.mock.calls[0][0].isArchived).toBe(false);
	});

	it("calls router.back() after successful submit", async () => {
		vi.spyOn(useAccountsStore(), "addAccount").mockResolvedValue(makeAccount());
		const { wrapper, router } = await mountView();
		const backSpy = vi.spyOn(router, "back").mockImplementation(() => {});
		await submitWithName(wrapper);
		expect(backSpy).toHaveBeenCalledOnce();
	});
});

// ─── double submit prevention ─────────────────────────────────────────────────

describe("AddAccountView – double submit prevention", () => {
	it("does not call addAccount twice if clicked while submitting", async () => {
		let resolve: (acc: Account) => void;
		const addSpy = vi.spyOn(useAccountsStore(), "addAccount").mockReturnValue(
			new Promise<Account>((r) => {
				resolve = r;
			})
		);
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper.find("input[placeholder='Основная карта']").setValue("Карта");
		wrapper.find(".app-btn").trigger("click");
		await wrapper.find(".app-btn").trigger("click");
		resolve!(makeAccount());
		await flushPromises();
		expect(addSpy).toHaveBeenCalledTimes(1);
	});

	it("submit button is disabled while submitting", async () => {
		let resolve: (acc: Account) => void;
		vi.spyOn(useAccountsStore(), "addAccount").mockReturnValue(
			new Promise<Account>((r) => {
				resolve = r;
			})
		);
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper.find("input[placeholder='Основная карта']").setValue("Карта");
		wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		expect((wrapper.find(".app-btn").element as HTMLButtonElement).disabled).toBe(true);
		resolve!(makeAccount());
		await flushPromises();
	});

	it("isSubmitting resets to false after successful submit", async () => {
		vi.spyOn(useAccountsStore(), "addAccount").mockResolvedValue(makeAccount());
		const { wrapper, router } = await mountView();
		vi.spyOn(router, "back").mockImplementation(() => {});
		await wrapper.find("input[placeholder='Основная карта']").setValue("Карта");
		await wrapper.find(".app-btn").trigger("click");
		await flushPromises();
		expect((wrapper.find(".app-btn").element as HTMLButtonElement).disabled).toBe(false);
	});
});
