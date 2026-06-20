<script lang="ts">
// Exported for use in parent views
export const ICON_EMOJI: Record<string, string> = {
	wallet: "👛",
	bank: "🏦",
	card: "💳",
	cash: "💵",
	piggy: "🐷",
	crypto: "₿",
	savings: "🏧",
	invest: "📈",
	dollar: "💲",
	euro: "€",
	star: "⭐",
	home: "🏠",
	food: "🍽",
	transport: "🚌",
	health: "💊",
	clothes: "👗",
	entertainment: "🎬",
	phone: "📱",
	education: "📚",
	shopping: "🛍",
	sport: "⚽",
	subscription: "📺",
	salary: "💼",
	freelance: "💻",
	investment: "📊",
	gift: "🎁",
	travel: "✈",
	fuel: "⛽",
	pet: "🐾",
	other: "⬡"
};

export function iconToEmoji(icon: string): string {
	return ICON_EMOJI[icon] ?? "⬡";
}
</script>

<script setup lang="ts">
defineProps<{
	modelValue: string;
	label?: string;
	icons?: string[];
}>();
defineEmits<{ "update:modelValue": [value: string] }>();

const CATEGORY_ICONS = [
	"food",
	"transport",
	"home",
	"health",
	"clothes",
	"entertainment",
	"phone",
	"education",
	"shopping",
	"sport",
	"subscription",
	"salary",
	"freelance",
	"investment",
	"gift",
	"travel",
	"fuel",
	"pet",
	"other"
];
</script>

<template>
	<div class="icon-picker">
		<label
			v-if="label"
			class="icon-picker__label"
			>{{ label }}</label
		>
		<div class="icon-picker__grid">
			<button
				v-for="icon in icons ?? CATEGORY_ICONS"
				:key="icon"
				:class="['icon-item', { 'icon-item--active': modelValue === icon }]"
				@click="$emit('update:modelValue', icon)"
				:title="icon">
				{{ ICON_EMOJI[icon] ?? "⬡" }}
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
	font-size: var(--font-sm);
	color: var(--text-secondary);
	font-weight: 500;
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
	font-size: 20px;
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
