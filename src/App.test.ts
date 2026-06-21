import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import App from "./App.vue";
import { useSettingsStore } from "@/stores/settings.store";

vi.mock("@/stores/settings.store", () => ({
	useSettingsStore: vi.fn()
}));

vi.mock("@/components/layout/AppShell.vue", () => ({
	default: { template: "<div class='app-shell'><slot /></div>", name: "AppShell" }
}));

let mockApplyTheme: ReturnType<typeof vi.fn>;

beforeEach(() => {
	setActivePinia(createPinia());
	mockApplyTheme = vi.fn();
	vi.mocked(useSettingsStore).mockReturnValue({
		applyTheme: mockApplyTheme
	} as any);
});

afterEach(() => {
	vi.clearAllMocks();
});

function mountApp(routeName: string) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: "/setup", name: "setup", component: { template: "<div class='setup-page' />" } },
			{ path: "/", name: "home", component: { template: "<div class='home-page' />" } }
		]
	});
	router.push(routeName === "setup" ? "/setup" : "/");
	return router.isReady().then(() => mount(App, { global: { plugins: [router] } }));
}

describe("App.vue", () => {
	it("calls applyTheme on mount", async () => {
		await mountApp("home");
		expect(mockApplyTheme).toHaveBeenCalledOnce();
	});

	it("renders AppShell for non-setup routes", async () => {
		const wrapper = await mountApp("home");
		expect(wrapper.find(".app-shell").exists()).toBe(true);
	});

	it("renders without AppShell on setup route", async () => {
		const wrapper = await mountApp("setup");
		expect(wrapper.find(".app-shell").exists()).toBe(false);
	});
});
