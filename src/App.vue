<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppShell from "@/components/layout/AppShell.vue";
import AppConfirm from "@/components/ui/AppConfirm.vue";
import { useSettingsStore } from "@/stores/settings.store";
import { useRouteTransition } from "@/composables/useRouteTransition";

const settingsStore = useSettingsStore();
const route = useRoute();
const router = useRouter();
const { transitionName } = useRouteTransition(router);

// New screen starts from the top of the shared scroll container
function onRouteEnter(el: Element) {
	if (!transitionName.value) return;
	if (el.parentElement) el.parentElement.scrollTop = 0;
}

onMounted(() => {
	settingsStore.applyTheme();
});
</script>

<template>
	<template v-if="route.name === 'setup'">
		<RouterView />
	</template>
	<template v-else>
		<AppShell>
			<RouterView v-slot="{ Component }">
				<Transition
					:name="transitionName || 'route-none'"
					@enter="onRouteEnter">
					<component :is="Component" />
				</Transition>
			</RouterView>
		</AppShell>
	</template>
	<AppConfirm />
</template>

<style>
/* Screen slide: only the entering screen animates (the old one is removed
   instantly), so views keep their natural flow size — transform only.
   Global on purpose: classes land on view roots rendered through RouterView. */
.route-forward-enter-active,
.route-back-enter-active {
	transition: transform 250ms cubic-bezier(0.33, 1, 0.68, 1);
}
.route-forward-enter-from {
	transform: translateX(100%);
}
.route-back-enter-from {
	transform: translateX(-100%);
}

@media (prefers-reduced-motion: reduce) {
	.route-forward-enter-active,
	.route-back-enter-active {
		transition: none;
	}
}
</style>
