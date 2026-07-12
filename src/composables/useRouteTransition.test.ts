import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter, type RouteLocationNormalized } from "vue-router";
import { resolveRouteTransition, useCurrentRouteTransition, useRouteTransition } from "./useRouteTransition";

function makeRoute(order?: number): RouteLocationNormalized {
	return { meta: order === undefined ? {} : { order } } as RouteLocationNormalized;
}

describe("resolveRouteTransition", () => {
	it("returns route-forward when navigating to a deeper/later route", () => {
		expect(resolveRouteTransition(makeRoute(2), makeRoute(1))).toBe("route-forward");
	});

	it("returns route-back when navigating to an earlier route", () => {
		expect(resolveRouteTransition(makeRoute(1), makeRoute(2))).toBe("route-back");
	});

	it("works with fractional orders (list → detail)", () => {
		expect(resolveRouteTransition(makeRoute(2.6), makeRoute(2))).toBe("route-forward");
		expect(resolveRouteTransition(makeRoute(2), makeRoute(2.6))).toBe("route-back");
	});

	it("returns empty string when orders are equal", () => {
		expect(resolveRouteTransition(makeRoute(3), makeRoute(3))).toBe("");
	});

	it("returns empty string when either order is missing", () => {
		expect(resolveRouteTransition(makeRoute(), makeRoute(1))).toBe("");
		expect(resolveRouteTransition(makeRoute(1), makeRoute())).toBe("");
		expect(resolveRouteTransition(makeRoute(), makeRoute())).toBe("");
	});
});

describe("useCurrentRouteTransition", () => {
	it("exposes the same name that navigation sets (shared ref for FAB etc.)", async () => {
		const Stub = { template: "<div />" };
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [
				{ path: "/a", component: Stub, meta: { order: 1 } },
				{ path: "/b", component: Stub, meta: { order: 2 } }
			]
		});
		const { transitionName } = useRouteTransition(router);
		await router.push("/a");
		await router.push("/b");
		expect(transitionName.value).toBe("route-forward");
		expect(useCurrentRouteTransition().value).toBe("route-forward");
		await router.push("/a");
		expect(useCurrentRouteTransition().value).toBe("route-back");
	});
});
