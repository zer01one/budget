<script setup lang="ts">
import { useCurrentRouteTransition } from "@/composables/useRouteTransition";

// FAB едет вместе со страницей: направление берём из текущего route-перехода
const routeTransition = useCurrentRouteTransition();
</script>

<template>
	<!-- В body, чтобы transform на корне страницы во время route-анимации
	     не перехватывал position:fixed (иначе FAB прыгает по вертикали).
	     Синхронность со страницей достигается собственным Transition ниже. -->
	<Teleport to="body">
		<Transition
			appear
			:name="routeTransition ? `fab-${routeTransition}` : 'fab-none'">
			<div class="fab-container">
				<slot />
			</div>
		</Transition>
	</Teleport>
</template>

<style scoped>
/* Единый плавающий блок для FAB-кнопок: сам держит позицию над нижней
 * навигацией, дети раскладываются обычной flex-колонкой через gap. */
.fab-container {
	position: fixed;
	left: var(--space-4);
	right: var(--space-4);
	bottom: calc(var(--nav-height) + var(--space-4) + env(safe-area-inset-bottom, 0px));
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: var(--space-3);
	z-index: 50;
	/* Блок растянут на всю ширину — клики должны проходить сквозь пустые места */
	pointer-events: none;
}
.fab-container :slotted(*) {
	pointer-events: auto;
}

@media (min-width: 900px) {
	.fab-container {
		left: auto;
		right: var(--space-5);
		bottom: var(--space-5);
		align-items: flex-end;
	}
}

/* Въезд вместе со страницей: длительность и изинг совпадают с
 * route-forward/route-back в App.vue (250ms, cubic-bezier(0.33, 1, 0.68, 1)) */
.fab-route-forward-enter-active,
.fab-route-back-enter-active {
	transition: transform 250ms cubic-bezier(0.33, 1, 0.68, 1);
}
.fab-route-forward-enter-from {
	transform: translateX(100vw);
}
.fab-route-back-enter-from {
	transform: translateX(-100vw);
}

@media (prefers-reduced-motion: reduce) {
	.fab-route-forward-enter-active,
	.fab-route-back-enter-active {
		transition: none;
	}
}
</style>
