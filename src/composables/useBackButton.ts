import { onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";

export function useBackButton() {
	const router = useRouter();
	let handle: PluginListenerHandle | null = null;

	onMounted(async () => {
		if (!Capacitor.isNativePlatform()) return;

		handle = await App.addListener("backButton", ({ canGoBack }) => {
			if (canGoBack) {
				router.back();
			} else {
				App.minimizeApp();
			}
		});
	});

	onUnmounted(() => {
		handle?.remove();
	});
}
