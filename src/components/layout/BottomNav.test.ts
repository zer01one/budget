import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import BottomNav from "./BottomNav.vue";

// AppModal uses <Teleport to="body">. Stub teleport to render content in-place
// so wrapper.find() can locate sheet elements without querying document.body.
const TELEPORT_STUB = { template: "<div><slot/></div>" };

function makeRouter(initialPath = "/dashboard") {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			"/dashboard",
			"/transactions",
			"/accounts",
			"/charts",
			"/profile",
			"/categories",
			"/budgets",
			"/transactions/add"
		].map((p) => ({
			path: p,
			component: { template: "<div/>" }
		}))
	});
	router.push(initialPath);
	return router;
}

async function mountNav(initialPath = "/dashboard") {
	const router = makeRouter(initialPath);
	await router.isReady();
	const w = mount(BottomNav, {
		global: { plugins: [router], stubs: { teleport: TELEPORT_STUB } }
	});
	return { w, router };
}

describe("BottomNav – renders 5 items", () => {
	it("always renders exactly 5 nav items", async () => {
		const { w } = await mountNav();
		expect(w.findAll(".bottom-nav__item")).toHaveLength(5);
	});

	it("labels are Главная / Операции / Счета / Графики / Ещё", async () => {
		const { w } = await mountNav();
		const labels = w.findAll(".bottom-nav__label").map((l) => l.text());
		expect(labels).toEqual(["Главная", "Операции", "Счета", "Графики", "Ещё"]);
	});
});

describe("BottomNav – active class", () => {
	it("active item at /dashboard", async () => {
		const { w } = await mountNav("/dashboard");
		const active = w.findAll(".bottom-nav__item--active");
		expect(active).toHaveLength(1);
		expect(active[0].find(".bottom-nav__label").text()).toBe("Главная");
	});

	it("active item at /transactions", async () => {
		const { w } = await mountNav("/transactions");
		expect(w.find(".bottom-nav__item--active").find(".bottom-nav__label").text()).toBe("Операции");
	});

	it("isActive uses startsWith — /transactions/add activates Операции", async () => {
		const { w } = await mountNav("/transactions/add");
		expect(w.find(".bottom-nav__item--active").find(".bottom-nav__label").text()).toBe("Операции");
	});

	it("no active item when path is unknown", async () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div/>" } }]
		});
		router.push("/unknown");
		await router.isReady();
		const w = mount(BottomNav, {
			global: { plugins: [router], stubs: { teleport: TELEPORT_STUB } }
		});
		expect(w.findAll(".bottom-nav__item--active")).toHaveLength(0);
	});

	it("active item at /accounts", async () => {
		const { w } = await mountNav("/accounts");
		expect(w.find(".bottom-nav__item--active").find(".bottom-nav__label").text()).toBe("Счета");
	});

	it("active item at /charts", async () => {
		const { w } = await mountNav("/charts");
		expect(w.find(".bottom-nav__item--active").find(".bottom-nav__label").text()).toBe("Графики");
	});

	it.each(["/profile", "/categories", "/budgets"])("Ещё is active at %s", async (path) => {
		const { w } = await mountNav(path);
		const active = w.findAll(".bottom-nav__item--active");
		expect(active).toHaveLength(1);
		expect(active[0].find(".bottom-nav__label").text()).toBe("Ещё");
	});
});

describe("BottomNav – navigation", () => {
	it("clicking an item calls router.push", async () => {
		const { w, router } = await mountNav("/dashboard");
		const pushSpy = vi.spyOn(router, "push");
		await w.findAll(".bottom-nav__item")[1].trigger("click");
		expect(pushSpy).toHaveBeenCalledWith("/transactions");
	});

	it("clicking first 4 items navigates to correct path", async () => {
		const paths = ["/dashboard", "/transactions", "/accounts", "/charts"];
		const { w, router } = await mountNav("/dashboard");
		const pushSpy = vi.spyOn(router, "push");
		for (let i = 0; i < paths.length; i++) {
			await w.findAll(".bottom-nav__item")[i].trigger("click");
			expect(pushSpy).toHaveBeenLastCalledWith(paths[i]);
		}
	});
});

describe("BottomNav – more sheet", () => {
	it("sheet is closed initially", async () => {
		const { w } = await mountNav();
		expect(w.find(".more-sheet__item").exists()).toBe(false);
	});

	it("clicking Ещё opens the sheet instead of navigating", async () => {
		const { w, router } = await mountNav("/dashboard");
		const pushSpy = vi.spyOn(router, "push");
		await w.findAll(".bottom-nav__item")[4].trigger("click");
		expect(pushSpy).not.toHaveBeenCalled();
		expect(w.findAll(".more-sheet__item").length).toBeGreaterThan(0);
	});

	it("sheet contains Профиль, Категории, Бюджеты", async () => {
		const { w } = await mountNav();
		await w.findAll(".bottom-nav__item")[4].trigger("click");
		const labels = w.findAll(".more-sheet__item").map((i) => i.text());
		expect(labels).toEqual(["Профиль", "Категории", "Бюджеты"]);
	});

	it.each([
		[0, "/profile"],
		[1, "/categories"],
		[2, "/budgets"]
	])("clicking sheet item %i navigates to %s and closes the sheet", async (index, path) => {
		const { w, router } = await mountNav();
		const pushSpy = vi.spyOn(router, "push");
		await w.findAll(".bottom-nav__item")[4].trigger("click");
		await w.findAll(".more-sheet__item")[index].trigger("click");
		expect(pushSpy).toHaveBeenCalledWith(path);
		expect(w.find(".more-sheet__item").exists()).toBe(false);
	});

	it("sheet closes on modal close event", async () => {
		const { w } = await mountNav();
		await w.findAll(".bottom-nav__item")[4].trigger("click");
		await w.find(".modal__close").trigger("click");
		expect(w.find(".more-sheet__item").exists()).toBe(false);
	});
});

describe("BottomNav – more sheet leave animation", () => {
	// The real <Transition> must run here (transition: false disables the VTU
	// stub): the regression was goMore() dropping AppModal via v-if instantly,
	// so the leave animation never played when picking a section.
	async function mountNavAnimated() {
		const router = makeRouter("/dashboard");
		await router.isReady();
		const w = mount(BottomNav, {
			global: { plugins: [router], stubs: { teleport: TELEPORT_STUB, transition: false } }
		});
		return { w, router };
	}

	// see flushLeave in AppModal.test.ts — jsdom leave finishes after two rAFs
	async function flushLeave() {
		await nextTick();
		await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		await nextTick();
	}

	it("clicking a sheet item keeps the modal mounted while the leave transition runs", async () => {
		const { w, router } = await mountNavAnimated();
		const pushSpy = vi.spyOn(router, "push");
		await w.findAll(".bottom-nav__item")[4].trigger("click");
		await w.findAll(".more-sheet__item")[0].trigger("click");
		expect(pushSpy).toHaveBeenCalledWith("/profile");
		// the leave transition is still running — AppModal must not be unmounted yet
		expect(w.find(".modal-overlay").exists()).toBe(true);
		await flushLeave();
		// after-leave emitted close → moreOpen=false unmounts the modal
		expect(w.find(".modal-overlay").exists()).toBe(false);
	});

	it("sheet can be reopened after navigating from it", async () => {
		const { w } = await mountNavAnimated();
		await w.findAll(".bottom-nav__item")[4].trigger("click");
		await w.findAll(".more-sheet__item")[0].trigger("click");
		await flushLeave();
		await w.findAll(".bottom-nav__item")[4].trigger("click");
		expect(w.findAll(".more-sheet__item")).toHaveLength(3);
	});
});
