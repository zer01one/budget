<script setup lang="ts">
import { ref, onMounted } from "vue";

const props = defineProps<{
	message: string;
	type?: "success" | "error" | "warning" | "info";
	duration?: number;
}>();

const emit = defineEmits<{ dismiss: [] }>();

const visible = ref(false);

onMounted(() => {
	visible.value = true;
	setTimeout(() => {
		visible.value = false;
		setTimeout(() => emit("dismiss"), 300);
	}, props.duration ?? 4000);
});
</script>

<template>
	<div :class="['toast tp-label-md-medium', `toast--${type ?? 'info'}`, { 'toast--visible': visible }]">
		{{ message }}
	</div>
</template>

<style scoped>
.toast {
	padding: var(--space-3) var(--space-5);
	border-radius: var(--radius-md);
	box-shadow: var(--shadow-lg);
	opacity: 0;
	transform: translateY(8px);
	transition:
		opacity var(--transition-slow),
		transform var(--transition-slow);
	max-width: 360px;
	pointer-events: none;
}
.toast--visible {
	opacity: 1;
	transform: translateY(0);
	pointer-events: auto;
}
.toast--success {
	background: var(--accent-success);
	color: #fff;
}
.toast--error {
	background: var(--accent-danger);
	color: #fff;
}
.toast--warning {
	background: var(--accent-warning);
	color: #fff;
}
.toast--info {
	background: var(--bg-elevated);
	color: var(--text-primary);
	border: 1px solid var(--border);
}
</style>
