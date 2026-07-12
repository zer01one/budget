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

// Shared module-level ref: App.vue drives it, teleported components that
// should slide in sync with the page (FabContainer) read it
const transitionName = ref<RouteTransitionName>("");

export function useRouteTransition(router: Router) {
	router.afterEach((to, from) => {
		transitionName.value = resolveRouteTransition(to, from);
	});
	return { transitionName };
}

export function useCurrentRouteTransition() {
	return transitionName;
}
