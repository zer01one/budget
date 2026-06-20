<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

const props = defineProps<{
	title?: string;
	size?: "sm" | "md" | "lg";
}>();

const emit = defineEmits<{ close: [] }>();

function onKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") emit("close");
}
onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
	<Teleport to="body">
		<div
			class="modal-overlay"
			@click.self="emit('close')">
			<div
				:class="['modal', `modal--${props.size ?? 'md'}`]"
				role="dialog">
				<div
					v-if="title"
					class="modal__header">
					<span class="modal__title">{{ title }}</span>
					<button
						class="modal__close"
						@click="emit('close')">
						✕
					</button>
				</div>
				<div class="modal__body">
					<slot />
				</div>
				<div
					v-if="$slots.footer"
					class="modal__footer">
					<slot name="footer" />
				</div>
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
.modal-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.6);
	display: flex;
	align-items: flex-end;
	justify-content: center;
	z-index: 1000;
	backdrop-filter: blur(4px);
}
@media (min-width: 600px) {
	.modal-overlay {
		align-items: center;
	}
}

.modal {
	background: var(--bg-secondary);
	border-radius: var(--radius-xl) var(--radius-xl) 0 0;
	width: 100%;
	max-height: 92dvh;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
}
@media (min-width: 600px) {
	.modal {
		border-radius: var(--radius-xl);
		max-width: 480px;
		max-height: 90dvh;
	}
	.modal--lg {
		max-width: 640px;
	}
	.modal--sm {
		max-width: 360px;
	}
}

.modal__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-5) var(--space-5) var(--space-4);
	border-bottom: 1px solid var(--border);
}
.modal__title {
	font-size: var(--font-lg);
	font-weight: 600;
}
.modal__close {
	width: 32px;
	height: 32px;
	border-radius: var(--radius-full);
	background: var(--bg-elevated);
	color: var(--text-secondary);
	font-size: 14px;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	border: none;
}
.modal__close:hover {
	color: var(--text-primary);
}
.modal__body {
	padding: var(--space-5);
	flex: 1;
}
.modal__footer {
	padding: var(--space-4) var(--space-5);
	border-top: 1px solid var(--border);
	display: flex;
	gap: var(--space-3);
}
</style>
