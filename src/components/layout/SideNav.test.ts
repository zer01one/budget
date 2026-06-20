import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { createTestingPinia } from "@pinia/testing";
import SideNav from "./SideNav.vue";

function makeRouter(initialPath = "/dashboard") {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: ["/dashboard", "/transactions", "/accounts", "/categories", "/charts", "/budgets", "/profile", "/transactions/add"].map((p) => ({
			path: p,
			component: { template: "<div/>" }
		}))
	});
	router.push(initialPath);
	return router;
}

async function mountSideNav(initialPath = "/dashboard", sidebarExpanded = false) {
	const router = makeRouter(initialPath);
	await router.isReady();
	const pinia = createTestingPinia({
		createSpy: vi.fn,
		initialState: {
			settings: { settings: { sidebarExpanded } }
		}
	});
	return { w: mount(SideNav, { global: { plugins: [router, pinia] } }), router };
}

describe("SideNav – items", () => {
	it("renders 7 nav items", async () => {
		const { w } = await mountSideNav();
		await w.vm.$nextTick();
		expect(w.findAll(".side-nav__item")).toHaveLength(7);
	});
});

describe("SideNav – expanded/collapsed class", () => {
	it("collapsed by default — no side-nav--expanded class", async () => {
		const { w } = await mountSideNav("/dashboard", false);
		await w.vm.$nextTick();
		expect(w.find(".side-nav").classes()).not.toContain("side-nav--expanded");
	});

	it("expanded when sidebarExpanded = true", async () => {
		const { w } = await mountSideNav("/dashboard", true);
		await w.vm.$nextTick();
		expect(w.find(".side-nav").classes()).toContain("side-nav--expanded");
	});
});

describe("SideNav – labels visibility", () => {
	it("labels hidden when collapsed", async () => {
		const { w } = await mountSideNav("/dashboard", false);
		await w.vm.$nextTick();
		expect(w.findAll(".side-nav__label")).toHaveLength(0);
	});

	it("labels shown when expanded", async () => {
		const { w } = await mountSideNav("/dashboard", true);
		await w.vm.$nextTick();
		expect(w.findAll(".side-nav__label")).toHaveLength(7);
	});
});

describe("SideNav – toggle button", () => {
	it("toggle shows ▶ when collapsed", async () => {
		const { w } = await mountSideNav("/dashboard", false);
		await w.vm.$nextTick();
		expect(w.find(".side-nav__toggle").text()).toBe("▶");
	});

	it("toggle shows ◀ when expanded", async () => {
		const { w } = await mountSideNav("/dashboard", true);
		await w.vm.$nextTick();
		expect(w.find(".side-nav__toggle").text()).toBe("◀");
	});

	it("clicking toggle calls settingsStore.toggleSidebar", async () => {
		const router = makeRouter();
		const pinia = createTestingPinia({
			createSpy: vi.fn,
			initialState: { settings: { settings: { sidebarExpanded: false } } }
		});
		await router.isReady();
		const w = mount(SideNav, { global: { plugins: [router, pinia] } });
		const { useSettingsStore } = await import("@/stores/settings.store");
		const store = useSettingsStore();
		await w.find(".side-nav__toggle").trigger("click");
		expect(store.toggleSidebar).toHaveBeenCalledOnce();
	});
});

describe("SideNav – active state", () => {
	it("active class on /dashboard item", async () => {
		const { w } = await mountSideNav("/dashboard");
		await w.vm.$nextTick();
		const active = w.findAll(".side-nav__item--active");
		expect(active).toHaveLength(1);
	});

	it("isActive startsWith — /transactions/add activates Операции", async () => {
		const { w } = await mountSideNav("/transactions/add", true);
		await w.vm.$nextTick();
		const active = w.find(".side-nav__item--active");
		expect(active.find(".side-nav__label").text()).toBe("Операции");
	});

	it("no active item on unknown path", async () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div/>" } }]
		});
		router.push("/unknown");
		const pinia = createTestingPinia({
			createSpy: vi.fn,
			initialState: { settings: { settings: { sidebarExpanded: false } } }
		});
		await router.isReady();
		const w = mount(SideNav, { global: { plugins: [router, pinia] } });
		expect(w.findAll(".side-nav__item--active")).toHaveLength(0);
	});
});

describe("SideNav – navigation", () => {
	it("clicking a nav item calls router.push", async () => {
		const { w, router } = await mountSideNav("/dashboard");
		const pushSpy = vi.spyOn(router, "push");
		await w.findAll(".side-nav__item")[0].trigger("click");
		expect(pushSpy).toHaveBeenCalledWith("/dashboard");
	});
});
