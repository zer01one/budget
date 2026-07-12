import { ref } from "vue";
import type { RouteLocationNormalized, Router } from "vue-router";

export type RouteTransitionName = "" | "route-forward" | "route-back";

/**
 * Slide direction is derived from meta.order on each route:
 * higher order = deeper/further right → forward slide, lower = back slide.
 * Routes without order (or equal orders) switch without animation.
 */
export function resolveRouteTransition(to: RouteLocationNormalized, from: RouteLocationNormalized): RouteTransitionName {
	const toOrder = typeof to.meta.order === "number" ? to.meta.order : undefined;
	const fromOrder = typeof from.meta.order === "number" ? from.meta.order : undefined;
	if (toOrder === undefined || fromOrder === undefined || toOrder === fromOrder) return "";
	return toOrder > fromOrder ? "route-forward" : "route-back";
}

export function useRouteTransition(router: Router) {
	const transitionName = ref<RouteTransitionName>("");
	router.afterEach((to, from) => {
		transitionName.value = resolveRouteTransition(to, from);
	});
	return { transitionName };
}
