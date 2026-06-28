<script setup lang="ts">
import { ref, computed, nextTick, onUnmounted } from "vue";
import { PhCalendarBlank, PhCaretDown, PhCaretLeft, PhCaretRight, PhX } from "@phosphor-icons/vue";

const props = defineProps<{
	modelValue: string; // YYYY-MM-DD or ""
	disabled?: boolean;
	clearable?: boolean;
	placeholder?: string;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string];
}>();

const MONTH_NAMES = [
	"Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
	"Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const MONTH_SHORT = [
	"янв", "фев", "мар", "апр", "май", "июн",
	"июл", "авг", "сен", "окт", "ноя", "дек",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const NOW_YEAR = new Date().getFullYear();

const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const calendarRef = ref<HTMLElement | null>(null);
const dropdownStyle = ref({ top: "0px", left: "0px" });

const viewYear = ref(NOW_YEAR);
const viewMonth = ref(new Date().getMonth());

const monthPickerOpen = ref(false);
const yearPickerOpen = ref(false);
const yearDropdownRef = ref<HTMLElement | null>(null);

const yearOptions = computed(() => {
	const years: number[] = [];
	for (let y = NOW_YEAR - 30; y <= NOW_YEAR + 10; y++) years.push(y);
	return years;
});

function initView() {
	if (props.modelValue) {
		const [y, m] = props.modelValue.split("-").map(Number);
		viewYear.value = y;
		viewMonth.value = m - 1;
	} else {
		viewYear.value = NOW_YEAR;
		viewMonth.value = new Date().getMonth();
	}
}

const displayValue = computed(() => {
	if (!props.modelValue) return "";
	const [y, m, d] = props.modelValue.split("-").map(Number);
	return `${d} ${MONTH_SHORT[m - 1]} ${y}`;
});

const todayStr = computed(() => new Date().toLocaleDateString("en-CA"));

const firstDayOffset = computed(() => {
	const day = new Date(viewYear.value, viewMonth.value, 1).getDay();
	return (day + 6) % 7; // Mon=0 … Sun=6
});

const daysInMonth = computed(() => new Date(viewYear.value, viewMonth.value + 1, 0).getDate());

const calendarCells = computed(() => {
	const cells: (number | null)[] = Array(firstDayOffset.value).fill(null);
	for (let d = 1; d <= daysInMonth.value; d++) cells.push(d);
	return cells;
});

function dayStr(day: number): string {
	const m = String(viewMonth.value + 1).padStart(2, "0");
	const d = String(day).padStart(2, "0");
	return `${viewYear.value}-${m}-${d}`;
}

function isSelected(day: number) { return props.modelValue === dayStr(day); }
function isToday(day: number) { return todayStr.value === dayStr(day); }

function closeHeaderDropdowns() {
	monthPickerOpen.value = false;
	yearPickerOpen.value = false;
}

function toggleMonthPicker() {
	yearPickerOpen.value = false;
	monthPickerOpen.value = !monthPickerOpen.value;
}

function toggleYearPicker() {
	monthPickerOpen.value = false;
	yearPickerOpen.value = !yearPickerOpen.value;
	if (yearPickerOpen.value) {
		nextTick(() => {
			const el = yearDropdownRef.value?.querySelector(".cal__head-option--active") as HTMLElement | null;
			el?.scrollIntoView({ block: "center" });
		});
	}
}

function selectViewMonth(i: number) {
	viewMonth.value = i;
	monthPickerOpen.value = false;
}

function selectViewYear(y: number) {
	viewYear.value = y;
	yearPickerOpen.value = false;
}

function prevMonth() {
	closeHeaderDropdowns();
	if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value--; }
	else viewMonth.value--;
}
function nextMonth() {
	closeHeaderDropdowns();
	if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++; }
	else viewMonth.value++;
}

function selectDay(day: number) {
	closeHeaderDropdowns();
	emit("update:modelValue", dayStr(day));
	close();
}

function selectToday() {
	closeHeaderDropdowns();
	emit("update:modelValue", todayStr.value);
	initView();
	close();
}

function clear(e: MouseEvent) {
	e.stopPropagation();
	emit("update:modelValue", "");
}

function updatePosition() {
	if (!containerRef.value) return;
	const rect = containerRef.value.getBoundingClientRect();
	const w = 288;
	const left = rect.left + w > window.innerWidth
		? Math.max(4, window.innerWidth - w - 4)
		: rect.left;
	const maxH = 340;
	const showAbove = rect.bottom + maxH + 8 > window.innerHeight && rect.top > maxH + 8;
	dropdownStyle.value = {
		top: showAbove ? `${rect.top - maxH - 4}px` : `${rect.bottom + 4}px`,
		left: `${left}px`,
	};
}

function onScrollOutside(e: Event) {
	if (calendarRef.value?.contains(e.target as Node)) return;
	close();
}

function open() {
	if (props.disabled) return;
	initView();
	updatePosition();
	isOpen.value = true;
	document.addEventListener("mousedown", onClickOutside);
	document.addEventListener("scroll", onScrollOutside, { capture: true, passive: true } as AddEventListenerOptions);
	window.addEventListener("resize", close, { passive: true } as AddEventListenerOptions);
}

function close() {
	if (!isOpen.value) return;
	closeHeaderDropdowns();
	isOpen.value = false;
	document.removeEventListener("mousedown", onClickOutside);
	document.removeEventListener("scroll", onScrollOutside, { capture: true } as EventListenerOptions);
	window.removeEventListener("resize", close);
}

function toggle() { isOpen.value ? close() : open(); }

function onClickOutside(e: MouseEvent) {
	const t = e.target as Node;
	if (containerRef.value?.contains(t) || calendarRef.value?.contains(t)) return;
	close();
}

onUnmounted(() => close());
</script>

<template>
	<div
		ref="containerRef"
		class="app-date"
		:class="{ 'app-date--open': isOpen, 'app-date--disabled': disabled }">
		<!-- Hidden native input keeps tests working -->
		<input
			type="date"
			class="app-date__native field__select"
			:value="modelValue"
			:disabled="disabled"
			tabindex="-1"
			aria-hidden="true"
			@change="emit('update:modelValue', ($event.target as HTMLInputElement).value)" />

		<!-- Visual trigger -->
		<button
			type="button"
			class="app-date__trigger"
			:disabled="disabled"
			@click="toggle">
			<PhCalendarBlank
				class="app-date__icon"
				:size="15" />
			<span
				class="app-date__value"
				:class="{ 'app-date__value--empty': !modelValue }">
				{{ displayValue || placeholder || "Выберите дату" }}
			</span>
			<PhCaretDown
				class="app-date__arrow"
				:size="14"
				weight="bold" />
		</button>

		<!-- Clear button — sibling to trigger (avoids button-in-button) -->
		<button
			v-if="clearable && modelValue"
			type="button"
			class="app-date__clear"
			@click="clear">
			<PhX :size="12" />
		</button>

		<!-- Calendar popup — teleported to escape overflow:hidden in modals -->
		<Teleport to="body">
			<Transition name="app-date-drop">
				<div
					v-if="isOpen"
					ref="calendarRef"
					class="app-date__calendar"
					:style="dropdownStyle"
					@mousedown.stop
					@click="closeHeaderDropdowns">
					<!-- Month navigation -->
					<div class="cal__header">
						<button
							type="button"
							class="cal__nav"
							@mousedown.prevent
							@click="prevMonth">
							<PhCaretLeft
								:size="14"
								weight="bold" />
						</button>

						<div class="cal__head-selects">
							<!-- Month selector -->
							<div class="cal__head-select">
								<button
									type="button"
									class="cal__head-trigger"
									@mousedown.prevent
									@click.stop="toggleMonthPicker">
									{{ MONTH_NAMES[viewMonth] }}
									<PhCaretDown
										:size="11"
										weight="bold"
										:class="{ 'cal__head-caret--open': monthPickerOpen }" />
								</button>
								<div
									v-if="monthPickerOpen"
									class="cal__head-dropdown">
									<button
										v-for="(name, i) in MONTH_NAMES"
										:key="i"
										type="button"
										class="cal__head-option"
										:class="{ 'cal__head-option--active': i === viewMonth }"
										@mousedown.prevent
										@click.stop="selectViewMonth(i)">
										{{ name }}
									</button>
								</div>
							</div>

							<!-- Year selector -->
							<div class="cal__head-select">
								<button
									type="button"
									class="cal__head-trigger"
									@mousedown.prevent
									@click.stop="toggleYearPicker">
									{{ viewYear }}
									<PhCaretDown
										:size="11"
										weight="bold"
										:class="{ 'cal__head-caret--open': yearPickerOpen }" />
								</button>
								<div
									v-if="yearPickerOpen"
									ref="yearDropdownRef"
									class="cal__head-dropdown cal__head-dropdown--year">
									<button
										v-for="y in yearOptions"
										:key="y"
										type="button"
										class="cal__head-option"
										:class="{ 'cal__head-option--active': y === viewYear }"
										@mousedown.prevent
										@click.stop="selectViewYear(y)">
										{{ y }}
									</button>
								</div>
							</div>
						</div>

						<button
							type="button"
							class="cal__nav"
							@mousedown.prevent
							@click="nextMonth">
							<PhCaretRight
								:size="14"
								weight="bold" />
						</button>
					</div>

					<!-- Weekday headers -->
					<div class="cal__weekdays">
						<span
							v-for="d in WEEKDAYS"
							:key="d"
							class="cal__weekday">
							{{ d }}
						</span>
					</div>

					<!-- Day grid -->
					<div class="cal__grid">
						<button
							v-for="(cell, i) in calendarCells"
							:key="i"
							type="button"
							class="cal__day"
							:class="{
								'cal__day--empty': cell === null,
								'cal__day--today': cell !== null && isToday(cell),
								'cal__day--selected': cell !== null && isSelected(cell),
							}"
							:disabled="cell === null"
							@mousedown.prevent
							@click="cell !== null && selectDay(cell)">
							{{ cell ?? "" }}
						</button>
					</div>

					<!-- Today shortcut -->
					<div class="cal__footer">
						<button
							type="button"
							class="cal__today-btn"
							@mousedown.prevent
							@click="selectToday">
							Сегодня
						</button>
					</div>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>

<style scoped>
.app-date {
	position: relative;
	width: 100%;
}

.app-date__native {
	position: absolute;
	inset: 0;
	opacity: 0;
	pointer-events: none;
	width: 100%;
	height: 100%;
	z-index: -1;
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
	font-size: var(--font-sm);
	cursor: pointer;
	text-align: left;
	transition: border-color var(--transition);
	outline: none;
}
.app-date__trigger:hover {
	border-color: var(--text-muted);
}
.app-date__trigger:focus-visible {
	border-color: var(--border-focus);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 20%, transparent);
}
.app-date--open .app-date__trigger {
	border-color: var(--border-focus);
}
.app-date--disabled .app-date__trigger {
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
.app-date__arrow {
	flex-shrink: 0;
	color: var(--text-secondary);
	transition: transform var(--transition);
}
.app-date--open .app-date__arrow {
	transform: rotate(180deg);
}

/* Clear button sits on top of the trigger's right side */
.app-date__clear {
	position: absolute;
	right: var(--space-2);
	top: 50%;
	transform: translateY(-50%);
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
	transition: background var(--transition), color var(--transition);
}
.app-date__clear:hover {
	background: var(--bg-card);
	color: var(--text-primary);
}

/* ── Calendar popup ─────────────────────────────────── */
.app-date__calendar {
	position: fixed;
	z-index: 1100;
	width: 288px;
	background: var(--bg-elevated);
	border: 1px solid var(--border);
	border-radius: var(--radius-lg);
	box-shadow: var(--shadow-lg);
	padding: var(--space-3);
	user-select: none;
}

/* ── Header ── */
.cal__header {
	display: grid;
	grid-template-columns: 28px 1fr 28px;
	align-items: center;
	margin-bottom: var(--space-3);
}
.cal__nav {
	width: 28px;
	height: 28px;
	border-radius: var(--radius-md);
	border: none;
	background: transparent;
	color: var(--text-secondary);
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	transition: background var(--transition), color var(--transition);
}
.cal__nav:hover {
	background: rgba(255, 255, 255, 0.07);
	color: var(--text-primary);
}

.cal__head-selects {
	display: flex;
	align-items: center;
	gap: var(--space-1);
	justify-content: center;
}

.cal__head-select {
	position: relative;
}

.cal__head-trigger {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 4px var(--space-2);
	height: 28px;
	line-height: 1;
	background: transparent;
	border: 1px solid transparent;
	border-radius: var(--radius-md);
	color: var(--text-primary);
	font-size: var(--font-sm);
	font-weight: 600;
	cursor: pointer;
	white-space: nowrap;
	transition: background var(--transition), border-color var(--transition);
}
.cal__head-trigger:hover {
	background: rgba(255, 255, 255, 0.07);
	border-color: var(--border);
}

.cal__head-caret--open {
	transform: rotate(180deg);
}

.cal__head-dropdown {
	position: absolute;
	top: calc(100% + 4px);
	left: 50%;
	transform: translateX(-50%);
	min-width: 130px;
	max-height: 200px;
	overflow-y: auto;
	background: var(--bg-elevated);
	border: 1px solid var(--border);
	border-radius: var(--radius-md);
	box-shadow: var(--shadow-lg);
	z-index: 10;
	padding: var(--space-1);
}
.cal__head-dropdown--year {
	min-width: 80px;
}

.cal__head-option {
	display: block;
	width: 100%;
	padding: 6px var(--space-2);
	background: none;
	border: none;
	border-radius: calc(var(--radius-md) - 2px);
	color: var(--text-primary);
	font-size: var(--font-sm);
	text-align: left;
	cursor: pointer;
	transition: background var(--transition);
	white-space: nowrap;
}
.cal__head-option:hover {
	background: rgba(255, 255, 255, 0.07);
}
.cal__head-option--active {
	background: var(--accent-primary);
	color: #fff;
	font-weight: 600;
}
.cal__head-option--active:hover {
	background: var(--accent-primary);
}

/* ── Weekdays + grid ── */
.cal__weekdays {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	margin-bottom: var(--space-1);
}
.cal__weekday {
	text-align: center;
	font-size: var(--font-xs);
	color: var(--text-muted);
	font-weight: 500;
	padding: var(--space-1) 0;
}

.cal__grid {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: 2px;
}
.cal__day {
	aspect-ratio: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: var(--radius-full);
	border: none;
	background: transparent;
	color: var(--text-primary);
	font-size: var(--font-sm);
	cursor: pointer;
	padding: 0;
	transition: background var(--transition), color var(--transition);
	line-height: 1;
}
.cal__day--empty {
	visibility: hidden;
	pointer-events: none;
}
.cal__day:hover:not(:disabled):not(.cal__day--selected) {
	background: rgba(255, 255, 255, 0.07);
}
.cal__day--today:not(.cal__day--selected) {
	border: 2px solid var(--accent-primary);
	color: var(--accent-primary);
	font-weight: 600;
}
.cal__day--selected {
	background: var(--accent-primary);
	color: #fff;
	font-weight: 700;
}

.cal__footer {
	display: flex;
	justify-content: center;
	border-top: 1px solid var(--border);
	padding-top: var(--space-2);
	margin-top: var(--space-2);
}
.cal__today-btn {
	background: none;
	border: none;
	color: var(--accent-primary);
	font-size: var(--font-sm);
	cursor: pointer;
	padding: var(--space-1) var(--space-3);
	border-radius: var(--radius-md);
	transition: background var(--transition);
}
.cal__today-btn:hover {
	background: rgba(255, 255, 255, 0.07);
}

/* Animation */
.app-date-drop-enter-active,
.app-date-drop-leave-active {
	transition: opacity 0.15s, transform 0.15s;
}
.app-date-drop-enter-from,
.app-date-drop-leave-to {
	opacity: 0;
	transform: translateY(-6px) scale(0.98);
}
</style>
