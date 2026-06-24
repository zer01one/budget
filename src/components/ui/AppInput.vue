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
			class="field__label"
			>{{ label }}</label
		>
		<input
			:type="type ?? 'text'"
			:inputmode="inputmode"
			:value="modelValue"
			:placeholder="placeholder"
			:disabled="disabled"
			:class="['field__input', { 'field__input--error': error }]"
			@input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
		<span
			v-if="error"
			class="field__error"
			>{{ error }}</span
		>
		<span
			v-else-if="hint"
			class="field__hint"
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
	font-size: var(--font-sm);
	color: var(--text-secondary);
	font-weight: 500;
}
.field__input {
	height: 44px;
	padding: 0 var(--space-3);
	background: var(--bg-input);
	border: 1px solid var(--border);
	border-radius: var(--radius-md);
	color: var(--text-primary);
	font-size: var(--font-md);
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
	font-size: var(--font-xs);
	color: var(--accent-danger);
}
.field__hint {
	font-size: var(--font-xs);
	color: var(--text-muted);
}
</style>
