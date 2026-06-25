<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import { useConfirmDialog } from "@/composables/useConfirmDialog";

const { pending, confirm, cancel } = useConfirmDialog();

function onKeydown(e: KeyboardEvent) {
	if (!pending.value) return;
	if (e.key === "Escape") cancel();
	if (e.key === "Enter") confirm();
}
onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
	<Teleport to="body">
		<Transition name="confirm">
			<div
				v-if="pending"
				class="confirm-overlay"
				@click.self="cancel">
				<div
					class="confirm-dialog"
					role="alertdialog"
					aria-modal="true">
					<div class="confirm-icon">
						<svg
							width="28"
							height="28"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round">
							<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
							<line
								x1="12"
								y1="9"
								x2="12"
								y2="13" />
							<line
								x1="12"
								y1="17"
								x2="12.01"
								y2="17" />
						</svg>
					</div>
					<p class="confirm-message">{{ pending.message }}</p>
					<div class="confirm-actions">
						<AppButton
							variant="secondary"
							fullWidth
							@click="cancel">
							{{ pending.cancelLabel ?? "Отмена" }}
						</AppButton>
						<AppButton
							:variant="pending.danger !== false ? 'danger' : 'primary'"
							fullWidth
							@click="confirm">
							{{ pending.confirmLabel ?? "Подтвердить" }}
						</AppButton>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<style scoped>
.confirm-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.55);
	backdrop-filter: blur(4px);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1100;
	padding: var(--space-5);
}

.confirm-dialog {
	background: var(--bg-secondary);
	border-radius: var(--radius-xl);
	width: 100%;
	max-width: 320px;
	padding: var(--space-6) var(--space-5) var(--space-5);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--space-4);
	text-align: center;
}

.confirm-icon {
	width: 56px;
	height: 56px;
	border-radius: var(--radius-full);
	background: color-mix(in srgb, var(--accent-danger) 15%, transparent);
	color: var(--accent-danger);
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.confirm-message {
	font-size: var(--font-md);
	color: var(--text-primary);
	line-height: 1.5;
	margin: 0;
}

.confirm-actions {
	display: flex;
	gap: var(--space-3);
	width: 100%;
}

/* transition */
.confirm-enter-active,
.confirm-leave-active {
	transition: opacity 0.18s ease;
}
.confirm-enter-active .confirm-dialog,
.confirm-leave-active .confirm-dialog {
	transition: transform 0.18s ease, opacity 0.18s ease;
}
.confirm-enter-from,
.confirm-leave-to {
	opacity: 0;
}
.confirm-enter-from .confirm-dialog,
.confirm-leave-to .confirm-dialog {
	transform: scale(0.92);
	opacity: 0;
}
</style>
