import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import CategoriesView from "@/views/CategoriesView.vue";
import { useCategoriesStore } from "@/stores/categories.store";
import type { Category } from "@/types";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockOnCategoryCreated } = vi.hoisted(() => ({
	mockOnCategoryCreated: vi.fn()
}));

vi.mock("@/stores/gamification.store", () => ({
	useGamificationStore: vi.fn(() => ({ onCategoryCreated: mockOnCategoryCreated }))
}));

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn(() => ({
		settings: { deviceId: "test-device", theme: "dark", vaultPath: null, notificationsEnabled: false, reminderTime: "20:00" }
	}))
}));

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn().mockResolvedValue({
		readJson: vi.fn().mockResolvedValue(null),
		writeJson: vi.fn().mockResolvedValue(undefined)
	})
}));


const mockShowConfirm = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("@/utils/confirm", () => ({ showConfirm: mockShowConfirm }));
// ── Globals ───────────────────────────────────────────────────────────────────

beforeAll(() => {
	vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
});

afterEach(() => {
	vi.clearAllMocks();
});

// ── Stubs ─────────────────────────────────────────────────────────────────────

const AppModalStub = {
	template: '<div class="modal-stub" :data-title="title"><slot /><slot name="footer" /></div>',
	props: ["title"],
	emits: ["close"]
};

// ── Fixtures ──────────────────────────────────────────────────────────────────

let catIdCounter = 0;

function makeCat(overrides: Partial<Category> = {}): Category {
	return {
		id: `cat-${++catIdCounter}`,
		name: "Продукты",
		type: "expense",
		color: "#EF4444",
		icon: "🛒",
		parentId: null,
		isSystem: false,
		isArchived: false,
		sortOrder: 0,
		updatedAt: "2026-01-01T00:00:00Z",
		deviceId: "test-device",
		version: 1,
		...overrides
	};
}

// ── Mount helper ──────────────────────────────────────────────────────────────

let pinia: ReturnType<typeof createPinia>;

async function mountView() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: "/", component: CategoriesView }]
	});
	router.push("/");
	await router.isReady();
	const wrapper = mount(CategoriesView, {
		global: {
			plugins: [pinia, router],
			stubs: {
				AppModal: AppModalStub,
				ColorPicker: { template: "<div />", props: ["modelValue", "label"], emits: ["update:modelValue"] },
				IconPicker: { template: "<div />", props: ["modelValue", "label"], emits: ["update:modelValue"] }
			}
		}
	});
	await flushPromises();
	return wrapper;
}

// In jsdom transitions are zero-length, but Vue still swaps leave classes
// through requestAnimationFrame — flush two frames to let the old list unmount.
async function flushSlide() {
	await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
	await flushPromises();
}

// ── List rendering ────────────────────────────────────────────────────────────

describe("CategoriesView – list rendering", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("renders expense categories by default", async () => {
		useCategoriesStore().$patch({ categories: [makeCat({ name: "Еда", type: "expense" })] });
		const wrapper = await mountView();
		expect(wrapper.findAll(".cat-row")).toHaveLength(1);
		expect(wrapper.find(".cat-row__name").text()).toBe("Еда");
	});

	it("does not render income categories when expense tab is active", async () => {
		useCategoriesStore().$patch({
			categories: [makeCat({ name: "Зарплата", type: "income" }), makeCat({ name: "Еда", type: "expense" })]
		});
		const wrapper = await mountView();
		const names = wrapper.findAll(".cat-row__name").map((n) => n.text());
		expect(names).not.toContain("Зарплата");
		expect(names).toContain("Еда");
	});

	it("does not render archived categories", async () => {
		useCategoriesStore().$patch({
			categories: [makeCat({ name: "Старая", isArchived: true }), makeCat({ name: "Активная" })]
		});
		const wrapper = await mountView();
		const names = wrapper.findAll(".cat-row__name").map((n) => n.text());
		expect(names).not.toContain("Старая");
		expect(names).toContain("Активная");
	});

	it("shows empty state when no matching categories", async () => {
		const wrapper = await mountView();
		expect(wrapper.find(".cat-list__empty").exists()).toBe(true);
	});

	it("hides empty state when categories exist", async () => {
		useCategoriesStore().$patch({ categories: [makeCat()] });
		const wrapper = await mountView();
		expect(wrapper.find(".cat-list__empty").exists()).toBe(false);
	});

	it("shows delete button and no system badge for system categories", async () => {
		useCategoriesStore().$patch({ categories: [makeCat({ isSystem: true })] });
		const wrapper = await mountView();
		expect(wrapper.find(".cat-row__system").exists()).toBe(false);
		expect(wrapper.find(".cat-row__delete").exists()).toBe(true);
	});

	it("delete button on a system category calls deleteCategory", async () => {
		useCategoriesStore().$patch({ categories: [makeCat({ id: "sys-id", isSystem: true })] });
		const deleteSpy = vi.spyOn(useCategoriesStore(), "deleteCategory").mockResolvedValue(undefined);
		const wrapper = await mountView();
		await wrapper.find(".cat-row__delete").trigger("click");
		await flushPromises();
		expect(deleteSpy).toHaveBeenCalledWith("sys-id");
	});

	it("shows delete button and no system badge for non-system categories", async () => {
		useCategoriesStore().$patch({ categories: [makeCat({ isSystem: false })] });
		const wrapper = await mountView();
		expect(wrapper.find(".cat-row__delete").exists()).toBe(true);
		expect(wrapper.find(".cat-row__system").exists()).toBe(false);
	});
});

// ── Tabs ──────────────────────────────────────────────────────────────────────

describe("CategoriesView – tabs", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("expense tab is active by default", async () => {
		const wrapper = await mountView();
		const tabs = wrapper.findAll(".tab");
		expect(tabs[0].classes()).toContain("tab--active");
		expect(tabs[1].classes()).not.toContain("tab--active");
	});

	it("clicking income tab sets it as active", async () => {
		const wrapper = await mountView();
		await wrapper.findAll(".tab")[1].trigger("click");
		const tabs = wrapper.findAll(".tab");
		expect(tabs[1].classes()).toContain("tab--active");
		expect(tabs[0].classes()).not.toContain("tab--active");
	});

	it("switching to income tab shows income categories", async () => {
		useCategoriesStore().$patch({
			categories: [makeCat({ name: "Зарплата", type: "income" }), makeCat({ name: "Еда", type: "expense" })]
		});
		const wrapper = await mountView();
		await wrapper.findAll(".tab")[1].trigger("click");
		// The old list leaves via a slide transition scheduled through rAF
		await flushSlide();
		const names = wrapper.findAll(".cat-row__name").map((n) => n.text());
		expect(names).toContain("Зарплата");
		expect(names).not.toContain("Еда");
	});

	it("expense → income slides forward", async () => {
		const wrapper = await mountView();
		await wrapper.findAll(".tab")[1].trigger("click");
		expect((wrapper.vm.$ as any).setupState.tabTransition).toBe("tab-forward");
	});

	it("income → expense slides back", async () => {
		const wrapper = await mountView();
		await wrapper.findAll(".tab")[1].trigger("click");
		await flushSlide();
		await wrapper.findAll(".tab")[0].trigger("click");
		expect((wrapper.vm.$ as any).setupState.tabTransition).toBe("tab-back");
	});
});

// ── openAdd ───────────────────────────────────────────────────────────────────

describe("CategoriesView – openAdd", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("modal is hidden on initial render", async () => {
		const wrapper = await mountView();
		expect(wrapper.find(".modal-stub").exists()).toBe(false);
	});

	it("clicking '+ Добавить' opens the modal", async () => {
		const wrapper = await mountView();
		await wrapper.find(".categories-view__header button").trigger("click");
		expect(wrapper.find(".modal-stub").exists()).toBe(true);
	});

	it("modal title is 'Новая категория' for add", async () => {
		const wrapper = await mountView();
		await wrapper.find(".categories-view__header button").trigger("click");
		expect(wrapper.find(".modal-stub").attributes("data-title")).toBe("Новая категория");
	});

	it("form.type defaults to 'expense' when expense tab is active", async () => {
		const wrapper = await mountView();
		await wrapper.find(".categories-view__header button").trigger("click");
		const typeBtns = wrapper.findAll(".type-btn");
		expect(typeBtns[0].classes()).toContain("type-btn--active");
		expect(typeBtns[1].classes()).not.toContain("type-btn--active");
	});

	it("form.type defaults to 'income' when income tab is active", async () => {
		const wrapper = await mountView();
		await wrapper.findAll(".tab")[1].trigger("click");
		await wrapper.find(".categories-view__header button").trigger("click");
		const typeBtns = wrapper.findAll(".type-btn");
		expect(typeBtns[1].classes()).toContain("type-btn--active");
		expect(typeBtns[0].classes()).not.toContain("type-btn--active");
	});

	it("type selector is visible in add mode", async () => {
		const wrapper = await mountView();
		await wrapper.find(".categories-view__header button").trigger("click");
		expect(wrapper.find(".type-btns").exists()).toBe(true);
	});
});

// ── openEdit ──────────────────────────────────────────────────────────────────

describe("CategoriesView – openEdit", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("clicking a non-system category opens 'Редактировать' modal", async () => {
		useCategoriesStore().$patch({ categories: [makeCat({ name: "Еда" })] });
		const wrapper = await mountView();
		await wrapper.find(".cat-row").trigger("click");
		expect(wrapper.find(".modal-stub").attributes("data-title")).toBe("Редактировать");
	});

	it("clicking a system category opens 'Редактировать' modal too", async () => {
		useCategoriesStore().$patch({ categories: [makeCat({ isSystem: true })] });
		const wrapper = await mountView();
		await wrapper.find(".cat-row").trigger("click");
		expect(wrapper.find(".modal-stub").attributes("data-title")).toBe("Редактировать");
	});

	it("form name is pre-filled with category name on edit", async () => {
		useCategoriesStore().$patch({ categories: [makeCat({ name: "Кофе" })] });
		const wrapper = await mountView();
		await wrapper.find(".cat-row").trigger("click");
		const input = wrapper.find("input");
		expect((input.element as HTMLInputElement).value).toBe("Кофе");
	});

	it("type selector is hidden in edit mode", async () => {
		useCategoriesStore().$patch({ categories: [makeCat()] });
		const wrapper = await mountView();
		await wrapper.find(".cat-row").trigger("click");
		expect(wrapper.find(".type-btns").exists()).toBe(false);
	});
});

// ── Validation ────────────────────────────────────────────────────────────────

describe("CategoriesView – validate", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("empty name shows validation error", async () => {
		const wrapper = await mountView();
		await wrapper.find(".categories-view__header button").trigger("click");
		const saveBtn = wrapper.findAll(".modal-stub button").find((b) => b.text().includes("Создать"));
		await saveBtn!.trigger("click");
		await flushPromises();
		expect(wrapper.find(".field__error").text()).toBe("Введите название");
	});

	it("save with empty name does not call addCategory", async () => {
		const addSpy = vi.spyOn(useCategoriesStore(), "addCategory").mockResolvedValue(makeCat());
		const wrapper = await mountView();
		await wrapper.find(".categories-view__header button").trigger("click");
		const saveBtn = wrapper.findAll(".modal-stub button").find((b) => b.text().includes("Создать"));
		await saveBtn!.trigger("click");
		await flushPromises();
		expect(addSpy).not.toHaveBeenCalled();
	});
});

// ── save: add ─────────────────────────────────────────────────────────────────

describe("CategoriesView – save: add", () => {
	let addSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		addSpy = vi.spyOn(useCategoriesStore(), "addCategory").mockResolvedValue(makeCat({ id: "new-cat" }));
	});

	it("calls addCategory with trimmed name and active type", async () => {
		const wrapper = await mountView();
		await wrapper.find(".categories-view__header button").trigger("click");
		await wrapper.find("input").setValue("  Транспорт  ");
		const saveBtn = wrapper.findAll(".modal-stub button").find((b) => b.text().includes("Создать"));
		await saveBtn!.trigger("click");
		await flushPromises();
		expect(addSpy).toHaveBeenCalledOnce();
		expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ name: "Транспорт", type: "expense" }));
	});

	it("calls onCategoryCreated after successful add", async () => {
		const wrapper = await mountView();
		await wrapper.find(".categories-view__header button").trigger("click");
		await wrapper.find("input").setValue("Транспорт");
		const saveBtn = wrapper.findAll(".modal-stub button").find((b) => b.text().includes("Создать"));
		await saveBtn!.trigger("click");
		await flushPromises();
		expect(mockOnCategoryCreated).toHaveBeenCalledOnce();
	});

	it("closes modal after successful add", async () => {
		const wrapper = await mountView();
		await wrapper.find(".categories-view__header button").trigger("click");
		await wrapper.find("input").setValue("Транспорт");
		const saveBtn = wrapper.findAll(".modal-stub button").find((b) => b.text().includes("Создать"));
		await saveBtn!.trigger("click");
		await flushPromises();
		expect(wrapper.find(".modal-stub").exists()).toBe(false);
	});
});

// ── save: edit ────────────────────────────────────────────────────────────────

describe("CategoriesView – save: edit", () => {
	let updateSpy: ReturnType<typeof vi.spyOn>;
	const existingCat = makeCat({ id: "edit-cat-id", name: "Еда", type: "expense" });

	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		useCategoriesStore().$patch({ categories: [existingCat] });
		updateSpy = vi.spyOn(useCategoriesStore(), "updateCategory").mockResolvedValue(undefined);
	});

	it("calls updateCategory with correct id and patched name", async () => {
		const wrapper = await mountView();
		await wrapper.find(".cat-row").trigger("click");
		await wrapper.find("input").setValue("Еда и напитки");
		const saveBtn = wrapper.findAll(".modal-stub button").find((b) => b.text().includes("Сохранить"));
		await saveBtn!.trigger("click");
		await flushPromises();
		expect(updateSpy).toHaveBeenCalledOnce();
		expect(updateSpy).toHaveBeenCalledWith("edit-cat-id", expect.objectContaining({ name: "Еда и напитки" }));
	});

	it("does NOT call onCategoryCreated on edit", async () => {
		const wrapper = await mountView();
		await wrapper.find(".cat-row").trigger("click");
		const saveBtn = wrapper.findAll(".modal-stub button").find((b) => b.text().includes("Сохранить"));
		await saveBtn!.trigger("click");
		await flushPromises();
		expect(mockOnCategoryCreated).not.toHaveBeenCalled();
	});

	it("closes modal after successful edit", async () => {
		const wrapper = await mountView();
		await wrapper.find(".cat-row").trigger("click");
		const saveBtn = wrapper.findAll(".modal-stub button").find((b) => b.text().includes("Сохранить"));
		await saveBtn!.trigger("click");
		await flushPromises();
		expect(wrapper.find(".modal-stub").exists()).toBe(false);
	});
});

// ── delete ────────────────────────────────────────────────────────────────────

describe("CategoriesView – delete", () => {
	let deleteSpy: ReturnType<typeof vi.spyOn>;
	const cat = makeCat({ id: "del-cat-id", name: "Спорт" });

	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		useCategoriesStore().$patch({ categories: [cat] });
		deleteSpy = vi.spyOn(useCategoriesStore(), "deleteCategory").mockResolvedValue(undefined);
	});

	it("confirm → calls deleteCategory with the category id", async () => {
		const wrapper = await mountView();
		await wrapper.find(".cat-row__delete").trigger("click");
		await flushPromises();
		expect(deleteSpy).toHaveBeenCalledWith("del-cat-id");
	});

	it("cancel confirm → does NOT call deleteCategory", async () => {
		mockShowConfirm.mockResolvedValueOnce(false);
		const wrapper = await mountView();
		await wrapper.find(".cat-row__delete").trigger("click");
		await flushPromises();
		expect(deleteSpy).not.toHaveBeenCalled();
	});
});

// ── cancel button ─────────────────────────────────────────────────────────────

describe("CategoriesView – cancel", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
	});

	it("clicking Отмена closes modal", async () => {
		const wrapper = await mountView();
		await wrapper.find(".categories-view__header button").trigger("click");
		expect(wrapper.find(".modal-stub").exists()).toBe(true);
		const cancelBtn = wrapper.findAll(".modal-stub button").find((b) => b.text().includes("Отмена"));
		await cancelBtn!.trigger("click");
		expect(wrapper.find(".modal-stub").exists()).toBe(false);
	});
});
