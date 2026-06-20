<script setup lang="ts">
defineProps<{
	variant?: "primary" | "secondary" | "ghost" | "danger";
	size?: "sm" | "md" | "lg";
	loading?: boolean;
	disabled?: boolean;
	fullWidth?: boolean;
}>();
</script>

<template>
	<button
		:class="[
			'app-btn',
			`app-btn--${variant ?? 'primary'}`,
			`app-btn--${size ?? 'md'}`,
			{ 'app-btn--full': fullWidth, 'app-btn--loading': loading }
		]"
		:disabled="disabled || loading">
		<span
			v-if="loading"
			class="app-btn__spinner" />
		<slot />
	</button>
</template>

<style scoped>
.app-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-2);
	border-radius: var(--radius-md);
	font-weight: 500;
	transition:
		background var(--transition),
		opacity var(--transition);
	white-space: nowrap;
	cursor: pointer;
	border: none;
}
.app-btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}
.app-btn--full {
	width: 100%;
}

.app-btn--sm {
	height: 32px;
	padding: 0 var(--space-3);
	font-size: var(--font-sm);
}
.app-btn--md {
	height: 44px;
	padding: 0 var(--space-5);
	font-size: var(--font-md);
}
.app-btn--lg {
	height: 52px;
	padding: 0 var(--space-6);
	font-size: var(--font-lg);
}

.app-btn--primary {
	background: var(--accent-primary);
	color: #fff;
}
.app-btn--primary:hover:not(:disabled) {
	background: var(--accent-primary-hover);
}

.app-btn--secondary {
	background: var(--bg-elevated);
	color: var(--text-primary);
	border: 1px solid var(--border);
}
.app-btn--secondary:hover:not(:disabled) {
	background: var(--border);
}

.app-btn--ghost {
	background: transparent;
	color: var(--text-secondary);
}
.app-btn--ghost:hover:not(:disabled) {
	background: var(--bg-elevated);
	color: var(--text-primary);
}

.app-btn--danger {
	background: var(--accent-danger);
	color: #fff;
}
.app-btn--danger:hover:not(:disabled) {
	opacity: 0.85;
}

.app-btn__spinner {
	width: 16px;
	height: 16px;
	border: 2px solid rgba(255, 255, 255, 0.3);
	border-top-color: #fff;
	border-radius: 50%;
	animation: spin 0.6s linear infinite;
}
@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
