<script setup lang="ts">
defineProps<{
	modelValue: string;
	label?: string;
}>();
defineEmits<{ "update:modelValue": [value: string] }>();

const PALETTE = [
	"#EF4444",
	"#F97316",
	"#F59E0B",
	"#EAB308",
	"#84CC16",
	"#10B981",
	"#14B8A6",
	"#06B6D4",
	"#3B82F6",
	"#6366F1",
	"#8B5CF6",
	"#A855F7",
	"#EC4899",
	"#F43F5E",
	"#6B7280",
	"#0F172A"
];
</script>

<template>
	<div class="color-picker">
		<label
			v-if="label"
			class="color-picker__label"
			>{{ label }}</label
		>
		<div class="color-picker__grid">
			<button
				v-for="color in PALETTE"
				:key="color"
				:class="['color-swatch', { 'color-swatch--active': modelValue === color }]"
				:style="{ background: color }"
				@click="$emit('update:modelValue', color)" />
		</div>
	</div>
</template>

<style scoped>
.color-picker {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}
.color-picker__label {
	font-size: var(--font-sm);
	color: var(--text-secondary);
	font-weight: 500;
}
.color-picker__grid {
	display: grid;
	grid-template-columns: repeat(8, 1fr);
	gap: var(--space-2);
}
.color-swatch {
	width: 32px;
	height: 32px;
	border-radius: var(--radius-sm);
	border: 2px solid transparent;
	cursor: pointer;
	transition:
		transform var(--transition),
		border-color var(--transition);
}
.color-swatch:hover {
	transform: scale(1.1);
}
.color-swatch--active {
	border-color: var(--text-primary);
	transform: scale(1.15);
	box-shadow: 0 0 0 2px var(--bg-primary);
}
</style>
