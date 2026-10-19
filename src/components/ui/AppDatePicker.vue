<script setup lang="ts">
import { computed } from "vue";
import { VueDatePicker } from "@vuepic/vue-datepicker";
import { ru as dateFnsRu } from "date-fns/locale/ru";
import { PhCalendarBlank, PhCaretDown, PhX } from "@phosphor-icons/vue";

const props = defineProps<{
	// single mode
	modelValue?: string; // YYYY-MM-DD or ""
	clearable?: boolean;
	placeholder?: string;
	// range mode
	range?: boolean;
	dateFrom?: string; // YYYY-MM-DD
	dateTo?: string; // YYYY-MM-DD
	// common
	disabled?: boolean;
	minDate?: string; // YYYY-MM-DD — disables days before this
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string];
	"update:dateFrom": [value: string];
	"update:dateTo": [value: string];
}>();

// ── Constants ────────────────────────────────────────────────────────────────

const MONTH_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTH_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

const minDate = computed(() => (props.minDate ? new Date(props.minDate + "T12:00:00") : undefined));
const maxDate = new Date();
const today = new Date().toLocaleDateString("en-CA");
const ydDate = new Date();
ydDate.setDate(ydDate.getDate() - 1);
const yesterday = ydDate.toLocaleDateString("en-CA");

// ── v-model bridge ───────────────────────────────────────────────────────────

const pickerValue = computed({
	get() {
		if (props.range) {
			if (!props.dateFrom || !props.dateTo) return null;
			return [new Date(props.dateFrom + "T12:00:00"), new Date(props.dateTo + "T12:00:00")] as [Date, Date];
		}
		return props.modelValue ? new Date(props.modelValue + "T12:00:00") : null;
	},
	set(val: unknown) {
		if (props.range) {
			const arr = val as Date[] | null;
			if (!arr?.[0] || !arr?.[1]) return;
			emit("update:dateFrom", arr[0].toLocaleDateString("en-CA"));
			emit("update:dateTo", arr[1].toLocaleDateString("en-CA"));
		} else {
			emit("update:modelValue", (val as Date | null)?.toLocaleDateString("en-CA") ?? "");
		}
	}
});

// ── Display text ─────────────────────────────────────────────────────────────

const displayValue = computed(() => {
	if (!props.modelValue) return "";
	const [y, m, d] = props.modelValue.split("-").map(Number);
	return `${d} ${MONTH_SHORT[m - 1]} ${y}`;
});

function buildLabel(from: string, to: string): string {
	if (from === to) {
		if (from === today) return "Сегодня";
		if (from === yesterday) return "Вчера";
	}
	const [fy, fm, fd] = from.split("-").map(Number);
	const [ty, tm, td] = to.split("-").map(Number);
	const curYear = new Date().getFullYear();
	if (fy === ty && fm === tm) {
		const ys = fy !== curYear ? ` ${fy}` : "";
		if (fd === td) return `${fd} ${MONTH_GENITIVE[fm - 1]}${ys}`;
		return `${fd}–${td} ${MONTH_GENITIVE[fm - 1]}${ys}`;
	}
	const fy2 = fy !== curYear ? ` ${fy}` : "";
	const ty2 = ty !== curYear ? ` ${ty}` : "";
	return `${fd} ${MONTH_GENITIVE[fm - 1]}${fy2} – ${td} ${MONTH_GENITIVE[tm - 1]}${ty2}`;
}

const periodLabel = computed(() => (props.dateFrom && props.dateTo ? buildLabel(props.dateFrom, props.dateTo) : "Выберите период"));

const triggerLabel = computed(() => (props.range ? periodLabel.value : displayValue.value || props.placeholder || "Выберите дату"));

const hasValue = computed(() => (props.range ? !!(props.dateFrom && props.dateTo) : !!props.modelValue));

// ── Clear (single mode only) ─────────────────────────────────────────────────

function clear(e: MouseEvent) {
	e.stopPropagation();
	emit("update:modelValue", "");
}
</script>

<template>
	<VueDatePicker
		v-model="pickerValue"
		:range="range ? { partialRange: false } : undefined"
		:auto-apply="true"
		:dark="true"
		:locale="dateFnsRu"
		:week-start="1"
		:min-date="minDate"
		:max-date="maxDate"
		:disabled="disabled"
		:teleport="true"
		:ui="{ menu: 'dp-budget-menu' }"
		class="app-date-picker">
		<template #trigger>
			<div
				class="app-date__trigger tp-body-md-regular"
				:class="{ 'app-date__trigger--disabled': disabled }">
				<PhCalendarBlank
					class="app-date__icon"
					:size="15" />
				<span
					class="app-date__value"
					:class="{ 'app-date__value--empty': !hasValue }">
					{{ triggerLabel }}
				</span>
				<button
					v-if="!range && clearable && modelValue"
					type="button"
					class="app-date__clear"
					@click="clear">
					<PhX :size="12" />
				</button>
				<PhCaretDown
					v-else
					class="app-date__caret"
					:size="14"
					weight="bold" />
			</div>
		</template>
	</VueDatePicker>
</template>

<style scoped>
.app-date-picker {
	width: 100%;
}

.app-date__trigger {
	width: 100%;
	height: 40px;
	display: flex;
	align-items: center;
	gap: var(--space-2);
	padding: 0 var(--space-3);
	background: var(--bg-input);
	border: 1px solid var(--border);
	border-radius: var(--radius-md);
	color: var(--text-primary);
	cursor: pointer;
	user-select: none;
	transition: border-color var(--transition);
	box-sizing: border-box;
}
.app-date__trigger:hover:not(.app-date__trigger--disabled) {
	border-color: var(--text-muted);
}
.app-date__trigger--disabled {
	opacity: 0.45;
	cursor: not-allowed;
}

.app-date__icon {
	flex-shrink: 0;
	color: var(--text-secondary);
}
.app-date__value {
	flex: 1;
	text-align: left;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
.app-date__value--empty {
	color: var(--text-muted);
}
.app-date__caret {
	flex-shrink: 0;
	color: var(--text-secondary);
}

.app-date__clear {
	flex-shrink: 0;
	width: 22px;
	height: 22px;
	border-radius: var(--radius-full);
	border: none;
	background: var(--bg-elevated);
	color: var(--text-muted);
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	padding: 0;
	transition:
		background var(--transition),
		color var(--transition);
}
.app-date__clear:hover {
	background: var(--bg-card);
	color: var(--text-primary);
}
</style>
