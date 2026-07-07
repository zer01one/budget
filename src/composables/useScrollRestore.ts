import { nextTick, onMounted, watch, type Ref } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";

const scrollCache = new Map<string, number>();

export function useScrollRestore(scrollElRef?: Ref<HTMLElement | null>) {
	const route = useRoute();

	function getEl(): HTMLElement | null {
		if (scrollElRef?.value) return scrollElRef.value;
		return document.querySelector<HTMLElement>(".shell__content");
	}

	function tryRestore() {
		const saved = scrollCache.get(route.fullPath);
		if (saved == null) return;
		const el = getEl();
		if (el) el.scrollTop = saved;
	}

	if (scrollElRef) {
		// Inner scroll container renders asynchronously — watch the ref
		watch(scrollElRef, (el) => {
			if (el) nextTick(tryRestore);
		});
	} else {
		onMounted(() => nextTick(tryRestore));
	}

	onBeforeRouteLeave(() => {
		const el = getEl();
		if (el) scrollCache.set(route.fullPath, el.scrollTop);
	});
}
