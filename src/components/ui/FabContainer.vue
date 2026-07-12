<template>
	<div class="fab-container">
		<slot />
	</div>
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
</style>
