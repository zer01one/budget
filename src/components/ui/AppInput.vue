<script setup lang="ts">
defineProps<{
	modelValue: string;
	label?: string;
	placeholder?: string;
	type?: string;
	inputmode?: "text" | "email" | "search" | "tel" | "url" | "none" | "numeric" | "decimal";
	error?: string;
	hint?: string;
	disabled?: boolean;
}>();

defineEmits<{
	"update:modelValue": [value: string];
}>();
</script>

<template>
	<div class="field">
		<label
			v-if="label"
			class="field__label tp-label-md-medium"
			>{{ label }}</label
		>
		<input
			:type="type ?? 'text'"
			:inputmode="inputmode"
			:value="modelValue"
			:placeholder="placeholder"
			:disabled="disabled"
			:class="['field__input tp-body-lg-regular', { 'field__input--error': error }]"
			@input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
		<span
			v-if="error"
			class="field__error tp-caption-md-regular"
			>{{ error }}</span
		>
		<span
			v-else-if="hint"
			class="field__hint tp-caption-md-regular"
			>{{ hint }}</span
		>
	</div>
</template>

<style scoped>
.field {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
}
.field__label {
	color: var(--text-secondary);
}
.field__input {
	height: 44px;
	padding: 0 var(--space-3);
	background: var(--bg-input);
	border: 1px solid var(--border);
	border-radius: var(--radius-md);
	color: var(--text-primary);
	transition: border-color var(--transition);
	width: 100%;
}
.field__input:focus {
	outline: none;
	border-color: var(--border-focus);
}
.field__input--error {
	border-color: var(--accent-danger);
}
.field__error {
	color: var(--accent-danger);
}
.field__hint {
	color: var(--text-muted);
}
</style>
