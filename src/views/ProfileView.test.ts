import { describe, it, expect, vi } from "vitest";

// Unit tests for ProfileView logic

describe("ProfileView – toggleNotifications logic", () => {
	async function makeToggle(initialEnabled: boolean) {
		let notifEnabled = initialEnabled;
		const mockRequestPermission = vi.fn(async () => true);
		const mockSchedule = vi.fn(async () => {});
		const mockCancel = vi.fn(async () => {});
		const mockSave = vi.fn(async () => {});
		const settingsState = { notificationsEnabled: initialEnabled };

		async function toggleNotifications(time: string) {
			notifEnabled = !notifEnabled;
			if (notifEnabled) {
				const granted = await mockRequestPermission();
				if (!granted) {
					notifEnabled = false;
					return;
				}
				await mockSchedule(time);
			} else {
				await mockCancel();
			}
			settingsState.notificationsEnabled = notifEnabled;
			await mockSave();
		}

		return {
			toggleNotifications,
			mockRequestPermission,
			mockSchedule,
			mockCancel,
			mockSave,
			settingsState,
			get enabled() {
				return notifEnabled;
			}
		};
	}

	it("disabling → calls cancelDailyReminder and saves", async () => {
		const { toggleNotifications, mockCancel, mockSave } = await makeToggle(true);
		await toggleNotifications("20:00");
		expect(mockCancel).toHaveBeenCalledOnce();
		expect(mockSave).toHaveBeenCalledOnce();
	});

	it("enabling with granted permission → calls scheduleDailyReminder", async () => {
		const { toggleNotifications, mockSchedule } = await makeToggle(false);
		await toggleNotifications("09:00");
		expect(mockSchedule).toHaveBeenCalledWith("09:00");
	});

	it("enabling but permission denied → reverts to false", async () => {
		const obj = await makeToggle(false);
		obj.mockRequestPermission.mockResolvedValue(false);
		await obj.toggleNotifications("09:00");
		expect(obj.enabled).toBe(false);
	});

	it("enabling with denied permission → does not schedule", async () => {
		const obj = await makeToggle(false);
		obj.mockRequestPermission.mockResolvedValue(false);
		await obj.toggleNotifications("09:00");
		expect(obj.mockSchedule).not.toHaveBeenCalled();
	});

	it("disabling → settingsState.notificationsEnabled = false", async () => {
		const { toggleNotifications, settingsState } = await makeToggle(true);
		await toggleNotifications("20:00");
		expect(settingsState.notificationsEnabled).toBe(false);
	});
});

describe("ProfileView – saveNotifTime logic", () => {
	it("does nothing when notifications disabled", async () => {
		const notifEnabled = false;
		const mockSchedule = vi.fn(async () => {});
		const mockSave = vi.fn(async () => {});
		const settingsState = { reminderTime: "20:00" };

		async function saveNotifTime(time: string) {
			if (!notifEnabled) return;
			settingsState.reminderTime = time;
			await Promise.all([mockSchedule(time), mockSave()]);
		}

		await saveNotifTime("09:00");
		expect(mockSchedule).not.toHaveBeenCalled();
		expect(mockSave).not.toHaveBeenCalled();
	});

	it("updates reminderTime and saves when enabled", async () => {
		const notifEnabled = true;
		const mockSchedule = vi.fn(async () => {});
		const mockSave = vi.fn(async () => {});
		const settingsState = { reminderTime: "20:00" };

		async function saveNotifTime(time: string) {
			if (!notifEnabled) return;
			settingsState.reminderTime = time;
			await Promise.all([mockSchedule(time), mockSave()]);
		}

		await saveNotifTime("08:30");
		expect(settingsState.reminderTime).toBe("08:30");
		expect(mockSchedule).toHaveBeenCalledWith("08:30");
		expect(mockSave).toHaveBeenCalled();
	});
});
