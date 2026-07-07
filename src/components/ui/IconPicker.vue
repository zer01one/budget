<script setup lang="ts">
import AppIcon from "@/components/ui/AppIcon.vue";

defineProps<{
	modelValue: string;
	label?: string;
	icons?: string[];
}>();
defineEmits<{ "update:modelValue": [value: string] }>();

const CATEGORY_ICONS = [
	"food",
	"coffee",
	"shopping",
	"bag",
	"transport",
	"bus",
	"train",
	"bicycle",
	"travel",
	"fuel",
	"home",
	"electricity",
	"water",
	"wifi",
	"health",
	"medicine",
	"insurance",
	"clothes",
	"beauty",
	"entertainment",
	"tv",
	"music",
	"game",
	"phone",
	"education",
	"book",
	"sport",
	"subscription",
	"salary",
	"freelance",
	"investment",
	"gift",
	"pet",
	"baby",
	"tools",
	"fire",
	"nature",
	"heart",
	"sun",
	"tag",
	"other"
];
</script>

<template>
	<div class="icon-picker">
		<label
			v-if="label"
			class="icon-picker__label tp-label-md-medium"
			>{{ label }}</label
		>
		<div class="icon-picker__grid">
			<button
				v-for="icon in icons ?? CATEGORY_ICONS"
				:key="icon"
				:class="['icon-item', { 'icon-item--active': modelValue === icon }]"
				@click="$emit('update:modelValue', icon)"
				:title="icon">
				<AppIcon
					:name="icon"
					:size="22" />
			</button>
		</div>
	</div>
</template>

<style scoped>
.icon-picker {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}
.icon-picker__label {
	color: var(--text-secondary);
}
.icon-picker__grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
	gap: var(--space-2);
}
.icon-item {
	width: 44px;
	height: 44px;
	border-radius: var(--radius-md);
	background: var(--bg-elevated);
	border: 2px solid transparent;
	color: var(--text-primary);
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition:
		border-color var(--transition),
		background var(--transition);
}
.icon-item:hover {
	background: var(--border);
}
.icon-item--active {
	border-color: var(--accent-primary);
	background: var(--accent-primary-soft);
}
</style>
