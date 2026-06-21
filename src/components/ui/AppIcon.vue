<script lang="ts">
import type { Component } from "vue";
import {
	PhWallet,
	PhBank,
	PhCreditCard,
	PhCurrencyDollar,
	PhPiggyBank,
	PhCurrencyBtc,
	PhChartLineUp,
	PhCurrencyEur,
	PhStar,
	PhCoins,
	PhForkKnife,
	PhCoffee,
	PhCar,
	PhBus,
	PhTrain,
	PhBicycle,
	PhAirplane,
	PhHouse,
	PhFirstAid,
	PhPill,
	PhShieldCheck,
	PhTShirt,
	PhScissors,
	PhFilmStrip,
	PhTelevision,
	PhMusicNotes,
	PhGameController,
	PhPhone,
	PhWifiHigh,
	PhGraduationCap,
	PhBookOpen,
	PhShoppingCart,
	PhShoppingBag,
	PhBarbell,
	PhRepeat,
	PhBriefcase,
	PhLaptop,
	PhGift,
	PhGasPump,
	PhPlug,
	PhDrop,
	PhPawPrint,
	PhBaby,
	PhWrench,
	PhFlame,
	PhLeaf,
	PhHeart,
	PhSun,
	PhTag,
	PhArrowsLeftRight,
	PhQuestion
} from "@phosphor-icons/vue";

export const ICON_MAP: Record<string, Component> = {
	// Finance / accounts
	wallet: PhWallet,
	bank: PhBank,
	card: PhCreditCard,
	cash: PhCurrencyDollar,
	piggy: PhPiggyBank,
	savings: PhPiggyBank,
	crypto: PhCurrencyBtc,
	invest: PhChartLineUp,
	investment: PhChartLineUp,
	dollar: PhCurrencyDollar,
	euro: PhCurrencyEur,
	star: PhStar,
	coins: PhCoins,
	// Food & drink
	food: PhForkKnife,
	coffee: PhCoffee,
	// Transport
	transport: PhCar,
	bus: PhBus,
	train: PhTrain,
	bicycle: PhBicycle,
	travel: PhAirplane,
	airplane: PhAirplane,
	fuel: PhGasPump,
	// Home & utilities
	home: PhHouse,
	electricity: PhPlug,
	water: PhDrop,
	wifi: PhWifiHigh,
	// Health
	health: PhFirstAid,
	medicine: PhPill,
	insurance: PhShieldCheck,
	// Lifestyle
	clothes: PhTShirt,
	beauty: PhScissors,
	entertainment: PhFilmStrip,
	tv: PhTelevision,
	music: PhMusicNotes,
	game: PhGameController,
	// Communication & education
	phone: PhPhone,
	education: PhGraduationCap,
	book: PhBookOpen,
	// Shopping
	shopping: PhShoppingCart,
	bag: PhShoppingBag,
	// Sport
	sport: PhBarbell,
	// Work & income
	subscription: PhRepeat,
	salary: PhBriefcase,
	freelance: PhLaptop,
	// Misc
	gift: PhGift,
	pet: PhPawPrint,
	baby: PhBaby,
	tools: PhWrench,
	fire: PhFlame,
	nature: PhLeaf,
	heart: PhHeart,
	sun: PhSun,
	tag: PhTag,
	// Special
	transfer: PhArrowsLeftRight,
	other: PhQuestion
};

// Fallback for missing icon names
const _fallback = PhQuestion;
</script>

<script setup lang="ts">
defineProps<{
	name: string;
	size?: number | string;
	weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
}>();
</script>

<template>
	<component
		:is="ICON_MAP[name] ?? _fallback"
		:size="size ?? '1em'"
		:weight="weight ?? 'regular'" />
</template>
