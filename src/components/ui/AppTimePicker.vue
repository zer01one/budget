<script setup lang="ts">
import { ref, computed, nextTick, onUnmounted } from "vue";
import { PhClock, PhCaretDown } from "@phosphor-icons/vue";

const props = defineProps<{
	modelValue: string; // HH:MM
	disabled?: boolean;
	placeholder?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

// ── Layout constants ──────────────────────────────────────
const ITEM_H = 36;
const PAD = 2;

// ── Infinite scroll: 5 copies, canonical = middle (copy 2) ─
const HOUR_COPIES = 5;
const MIN_COPIES = 5;
const HOUR_CYCLE = 24 * ITEM_H; // 864px
const MIN_CYCLE = 60 * ITEM_H;  // 2160px
const CANONICAL_H = 2;
const CANONICAL_M = 2;

const SETTLE_DELAY = 200;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

// ── State ─────────────────────────────────────────────────
const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const popupRef = ref<HTMLElement | null>(null);
const hourColRef = ref<HTMLElement | null>(null);
const minColRef = ref<HTMLElement | null>(null);
const dropdownStyle = ref({ top: "0px", left: "0px" });

const tempHour = ref(0);
const tempMinute = ref(0);

let hourTimer: ReturnType<typeof setTimeout> | null = null;
let minTimer: ReturnType<typeof setTimeout> | null = null;
// Prevent the programmatic scrollTo (snap/click) from re-triggering the scroll handler
let hourSnapping = false;
let minSnapping = false;

function pad2(n: number) { return String(n).padStart(2, "0"); }

function parseModel() {
	if (props.modelValue && /^\d{1,2}:\d{2}/.test(props.modelValue)) {
		const [h, m] = props.modelValue.split(":").map(Number);
		tempHour.value = Math.min(23, Math.max(0, h));
		tempMinute.value = Math.min(59, Math.max(0, m));
	} else {
		const now = new Date();
		tempHour.value = now.getHours();
		tempMinute.value = now.getMinutes();
	}
}

const displayValue = computed(() => props.modelValue?.slice(0, 5) ?? "");

function emitTime() {
	emit("update:modelValue", `${pad2(tempHour.value)}:${pad2(tempMinute.value)}`);
}

// Canonical scroll positions (middle copy)
function hPos(h: number) { return CANONICAL_H * HOUR_CYCLE + h * ITEM_H; }
function mPos(m: number) { return CANONICAL_M * MIN_CYCLE + m * ITEM_H; }

// ── Scroll handlers — debounce + JS snap (replaces CSS scroll-snap) ──
function onHourScroll(e: Event) {
	if (hourSnapping) return;
	const el = e.target as HTMLElement;
	if (hourTimer) clearTimeout(hourTimer);
	hourTimer = setTimeout(() => {
		const h = ((Math.round(el.scrollTop / ITEM_H) % 24) + 24) % 24;
		tempHour.value = h;
		emitTime();
		const target = hPos(h);
		if (el.scrollTop !== target) {
			hourSnapping = true;
			el.scrollTo({ top: target, behavior: "instant" });
			hourSnapping = false;
		}
	}, SETTLE_DELAY);
}

function onMinScroll(e: Event) {
	if (minSnapping) return;
	const el = e.target as HTMLElement;
	if (minTimer) clearTimeout(minTimer);
	minTimer = setTimeout(() => {
		const m = ((Math.round(el.scrollTop / ITEM_H) % 60) + 60) % 60;
		tempMinute.value = m;
		emitTime();
		const target = mPos(m);
		if (el.scrollTop !== target) {
			minSnapping = true;
			el.scrollTo({ top: target, behavior: "instant" });
			minSnapping = false;
		}
	}, SETTLE_DELAY);
}

// ── Event delegation for item clicks ──
function onHourColClick(e: MouseEvent) {
	const item = (e.target as HTMLElement).closest<HTMLElement>(".tp__item:not(.tp__item--pad)");
	if (!item?.dataset.value || !hourColRef.value) return;
	const h = Number(item.dataset.value);
	tempHour.value = h;
	emitTime();
	hourSnapping = true;
	hourColRef.value.scrollTo({ top: hPos(h), behavior: "smooth" });
	setTimeout(() => { hourSnapping = false; }, 400);
}

function onMinColClick(e: MouseEvent) {
	const item = (e.target as HTMLElement).closest<HTMLElement>(".tp__item:not(.tp__item--pad)");
	if (!item?.dataset.value || !minColRef.value) return;
	const m = Number(item.dataset.value);
	tempMinute.value = m;
	emitTime();
	minSnapping = true;
	minColRef.value.scrollTo({ top: mPos(m), behavior: "smooth" });
	setTimeout(() => { minSnapping = false; }, 400);
}

function selectNow() {
	const now = new Date();
	tempHour.value = now.getHours();
	tempMinute.value = now.getMinutes();
	hourColRef.value?.scrollTo({ top: hPos(tempHour.value), behavior: "smooth" });
	minColRef.value?.scrollTo({ top: mPos(tempMinute.value), behavior: "smooth" });
	emitTime();
}

function updatePosition() {
	if (!containerRef.value) return;
	const rect = containerRef.value.getBoundingClientRect();
	const w = 200;
	const left = rect.left + w > window.innerWidth
		? Math.max(4, window.innerWidth - w - 4)
		: rect.left;
	const popH = 225;
	const showAbove = rect.bottom + popH + 8 > window.innerHeight && rect.top > popH + 8;
	dropdownStyle.value = {
		top: showAbove ? `${rect.top - popH - 4}px` : `${rect.bottom + 4}px`,
		left: `${left}px`,
	};
}

function onScrollOutside(e: Event) {
	if (popupRef.value?.contains(e.target as Node)) return;
	close();
}

function onClickOutside(e: MouseEvent) {
	const t = e.target as Node;
	if (containerRef.value?.contains(t) || popupRef.value?.contains(t)) return;
	close();
}

function open() {
	if (props.disabled) return;
	parseModel();
	updatePosition();
	isOpen.value = true;
	nextTick(() => {
		hourColRef.value?.scrollTo({ top: hPos(tempHour.value), behavior: "instant" });
		minColRef.value?.scrollTo({ top: mPos(tempMinute.value), behavior: "instant" });
	});
	document.addEventListener("mousedown", onClickOutside);
	document.addEventListener("scroll", onScrollOutside, { capture: true, passive: true } as AddEventListenerOptions);
	window.addEventListener("resize", close, { passive: true } as AddEventListenerOptions);
}

function close() {
	if (!isOpen.value) return;
	isOpen.value = false;
	if (hourTimer) clearTimeout(hourTimer);
	if (minTimer) clearTimeout(minTimer);
	document.removeEventListener("mousedown", onClickOutside);
	document.removeEventListener("scroll", onScrollOutside, { capture: true } as EventListenerOptions);
	window.removeEventListener("resize", close);
}

function toggle() { isOpen.value ? close() : open(); }

onUnmounted(() => close());
</script>

<template>
	<div
		ref="containerRef"
		class="app-time"
		:class="{ 'app-time--open': isOpen, 'app-time--disabled': disabled }">
		<!-- Hidden native input for test compatibility -->
		<input
			type="time"
			class="app-time__native field__select"
			:value="modelValue"
			:disabled="disabled"
			tabindex="-1"
			aria-hidden="true"
			@change="emit('update:modelValue', ($event.target as HTMLInputElement).value)" />

		<button
			type="button"
			class="app-time__trigger"
			:disabled="disabled"
			@click="toggle">
			<PhClock
				class="app-time__icon"
				:size="15" />
			<span
				class="app-time__value"
				:class="{ 'app-time__value--empty': !modelValue }">
				{{ displayValue || placeholder || "Выберите время" }}
			</span>
			<PhCaretDown
				class="app-time__arrow"
				:size="14"
				weight="bold" />
		</button>

		<Teleport to="body">
			<Transition name="app-time-drop">
				<div
					v-if="isOpen"
					ref="popupRef"
					class="app-time__popup"
					:style="dropdownStyle"
					@mousedown.stop>
					<div class="tp__cols">
						<!-- Center selection bar -->
						<div class="tp__selector" />
						<!-- Drum-roll gradient fades -->
						<div class="tp__fade tp__fade--top" />
						<div class="tp__fade tp__fade--bottom" />

						<!-- Hours column -->
						<div
							ref="hourColRef"
							class="tp__col"
							@scroll="onHourScroll"
							@click="onHourColClick">
							<div
								v-for="i in PAD"
								:key="`hp${i}`"
								class="tp__item tp__item--pad" />
							<template
								v-for="c in HOUR_COPIES"
								:key="`hc${c}`">
								<div
									v-for="h in HOURS"
									:key="`${c}-${h}`"
									class="tp__item"
									:data-value="h">
									{{ pad2(h) }}
								</div>
							</template>
							<div
								v-for="i in PAD"
								:key="`hpe${i}`"
								class="tp__item tp__item--pad" />
						</div>

						<span class="tp__sep">:</span>

						<!-- Minutes column -->
						<div
							ref="minColRef"
							class="tp__col"
							@scroll="onMinScroll"
							@click="onMinColClick">
							<div
								v-for="i in PAD"
								:key="`mp${i}`"
								class="tp__item tp__item--pad" />
							<template
								v-for="c in MIN_COPIES"
								:key="`mc${c}`">
								<div
									v-for="m in MINUTES"
									:key="`${c}-${m}`"
									class="tp__item"
									:data-value="m">
									{{ pad2(m) }}
								</div>
							</template>
							<div
								v-for="i in PAD"
								:key="`mpe${i}`"
								class="tp__item tp__item--pad" />
						</div>
					</div>

					<div class="tp__footer">
						<button
							type="button"
							class="tp__now-btn"
							@mousedown.prevent
							@click="selectNow">
							Сейчас
						</button>
					</div>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>

<style scoped>
.app-time {
	position: relative;
	width: fit-content;
}

.app-time__native {
	position: absolute;
	inset: 0;
	opacity: 0;
	pointer-events: none;
	width: 100%;
	height: 100%;
	z-index: -1;
}

.app-time__trigger {
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
.app-time__trigger:hover {
	border-color: var(--text-muted);
}
.app-time__trigger:focus-visible {
	border-color: var(--border-focus);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 20%, transparent);
}
.app-time--open .app-time__trigger {
	border-color: var(--border-focus);
}
.app-time--disabled .app-time__trigger {
	opacity: 0.45;
	cursor: not-allowed;
}

.app-time__icon {
	flex-shrink: 0;
	color: var(--text-secondary);
}
.app-time__value {
	flex: 1;
	text-align: left;
}
.app-time__value--empty {
	color: var(--text-muted);
}
.app-time__arrow {
	flex-shrink: 0;
	color: var(--text-secondary);
	transition: transform var(--transition);
}
.app-time--open .app-time__arrow {
	transform: rotate(180deg);
}

/* ── Popup ── */
.app-time__popup {
	position: fixed;
	z-index: 1100;
	width: 200px;
	background: var(--bg-elevated);
	border: 1px solid var(--border);
	border-radius: var(--radius-lg);
	box-shadow: var(--shadow-lg);
	overflow: hidden;
}

/* ── Drum-roll columns ── */
.tp__cols {
	display: flex;
	align-items: center;
	position: relative;
	height: 180px; /* 5 × 36px */
}

/* Center selection highlight */
.tp__selector {
	position: absolute;
	top: 50%;
	left: 0;
	right: 0;
	height: 36px;
	transform: translateY(-50%);
	background: rgba(255, 255, 255, 0.05);
	border-top: 1px solid var(--border);
	border-bottom: 1px solid var(--border);
	pointer-events: none;
	z-index: 1;
}

/* Gradient fade-out (top and bottom 40%) */
.tp__fade {
	position: absolute;
	left: 0;
	right: 0;
	height: 40%;
	pointer-events: none;
	z-index: 2;
}
.tp__fade--top {
	top: 0;
	background: linear-gradient(to bottom, var(--bg-elevated) 0%, transparent 100%);
}
.tp__fade--bottom {
	bottom: 0;
	background: linear-gradient(to top, var(--bg-elevated) 0%, transparent 100%);
}

/* Scrollable column — no CSS snap, JS handles it */
.tp__col {
	flex: 1;
	height: 180px;
	overflow-y: scroll;
	overscroll-behavior-y: contain;
	scrollbar-width: none;
	-ms-overflow-style: none;
	position: relative;
	z-index: 0;
}
.tp__col::-webkit-scrollbar {
	display: none;
}

/* Row items */
.tp__item {
	height: 36px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 18px;
	font-weight: 500;
	color: var(--text-primary);
	cursor: pointer;
	user-select: none;
}
.tp__item--pad {
	pointer-events: none;
}

/* Colon separator */
.tp__sep {
	font-size: 20px;
	font-weight: 700;
	color: var(--text-primary);
	padding: 0 4px;
	flex-shrink: 0;
	position: relative;
	z-index: 3;
	pointer-events: none;
	line-height: 1;
}

/* Footer */
.tp__footer {
	display: flex;
	justify-content: center;
	border-top: 1px solid var(--border);
	padding: var(--space-2) var(--space-3);
}
.tp__now-btn {
	background: none;
	border: none;
	color: var(--accent-primary);
	font-size: var(--font-sm);
	cursor: pointer;
	padding: var(--space-1) var(--space-3);
	border-radius: var(--radius-md);
	transition: background var(--transition);
}
.tp__now-btn:hover {
	background: rgba(255, 255, 255, 0.07);
}

/* Animation */
.app-time-drop-enter-active,
.app-time-drop-leave-active {
	transition: opacity 0.15s, transform 0.15s;
}
.app-time-drop-enter-from,
.app-time-drop-leave-to {
	opacity: 0;
	transform: translateY(-6px) scale(0.98);
}
</style>
