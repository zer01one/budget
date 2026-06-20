import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockIsNativePlatform, mockRequestPermissions, mockSchedule, mockCancel } = vi.hoisted(() => ({
	mockIsNativePlatform: vi.fn(() => false),
	mockRequestPermissions: vi.fn(async () => ({ display: "granted" })),
	mockSchedule: vi.fn(async () => {}),
	mockCancel: vi.fn(async () => {})
}));

vi.mock("@capacitor/core", () => ({
	Capacitor: { isNativePlatform: mockIsNativePlatform }
}));

vi.mock("@capacitor/local-notifications", () => ({
	LocalNotifications: {
		requestPermissions: mockRequestPermissions,
		schedule: mockSchedule,
		cancel: mockCancel
	}
}));

import { requestNotificationPermission, scheduleDailyReminder, cancelDailyReminder, notifyBudgetWarning } from "./notifications.service";
import type { BudgetEntry } from "@/types";

function makeBudget(overrides: Partial<BudgetEntry> = {}): BudgetEntry {
	return {
		id: "budget-test-abcd",
		month: "2026-06",
		categoryId: "cat-1",
		limitAmount: 10000,
		currency: "KZT",
		notifyAt: 80,
		notifyEnabled: true,
		updatedAt: "2026-06-01T00:00:00Z",
		deviceId: "dev",
		version: 1,
		...overrides
	};
}

describe("notifications – non-native platform (no-ops)", () => {
	beforeEach(() => {
		mockIsNativePlatform.mockReturnValue(false);
		vi.clearAllMocks();
	});

	it("requestNotificationPermission() returns false", async () => {
		const result = await requestNotificationPermission();
		expect(result).toBe(false);
	});

	it("requestNotificationPermission() does not call LocalNotifications", async () => {
		await requestNotificationPermission();
		expect(mockRequestPermissions).not.toHaveBeenCalled();
	});

	it("scheduleDailyReminder() does not call LocalNotifications.schedule", async () => {
		await scheduleDailyReminder("09:00");
		expect(mockSchedule).not.toHaveBeenCalled();
	});

	it("cancelDailyReminder() does not call LocalNotifications.cancel", async () => {
		await cancelDailyReminder();
		expect(mockCancel).not.toHaveBeenCalled();
	});

	it("notifyBudgetWarning() does not call LocalNotifications.schedule", async () => {
		await notifyBudgetWarning(makeBudget(), "Food", 90);
		expect(mockSchedule).not.toHaveBeenCalled();
	});
});

describe("notifications – native platform", () => {
	beforeEach(() => {
		mockIsNativePlatform.mockReturnValue(true);
		vi.clearAllMocks();
	});

	it("requestNotificationPermission() calls requestPermissions", async () => {
		await requestNotificationPermission();
		expect(mockRequestPermissions).toHaveBeenCalledOnce();
	});

	it("requestNotificationPermission() returns true when granted", async () => {
		mockRequestPermissions.mockResolvedValueOnce({ display: "granted" });
		const result = await requestNotificationPermission();
		expect(result).toBe(true);
	});

	it("requestNotificationPermission() returns false when denied", async () => {
		mockRequestPermissions.mockResolvedValueOnce({ display: "denied" });
		const result = await requestNotificationPermission();
		expect(result).toBe(false);
	});

	it("scheduleDailyReminder() cancels previous reminder first", async () => {
		await scheduleDailyReminder("09:00");
		expect(mockCancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }] });
	});

	it("scheduleDailyReminder() calls schedule once", async () => {
		await scheduleDailyReminder("09:00");
		expect(mockSchedule).toHaveBeenCalledOnce();
	});

	it("scheduleDailyReminder() parses time string correctly", async () => {
		await scheduleDailyReminder("14:30");
		const callArgs = mockSchedule.mock.calls[0][0];
		const notification = callArgs.notifications[0];
		const scheduled: Date = notification.schedule.at;
		expect(scheduled.getHours()).toBe(14);
		expect(scheduled.getMinutes()).toBe(30);
	});

	it("scheduleDailyReminder() uses id=1 for the notification", async () => {
		await scheduleDailyReminder("09:00");
		const notification = mockSchedule.mock.calls[0][0].notifications[0];
		expect(notification.id).toBe(1);
	});

	it("scheduleDailyReminder() schedules as repeating daily", async () => {
		await scheduleDailyReminder("09:00");
		const notification = mockSchedule.mock.calls[0][0].notifications[0];
		expect(notification.schedule.repeats).toBe(true);
		expect(notification.schedule.every).toBe("day");
	});

	it("cancelDailyReminder() cancels notification id=1", async () => {
		await cancelDailyReminder();
		expect(mockCancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }] });
	});

	it("notifyBudgetWarning() calls schedule with correct ID formula", async () => {
		// id = "budget-test-abcd" → last 4 chars = "abcd"
		// parseInt("abcd", 16) = 43981
		// 43981 % 1000 = 981
		// 2000 + 981 = 2981
		const budget = makeBudget({ id: "budget-test-abcd" });
		await notifyBudgetWarning(budget, "Food", 90);
		const notification = mockSchedule.mock.calls[0][0].notifications[0];
		expect(notification.id).toBe(2981);
	});

	it("notifyBudgetWarning() pct >= 100: uses 'Бюджет превышен' title", async () => {
		await notifyBudgetWarning(makeBudget(), "Food", 100);
		const notification = mockSchedule.mock.calls[0][0].notifications[0];
		expect(notification.title).toContain("превышен");
	});

	it("notifyBudgetWarning() pct < 100: uses 'Бюджет заканчивается' title", async () => {
		await notifyBudgetWarning(makeBudget(), "Food", 80);
		const notification = mockSchedule.mock.calls[0][0].notifications[0];
		expect(notification.title).toContain("заканчивается");
	});

	it("notifyBudgetWarning() pct >= 100: body contains 'превышен'", async () => {
		await notifyBudgetWarning(makeBudget({ limitAmount: 5000 }), "Food", 105);
		const notification = mockSchedule.mock.calls[0][0].notifications[0];
		expect(notification.body).toContain("превышен");
	});

	it("notifyBudgetWarning() pct < 100: body contains percentage", async () => {
		await notifyBudgetWarning(makeBudget({ limitAmount: 5000 }), "Food", 80);
		const notification = mockSchedule.mock.calls[0][0].notifications[0];
		expect(notification.body).toContain("80%");
	});

	it("notifyBudgetWarning() body contains category name", async () => {
		await notifyBudgetWarning(makeBudget(), "Продукты", 50);
		const notification = mockSchedule.mock.calls[0][0].notifications[0];
		expect(notification.body).toContain("Продукты");
	});

	it("notifyBudgetWarning() different budget IDs get different IDs", async () => {
		await notifyBudgetWarning(makeBudget({ id: "budget-test-0001" }), "Food", 90);
		const id1 = mockSchedule.mock.calls[0][0].notifications[0].id;
		vi.clearAllMocks();
		await notifyBudgetWarning(makeBudget({ id: "budget-test-0002" }), "Food", 90);
		const id2 = mockSchedule.mock.calls[0][0].notifications[0].id;
		expect(id1).not.toBe(id2);
	});
});

describe("scheduleDailyReminder – next-day rollover", () => {
	beforeEach(() => {
		mockIsNativePlatform.mockReturnValue(true);
		vi.clearAllMocks();
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	it("schedules next day when time has already passed today", async () => {
		// Set current time to 15:00 on 2026-06-15
		vi.setSystemTime(new Date(2026, 5, 15, 15, 0, 0));
		await scheduleDailyReminder("09:00"); // 09:00 is in the past
		const scheduled: Date = mockSchedule.mock.calls[0][0].notifications[0].schedule.at;
		expect(scheduled.getDate()).toBe(16); // next day
	});

	it("schedules today when time is in the future", async () => {
		vi.setSystemTime(new Date(2026, 5, 15, 7, 0, 0)); // 07:00
		await scheduleDailyReminder("09:00"); // 09:00 is in the future
		const scheduled: Date = mockSchedule.mock.calls[0][0].notifications[0].schedule.at;
		expect(scheduled.getDate()).toBe(15); // same day
	});
});
