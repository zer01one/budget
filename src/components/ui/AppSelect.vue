<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from "vue";
import { PhCaretDown, PhCheck } from "@phosphor-icons/vue";

export interface SelectOption {
	value: string;
	label: string;
}

const props = defineProps<{
	modelValue: string;
	options: SelectOption[];
	disabled?: boolean;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string];
}>();

const isOpen = ref(false);
const focusedIndex = ref(-1);
const containerRef = ref<HTMLElement | null>(null);
const dropdownListRef = ref<HTMLElement | null>(null);
const dropdownStyle = ref({ top: "0px", left: "0px", width: "0px" });

const selectedLabel = computed(
	() => props.options.find((o) => o.value === props.modelValue)?.label ?? ""
);

function updatePosition() {
	if (!containerRef.value) return;
	const rect = containerRef.value.getBoundingClientRect();
	const maxH = 248;
	const showAbove = rect.bottom + maxH + 8 > window.innerHeight && rect.top > maxH + 8;
	dropdownStyle.value = {
		top: showAbove ? `${rect.top - maxH - 4}px` : `${rect.bottom + 4}px`,
		left: `${rect.left}px`,
		width: `${rect.width}px`,
	};
}

function open() {
	if (props.disabled) return;
	updatePosition();
	isOpen.value = true;
	focusedIndex.value = props.options.findIndex((o) => o.value === props.modelValue);
	document.addEventListener("mousedown", onClickOutside);
	document.addEventListener("scroll", close, { capture: true, passive: true } as AddEventListenerOptions);
	window.addEventListener("resize", close, { passive: true } as AddEventListenerOptions);
}

function close() {
	if (!isOpen.value) return;
	isOpen.value = false;
	document.removeEventListener("mousedown", onClickOutside);
	document.removeEventListener("scroll", close, { capture: true } as EventListenerOptions);
	window.removeEventListener("resize", close);
}

function toggle() {
	isOpen.value ? close() : open();
}

function select(value: string) {
	emit("update:modelValue", value);
	close();
}

function onClickOutside(e: MouseEvent) {
	if (!containerRef.value?.contains(e.target as Node)) close();
}

function onKeydown(e: KeyboardEvent) {
	if (!isOpen.value) {
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			open();
		}
		return;
	}
	switch (e.key) {
		case "Escape":
			e.preventDefault();
			close();
			break;
		case "ArrowDown":
			e.preventDefault();
			focusedIndex.value = Math.min(focusedIndex.value + 1, props.options.length - 1);
			break;
		case "ArrowUp":
			e.preventDefault();
			focusedIndex.value = Math.max(focusedIndex.value - 1, 0);
			break;
		case "Enter":
		case " ":
			e.preventDefault();
			if (focusedIndex.value >= 0 && focusedIndex.value < props.options.length) {
				select(props.options[focusedIndex.value].value);
			} else {
				close();
			}
			break;
		case "Tab":
			close();
			break;
	}
}

watch(focusedIndex, (i) => {
	if (i < 0) return;
	nextTick(() => {
		dropdownListRef.value?.children[i]?.scrollIntoView({ block: "nearest" });
	});
});

onUnmounted(() => close());
</script>

<template>
	<div
		ref="containerRef"
		class="app-select"
		:class="{ 'app-select--open': isOpen, 'app-select--disabled': disabled }">
		<!-- Hidden native select: keeps tests working + screen reader access -->
		<select
			class="app-select__native field__select"
			:value="modelValue"
			:disabled="disabled"
			tabindex="-1"
			aria-hidden="true"
			@change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
			<option
				v-for="opt in options"
				:key="opt.value"
				:value="opt.value">
				{{ opt.label }}
			</option>
		</select>

		<!-- Visual trigger -->
		<button
			type="button"
			class="app-select__trigger"
			:disabled="disabled"
			@click="toggle"
			@keydown="onKeydown">
			<span
				class="app-select__value"
				:class="{ 'app-select__value--empty': !modelValue }">
				{{ selectedLabel }}
			</span>
			<PhCaretDown
				class="app-select__arrow"
				:size="14"
				weight="bold" />
		</button>

		<!-- Teleported dropdown (escapes overflow:hidden in modals) -->
		<Teleport to="body">
			<Transition name="app-select-drop">
				<div
					v-if="isOpen"
					ref="dropdownListRef"
					class="app-select__dropdown"
					:style="dropdownStyle">
					<div
						v-for="(opt, i) in options"
						:key="opt.value"
						class="app-select__option"
						:class="{
							'app-select__option--selected': opt.value === modelValue,
							'app-select__option--focused': i === focusedIndex,
						}"
						@mousedown.prevent="select(opt.value)"
						@mouseenter="focusedIndex = i">
						<span>{{ opt.label }}</span>
						<PhCheck
							v-if="opt.value === modelValue"
							:size="13"
							weight="bold" />
					</div>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>

<style scoped>
.app-select {
	position: relative;
	width: 100%;
}

/* Hide native select visually but keep it accessible for tests */
.app-select__native {
	position: absolute;
	inset: 0;
	opacity: 0;
	pointer-events: none;
	width: 100%;
	height: 100%;
	z-index: -1;
}

.app-select__trigger {
	width: 100%;
	height: 40px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-2);
	padding: 0 var(--space-3);
	background: var(--bg-input);
	border: 1px solid var(--border);
	border-radius: var(--radius-md);
	color: var(--text-primary);
	font-size: var(--font-sm);
	cursor: pointer;
	text-align: left;
	transition: border-color var(--transition), background var(--transition);
	outline: none;
}
.app-select__trigger:hover {
	border-color: var(--text-muted);
}
.app-select__trigger:focus-visible {
	border-color: var(--border-focus);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 20%, transparent);
}
.app-select--open .app-select__trigger {
	border-color: var(--border-focus);
}
.app-select--disabled .app-select__trigger {
	opacity: 0.45;
	cursor: not-allowed;
}

.app-select__value {
	flex: 1;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}
.app-select__value--empty {
	color: var(--text-muted);
}

.app-select__arrow {
	flex-shrink: 0;
	color: var(--text-secondary);
	transition: transform var(--transition);
}
.app-select--open .app-select__arrow {
	transform: rotate(180deg);
}

/* Dropdown — fixed-positioned, teleported to body */
.app-select__dropdown {
	position: fixed;
	z-index: 1100;
	background: var(--bg-elevated);
	border: 1px solid var(--border);
	border-radius: var(--radius-md);
	box-shadow: var(--shadow-lg);
	overflow-y: auto;
	max-height: 248px;
	padding: var(--space-1) 0;
}

.app-select__option {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-2);
	padding: var(--space-2) var(--space-3);
	font-size: var(--font-sm);
	color: var(--text-primary);
	cursor: pointer;
	user-select: none;
	min-height: 36px;
	transition: background var(--transition);
}
.app-select__option:hover,
.app-select__option--focused {
	background: rgba(255, 255, 255, 0.06);
}
.app-select__option--selected {
	color: var(--accent-primary);
}
.app-select__option--selected.app-select__option--focused,
.app-select__option--selected:hover {
	background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
}

/* Enter/leave animation */
.app-select-drop-enter-active,
.app-select-drop-leave-active {
	transition: opacity 0.15s, transform 0.15s;
}
.app-select-drop-enter-from,
.app-select-drop-leave-to {
	opacity: 0;
	transform: translateY(-6px) scale(0.98);
}
</style>
