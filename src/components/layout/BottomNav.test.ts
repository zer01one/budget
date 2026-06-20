import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import BottomNav from "./BottomNav.vue";

function makeRouter(initialPath = "/dashboard") {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: ["/dashboard", "/transactions", "/accounts", "/charts", "/profile", "/transactions/add"].map((p) => ({
			path: p,
			component: { template: "<div/>" }
		}))
	});
	router.push(initialPath);
	return router;
}

describe("BottomNav – renders 5 items", () => {
	it("always renders exactly 5 nav items", async () => {
		const router = makeRouter();
		await router.isReady();
		const w = mount(BottomNav, { global: { plugins: [router] } });
		expect(w.findAll(".bottom-nav__item")).toHaveLength(5);
	});
});

describe("BottomNav – active class", () => {
	it("active item at /dashboard", async () => {
		const router = makeRouter("/dashboard");
		await router.isReady();
		const w = mount(BottomNav, { global: { plugins: [router] } });
		const active = w.findAll(".bottom-nav__item--active");
		expect(active).toHaveLength(1);
		expect(active[0].find(".bottom-nav__label").text()).toBe("Главная");
	});

	it("active item at /transactions", async () => {
		const router = makeRouter("/transactions");
		await router.isReady();
		const w = mount(BottomNav, { global: { plugins: [router] } });
		const active = w.find(".bottom-nav__item--active");
		expect(active.find(".bottom-nav__label").text()).toBe("Операции");
	});

	it("isActive uses startsWith — /transactions/add activates Операции", async () => {
		const router = makeRouter("/transactions/add");
		await router.isReady();
		const w = mount(BottomNav, { global: { plugins: [router] } });
		const active = w.find(".bottom-nav__item--active");
		expect(active.find(".bottom-nav__label").text()).toBe("Операции");
	});

	it("no active item when path is unknown", async () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div/>" } }]
		});
		router.push("/unknown");
		await router.isReady();
		const w = mount(BottomNav, { global: { plugins: [router] } });
		expect(w.findAll(".bottom-nav__item--active")).toHaveLength(0);
	});

	it("active item at /accounts", async () => {
		const router = makeRouter("/accounts");
		await router.isReady();
		const w = mount(BottomNav, { global: { plugins: [router] } });
		const active = w.find(".bottom-nav__item--active");
		expect(active.find(".bottom-nav__label").text()).toBe("Счета");
	});

	it("active item at /charts", async () => {
		const router = makeRouter("/charts");
		await router.isReady();
		const w = mount(BottomNav, { global: { plugins: [router] } });
		const active = w.find(".bottom-nav__item--active");
		expect(active.find(".bottom-nav__label").text()).toBe("Графики");
	});

	it("active item at /profile", async () => {
		const router = makeRouter("/profile");
		await router.isReady();
		const w = mount(BottomNav, { global: { plugins: [router] } });
		const active = w.find(".bottom-nav__item--active");
		expect(active.find(".bottom-nav__label").text()).toBe("Профиль");
	});
});

describe("BottomNav – navigation", () => {
	it("clicking an item calls router.push", async () => {
		const router = makeRouter("/dashboard");
		await router.isReady();
		const pushSpy = vi.spyOn(router, "push");
		const w = mount(BottomNav, { global: { plugins: [router] } });
		await w.findAll(".bottom-nav__item")[1].trigger("click");
		expect(pushSpy).toHaveBeenCalledWith("/transactions");
	});

	it("clicking each item navigates to correct path", async () => {
		const paths = ["/dashboard", "/transactions", "/accounts", "/charts", "/profile"];
		const router = makeRouter("/dashboard");
		await router.isReady();
		const pushSpy = vi.spyOn(router, "push");
		const w = mount(BottomNav, { global: { plugins: [router] } });
		for (let i = 0; i < paths.length; i++) {
			await w.findAll(".bottom-nav__item")[i].trigger("click");
			expect(pushSpy).toHaveBeenLastCalledWith(paths[i]);
		}
	});
});
