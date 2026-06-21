import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import SetupView from "./SetupView.vue";
import { getFileSystemAdapter } from "@/services/filesystem";
import { vaultService } from "@/services/data/vault.service";
import { useSettingsStore } from "@/stores/settings.store";

// ─── mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/services/filesystem", () => ({
	getFileSystemAdapter: vi.fn()
}));

vi.mock("@/services/data/vault.service", () => ({
	vaultService: { initNewVault: vi.fn(), readMetadata: vi.fn() }
}));

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn()
}));

// ─── setup ─────────────────────────────────────────────────────────────────────

let pinia: ReturnType<typeof createPinia>;
let mockSetVaultPath: ReturnType<typeof vi.fn>;

beforeAll(() => {
	vi.stubGlobal("__TAURI_INTERNALS__", { invoke: vi.fn().mockResolvedValue({}) });
});

beforeEach(() => {
	pinia = createPinia();
	setActivePinia(pinia);

	vi.mocked(getFileSystemAdapter).mockResolvedValue({
		pickFolder: vi.fn().mockResolvedValue({ uri: "/vault/path" }),
		readJson: vi.fn().mockResolvedValue(null),
		writeJson: vi.fn().mockResolvedValue(undefined)
	} as any);

	vi.mocked(vaultService.initNewVault).mockResolvedValue(undefined);
	vi.mocked(vaultService.readMetadata).mockResolvedValue({ schemaVersion: 1 } as any);

	mockSetVaultPath = vi.fn().mockResolvedValue(undefined);
	vi.mocked(useSettingsStore).mockReturnValue({
		settings: { deviceId: "test-device" },
		setVaultPath: mockSetVaultPath
	} as any);
});

afterEach(() => {
	vi.clearAllMocks();
});

async function mountView() {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: "/", component: SetupView },
			{ path: "/dashboard", component: { template: "<div/>" } }
		]
	});
	router.push("/");
	await router.isReady();
	const wrapper = mount(SetupView, { global: { plugins: [pinia, router] } });
	return { wrapper, router };
}

// ─── initial render ────────────────────────────────────────────────────────────

describe("SetupView – initial render", () => {
	it("shows logo", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".setup__logo").exists()).toBe(true);
	});

	it("shows title 'Budget'", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".setup__title").text()).toBe("Budget");
	});

	it("renders two action buttons", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.findAll("button")).toHaveLength(2);
	});

	it("first button label mentions creation", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.findAll("button")[0].text()).toContain("Создать");
	});

	it("second button label mentions opening", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.findAll("button")[1].text()).toContain("Открыть");
	});

	it("loading spinner is hidden initially", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".setup__loading").exists()).toBe(false);
	});

	it("error block is hidden initially", async () => {
		const { wrapper } = await mountView();
		expect(wrapper.find(".setup__error").exists()).toBe(false);
	});
});

// ─── createNewVault ────────────────────────────────────────────────────────────

describe("SetupView – createNewVault", () => {
	it("shows loading spinner while vault is initializing", async () => {
		// step = "loading" is set after pickFolder resolves; keep setVaultPath pending
		mockSetVaultPath.mockReturnValue(new Promise<void>(() => {}));
		const { wrapper } = await mountView();
		await wrapper.findAll("button")[0].trigger("click");
		// flush getFileSystemAdapter → pickFolder → step = "loading" microtasks
		await wrapper.vm.$nextTick();
		await wrapper.vm.$nextTick();
		await wrapper.vm.$nextTick();
		expect(wrapper.find(".setup__loading").exists()).toBe(true);
	});

	it("hides action buttons while loading", async () => {
		mockSetVaultPath.mockReturnValue(new Promise<void>(() => {}));
		const { wrapper } = await mountView();
		await wrapper.findAll("button")[0].trigger("click");
		await wrapper.vm.$nextTick();
		await wrapper.vm.$nextTick();
		await wrapper.vm.$nextTick();
		expect(wrapper.find(".setup__actions").exists()).toBe(false);
	});

	it("navigates to /dashboard on success", async () => {
		const { wrapper, router } = await mountView();
		const pushSpy = vi.spyOn(router, "push");
		await wrapper.findAll("button")[0].trigger("click");
		await flushPromises();
		expect(pushSpy).toHaveBeenCalledWith("/dashboard");
	});

	it("calls setVaultPath with the picked URI", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll("button")[0].trigger("click");
		await flushPromises();
		expect(mockSetVaultPath).toHaveBeenCalledWith("/vault/path");
	});

	it("calls initNewVault once", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll("button")[0].trigger("click");
		await flushPromises();
		expect(vaultService.initNewVault).toHaveBeenCalledOnce();
	});

	it("shows error text when pickFolder throws", async () => {
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			pickFolder: vi.fn().mockRejectedValue(new Error("Permission denied"))
		} as any);
		const { wrapper } = await mountView();
		await wrapper.findAll("button")[0].trigger("click");
		await flushPromises();
		expect(wrapper.find(".setup__error").text()).toContain("Permission denied");
	});

	it("restores choose step on error", async () => {
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			pickFolder: vi.fn().mockRejectedValue(new Error("err"))
		} as any);
		const { wrapper } = await mountView();
		await wrapper.findAll("button")[0].trigger("click");
		await flushPromises();
		expect(wrapper.find(".setup__actions").exists()).toBe(true);
	});

	it("does NOT navigate on error", async () => {
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			pickFolder: vi.fn().mockRejectedValue(new Error("err"))
		} as any);
		const { wrapper, router } = await mountView();
		const pushSpy = vi.spyOn(router, "push");
		await wrapper.findAll("button")[0].trigger("click");
		await flushPromises();
		expect(pushSpy).not.toHaveBeenCalledWith("/dashboard");
	});

	it("clears previous error on retry", async () => {
		const pickFolder = vi.fn().mockRejectedValueOnce(new Error("first error")).mockResolvedValue({ uri: "/v" });
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			pickFolder,
			readJson: vi.fn().mockResolvedValue(null),
			writeJson: vi.fn().mockResolvedValue(undefined)
		} as any);
		const { wrapper } = await mountView();
		await wrapper.findAll("button")[0].trigger("click");
		await flushPromises();
		expect(wrapper.find(".setup__error").exists()).toBe(true);
		await wrapper.findAll("button")[0].trigger("click");
		await flushPromises();
		expect(wrapper.find(".setup__error").exists()).toBe(false);
	});
});

// ─── openExistingVault ─────────────────────────────────────────────────────────

describe("SetupView – openExistingVault (metadata exists)", () => {
	it("navigates to /dashboard", async () => {
		const { wrapper, router } = await mountView();
		const pushSpy = vi.spyOn(router, "push");
		await wrapper.findAll("button")[1].trigger("click");
		await flushPromises();
		expect(pushSpy).toHaveBeenCalledWith("/dashboard");
	});

	it("does NOT call initNewVault", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll("button")[1].trigger("click");
		await flushPromises();
		expect(vaultService.initNewVault).not.toHaveBeenCalled();
	});

	it("calls setVaultPath with the picked URI", async () => {
		const { wrapper } = await mountView();
		await wrapper.findAll("button")[1].trigger("click");
		await flushPromises();
		expect(mockSetVaultPath).toHaveBeenCalledWith("/vault/path");
	});
});

describe("SetupView – openExistingVault (no metadata → init new vault)", () => {
	it("calls initNewVault when readMetadata returns null", async () => {
		vi.mocked(vaultService.readMetadata).mockResolvedValue(null);
		const { wrapper } = await mountView();
		await wrapper.findAll("button")[1].trigger("click");
		await flushPromises();
		expect(vaultService.initNewVault).toHaveBeenCalledOnce();
	});

	it("still navigates to /dashboard", async () => {
		vi.mocked(vaultService.readMetadata).mockResolvedValue(null);
		const { wrapper, router } = await mountView();
		const pushSpy = vi.spyOn(router, "push");
		await wrapper.findAll("button")[1].trigger("click");
		await flushPromises();
		expect(pushSpy).toHaveBeenCalledWith("/dashboard");
	});
});

describe("SetupView – openExistingVault error handling", () => {
	it("shows error when pickFolder throws", async () => {
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			pickFolder: vi.fn().mockRejectedValue(new Error("No access"))
		} as any);
		const { wrapper } = await mountView();
		await wrapper.findAll("button")[1].trigger("click");
		await flushPromises();
		expect(wrapper.find(".setup__error").text()).toContain("No access");
	});

	it("restores choose step on error", async () => {
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			pickFolder: vi.fn().mockRejectedValue(new Error("err"))
		} as any);
		const { wrapper } = await mountView();
		await wrapper.findAll("button")[1].trigger("click");
		await flushPromises();
		expect(wrapper.find(".setup__actions").exists()).toBe(true);
	});

	it("shows error when readMetadata throws", async () => {
		vi.mocked(vaultService.readMetadata).mockRejectedValue(new Error("Corrupt metadata"));
		const { wrapper } = await mountView();
		await wrapper.findAll("button")[1].trigger("click");
		await flushPromises();
		expect(wrapper.find(".setup__error").text()).toContain("Corrupt metadata");
	});

	it("does NOT navigate on error", async () => {
		vi.mocked(getFileSystemAdapter).mockResolvedValue({
			pickFolder: vi.fn().mockRejectedValue(new Error("err"))
		} as any);
		const { wrapper, router } = await mountView();
		const pushSpy = vi.spyOn(router, "push");
		await wrapper.findAll("button")[1].trigger("click");
		await flushPromises();
		expect(pushSpy).not.toHaveBeenCalledWith("/dashboard");
	});
});
