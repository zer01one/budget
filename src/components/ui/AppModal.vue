<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

const props = withDefaults(
	defineProps<{
		title?: string;
		size?: "sm" | "md" | "lg";
		/** false blocks all close paths (button, overlay, Escape), e.g. while saving */
		closable?: boolean;
	}>(),
	{ closable: true }
);

const emit = defineEmits<{ close: [] }>();

// The parent controls mounting via v-if, so the leave animation has to run
// before we tell it to unmount us: close() hides the overlay, and `close`
// is emitted from @after-leave once the transition finishes.
const visible = ref(true);

function close() {
	if (!props.closable) return;
	visible.value = false;
}

// For parents that need to close programmatically (e.g. after picking an
// item): dropping the v-if directly skips the leave animation — call this.
defineExpose({ close });

function onKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") close();
}
onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
	<Teleport to="body">
		<Transition
			name="modal"
			appear
			@after-leave="emit('close')">
			<div
				v-if="visible"
				class="modal-overlay"
				@click.self="close">
				<div
					:class="['modal', `modal--${props.size ?? 'md'}`]"
					role="dialog">
					<div
						v-if="title"
						class="modal__header">
						<span class="modal__title tp-title-lg-semibold">{{ title }}</span>
						<button
							class="modal__close tp-body-md-regular"
							@click="close">
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
		</Transition>
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
	overflow: hidden;
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

/* Enter/leave: the dimming animates via the overlay's background-color (not
   opacity — the sheet must stay fully opaque while it slides on mobile).
   Desktop gets a scale+fade on the sheet instead. Root and child durations
   must match — Vue ends the transition on the overlay's transitionend. */
.modal-enter-active,
.modal-leave-active {
	transition:
		background-color 280ms ease,
		backdrop-filter 280ms ease;
}
.modal-enter-active .modal {
	transition: transform 280ms cubic-bezier(0.33, 1, 0.68, 1);
}
.modal-leave-active .modal {
	transition: transform 280ms cubic-bezier(0.55, 0, 0.55, 0.2);
}
.modal-enter-from,
.modal-leave-to {
	background: rgba(0, 0, 0, 0);
	backdrop-filter: blur(0);
}
.modal-enter-from .modal,
.modal-leave-to .modal {
	transform: translateY(100%);
}
@media (min-width: 600px) {
	.modal-enter-active .modal,
	.modal-leave-active .modal {
		transition:
			transform 280ms cubic-bezier(0.33, 1, 0.68, 1),
			opacity 280ms ease;
	}
	.modal-enter-from .modal,
	.modal-leave-to .modal {
		transform: translateY(24px) scale(0.96);
		opacity: 0;
	}
}
@media (prefers-reduced-motion: reduce) {
	.modal-enter-active,
	.modal-leave-active,
	.modal-enter-active .modal,
	.modal-leave-active .modal {
		transition: none;
	}
}

.modal__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-5) var(--space-5) var(--space-4);
	border-bottom: 1px solid var(--border);
	flex-shrink: 0;
}
.modal__close {
	width: 32px;
	height: 32px;
	border-radius: var(--radius-full);
	background: var(--bg-elevated);
	color: var(--text-secondary);
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
	min-height: 0;
	overflow-y: auto;
}
.modal__footer {
	padding: var(--space-4) var(--space-5);
	border-top: 1px solid var(--border);
	display: flex;
	flex-direction: column-reverse;
	gap: var(--space-3);
	flex-shrink: 0;
}
@media (min-width: 600px) {
	.modal__footer {
		flex-direction: row;
		justify-content: flex-end;
	}
}
</style>
