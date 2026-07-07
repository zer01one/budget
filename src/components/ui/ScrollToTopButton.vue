<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { PhArrowUp } from "@phosphor-icons/vue";

const props = defineProps<{
	scrollEl?: HTMLElement | null;
}>();

const visible = ref(false);
let attachedEl: HTMLElement | null = null;

function onScroll() {
	visible.value = !!attachedEl && attachedEl.scrollTop > 150;
}

function scrollToTop() {
	attachedEl?.scrollTo({ top: 0, behavior: "smooth" });
}

function attach(el: HTMLElement) {
	if (attachedEl) attachedEl.removeEventListener("scroll", onScroll);
	attachedEl = el;
	el.addEventListener("scroll", onScroll, { passive: true });
}

onMounted(() => {
	const el = props.scrollEl ?? document.querySelector<HTMLElement>(".shell__content");
	if (el) attach(el);
});

watch(
	() => props.scrollEl,
	(el) => {
		if (el) attach(el);
	}
);

onUnmounted(() => {
	if (attachedEl) attachedEl.removeEventListener("scroll", onScroll);
});
</script>

<template>
	<Transition name="scroll-top">
		<button
			v-if="visible"
			class="scroll-top-btn"
			aria-label="Наверх"
			@click="scrollToTop">
			<PhArrowUp
				:size="20"
				weight="bold" />
		</button>
	</Transition>
</template>

<style scoped>
.scroll-top-btn {
	position: fixed;
	right: var(--space-5);
	bottom: calc(var(--nav-height) + var(--space-4) + 32px + var(--space-3) + env(safe-area-inset-bottom, 0px));
	width: 44px;
	height: 44px;
	border-radius: 50%;
	border: none;
	background: var(--accent-primary);
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
	z-index: 50;
	transition: background var(--transition), transform 0.1s;
}
.scroll-top-btn:hover {
	background: var(--accent-primary-hover, var(--accent-primary));
	transform: scale(1.08);
}
.scroll-top-btn:active {
	transform: scale(0.95);
}

@media (min-width: 900px) {
	.scroll-top-btn {
		bottom: var(--space-5);
	}
}

.scroll-top-enter-active,
.scroll-top-leave-active {
	transition: opacity 0.2s, transform 0.2s;
}
.scroll-top-enter-from,
.scroll-top-leave-to {
	opacity: 0;
	transform: scale(0.7);
}
</style>
