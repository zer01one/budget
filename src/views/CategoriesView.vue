<script setup lang="ts">
import { ref, computed } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppModal from "@/components/ui/AppModal.vue";
import AppInput from "@/components/ui/AppInput.vue";
import ColorPicker from "@/components/ui/ColorPicker.vue";
import IconPicker from "@/components/ui/IconPicker.vue";
import AppIcon from "@/components/ui/AppIcon.vue";
import { showConfirm } from "@/utils/confirm";
import { useCategoriesStore } from "@/stores/categories.store";
import { useGamificationStore } from "@/stores/gamification.store";
import type { Category, TransactionType } from "@/types";

const categoriesStore = useCategoriesStore();
const gamificationStore = useGamificationStore();

const activeTab = ref<"expense" | "income">("expense");
const TAB_ORDER: ReadonlyArray<"expense" | "income"> = ["expense", "income"];
const tabTransition = ref<"tab-forward" | "tab-back">("tab-forward");

function switchTab(tab: "expense" | "income") {
	if (tab === activeTab.value) return;
	tabTransition.value = TAB_ORDER.indexOf(tab) > TAB_ORDER.indexOf(activeTab.value) ? "tab-forward" : "tab-back";
	activeTab.value = tab;
}

const showModal = ref(false);
const editingCategory = ref<Category | null>(null);

// Form state
const form = ref({ name: "", color: "#EF4444", icon: "other", type: "expense" as TransactionType });
const isSubmitting = ref(false);
const errors = ref<Record<string, string>>({});

const displayed = computed(() => categoriesStore.categories.filter((c) => c.type === activeTab.value && !c.isArchived));

function openAdd() {
	editingCategory.value = null;
	form.value = { name: "", color: "#EF4444", icon: "other", type: activeTab.value };
	errors.value = {};
	showModal.value = true;
}

function openEdit(cat: Category) {
	if (cat.isSystem) return;
	editingCategory.value = cat;
	form.value = { name: cat.name, color: cat.color, icon: cat.icon, type: cat.type };
	errors.value = {};
	showModal.value = true;
}

function validate(): boolean {
	errors.value = {};
	if (!form.value.name.trim()) errors.value.name = "Введите название";
	return Object.keys(errors.value).length === 0;
}

async function save() {
	if (!validate() || isSubmitting.value) return;
	isSubmitting.value = true;
	try {
		if (editingCategory.value) {
			await categoriesStore.updateCategory(editingCategory.value.id, {
				name: form.value.name.trim(),
				color: form.value.color,
				icon: form.value.icon
			});
		} else {
			await categoriesStore.addCategory({
				name: form.value.name.trim(),
				type: form.value.type,
				color: form.value.color,
				icon: form.value.icon,
				parentId: null,
				isArchived: false,
				sortOrder: categoriesStore.categories.length
			});
			gamificationStore.onCategoryCreated();
		}
		showModal.value = false;
	} finally {
		isSubmitting.value = false;
	}
}

async function deleteCategory(cat: Category) {
	if (cat.isSystem) return;
	if (!await showConfirm(`Удалить категорию «${cat.name}»?`)) return;
	await categoriesStore.deleteCategory(cat.id);
}
</script>

<template>
	<div class="categories-view">
		<div class="categories-view__header">
			<h2 class="categories-view__title tp-heading-md-bold">Категории</h2>
			<AppButton
				size="sm"
				@click="openAdd"
				>+ Добавить</AppButton
			>
		</div>

		<!-- Tabs -->
		<div class="tabs">
			<button
				:class="['tab', 'tp-label-md-medium', { 'tab--active': activeTab === 'expense' }]"
				@click="switchTab('expense')">
				Расходы
			</button>
			<button
				:class="['tab', 'tp-label-md-medium', { 'tab--active': activeTab === 'income' }]"
				@click="switchTab('income')">
				Доходы
			</button>
		</div>

		<!-- List (keyed by tab so switching slides the whole list) -->
		<div class="cat-list-wrap">
			<Transition :name="tabTransition">
				<div
					:key="activeTab"
					class="cat-list">
					<div
						v-for="cat in displayed"
						:key="cat.id"
						class="cat-row"
						@click="openEdit(cat)">
						<div
							class="cat-row__icon"
							:style="{ background: cat.color + '22', color: cat.color }">
							<AppIcon :name="cat.icon" />
						</div>
						<div class="cat-row__name tp-label-md-medium">{{ cat.name }}</div>
						<span
							v-if="cat.isSystem"
							class="cat-row__system tp-caption-md-regular"
							>системная</span
						>
						<button
							v-else
							class="cat-row__delete"
							@click.stop="deleteCategory(cat)">
							✕
						</button>
					</div>

					<div
						v-if="displayed.length === 0"
						class="cat-list__empty">
						Нет категорий. Нажмите «+ Добавить».
					</div>
				</div>
			</Transition>
		</div>

		<!-- Modal -->
		<AppModal
			v-if="showModal"
			:title="editingCategory ? 'Редактировать' : 'Новая категория'"
			@close="showModal = false">
			<div class="modal-form">
				<!-- Preview chip -->
				<div
					class="cat-preview tp-label-md-semibold"
					:style="{ background: form.color + '22', borderColor: form.color }">
					<span><AppIcon :name="form.icon" /></span>
					<span>{{ form.name || "Название" }}</span>
				</div>

				<AppInput
					v-model="form.name"
					label="Название"
					placeholder="Продукты"
					:error="errors.name" />

				<div
					v-if="!editingCategory"
					class="field">
					<label class="field__label tp-label-md-medium">Тип</label>
					<div class="type-btns">
						<button
							:class="['type-btn', 'tp-body-md-regular', { 'type-btn--active': form.type === 'expense' }]"
							@click="form.type = 'expense'">
							Расход
						</button>
						<button
							:class="['type-btn', 'tp-body-md-regular', { 'type-btn--active': form.type === 'income' }]"
							@click="form.type = 'income'">
							Доход
						</button>
					</div>
				</div>

				<ColorPicker
					v-model="form.color"
					label="Цвет" />
				<IconPicker
					v-model="form.icon"
					label="Иконка" />
			</div>

			<template #footer>
				<AppButton
					variant="secondary"
					@click="showModal = false"
					>Отмена</AppButton
				>
				<AppButton
					:loading="isSubmitting"
					@click="save">
					{{ editingCategory ? "Сохранить" : "Создать" }}
				</AppButton>
			</template>
		</AppModal>
	</div>
</template>

<style scoped>
.categories-view {
	display: flex;
	flex-direction: column;
}
.categories-view__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-5);
}

.tabs {
	display: flex;
	gap: var(--space-2);
	padding: 0 var(--space-5) var(--space-4);
}
.tab {
	flex: 1;
	height: 36px;
	border-radius: var(--radius-md);
	background: var(--bg-elevated);
	border: none;
	color: var(--text-secondary);
	cursor: pointer;
	transition:
		background var(--transition),
		color var(--transition);
}
.tab--active {
	background: var(--accent-primary);
	color: #fff;
}

.cat-list-wrap {
	position: relative;
	overflow: hidden;
}
.cat-list {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	padding: 0 var(--space-5) var(--space-8);
}

/* Tab switch: both lists slide horizontally like screens in a pager */
.tab-forward-enter-active,
.tab-forward-leave-active,
.tab-back-enter-active,
.tab-back-leave-active {
	transition:
		transform 260ms cubic-bezier(0.33, 1, 0.68, 1),
		opacity 260ms ease;
}
.tab-forward-leave-active,
.tab-back-leave-active {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
}
.tab-forward-enter-from {
	transform: translateX(100%);
	opacity: 0;
}
.tab-forward-leave-to {
	transform: translateX(-100%);
	opacity: 0;
}
.tab-back-enter-from {
	transform: translateX(-100%);
	opacity: 0;
}
.tab-back-leave-to {
	transform: translateX(100%);
	opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
	.tab-forward-enter-active,
	.tab-forward-leave-active,
	.tab-back-enter-active,
	.tab-back-leave-active {
		transition: none;
	}
}
.cat-list__empty {
	text-align: center;
	color: var(--text-muted);
	padding: var(--space-8);
}

.cat-row {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-3) var(--space-4);
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: var(--radius-lg);
	cursor: pointer;
	transition: background var(--transition);
}
.cat-row:hover {
	background: var(--bg-elevated);
}
.cat-row__icon {
	width: 36px;
	height: 36px;
	border-radius: var(--radius-sm);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 16px;
	flex-shrink: 0;
}
.cat-row__name {
	flex: 1;
}
.cat-row__system {
	color: var(--text-muted);
	padding: 2px var(--space-2);
	background: var(--bg-elevated);
	border-radius: var(--radius-xs);
}
.cat-row__delete {
	width: 28px;
	height: 28px;
	border-radius: var(--radius-sm);
	background: none;
	border: none;
	color: var(--text-muted);
	cursor: pointer;
	font-size: 12px;
}
.cat-row__delete:hover {
	color: var(--accent-danger);
	background: var(--accent-danger-soft);
}

.modal-form {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
}

.cat-preview {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-3) var(--space-4);
	border-radius: var(--radius-md);
	border: 1px solid;
}

.field {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}
.field__label {
	color: var(--text-secondary);
}
.type-btns {
	display: flex;
	gap: var(--space-2);
}
.type-btn {
	flex: 1;
	height: 36px;
	border-radius: var(--radius-md);
	background: var(--bg-elevated);
	border: none;
	color: var(--text-secondary);
	cursor: pointer;
	transition:
		background var(--transition),
		color var(--transition);
}
.type-btn--active {
	background: var(--accent-primary);
	color: #fff;
}
</style>
