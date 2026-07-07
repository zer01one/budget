export interface ParsedReceipt {
	amount: number;
	date: string; // YYYY-MM-DD
	time: string; // HH:mm
	type: "expense" | "income";
	fn: string;
	fd: string;
	fp: string;
}

const DATE_TIME_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/;

function extractQueryString(raw: string): string {
	const trimmed = raw.trim();
	const idx = Math.max(trimmed.indexOf("?"), trimmed.indexOf("#"));
	return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

export function parseFiscalReceiptQr(raw: string): ParsedReceipt | null {
	const params = new URLSearchParams(extractQueryString(raw));
	const t = params.get("t");
	const s = params.get("s");
	const fn = params.get("fn");
	const fd = params.get("i");
	const fp = params.get("fp");
	const n = params.get("n");

	if (!t || !s || !fn || !fd || !fp) return null;

	const dateMatch = DATE_TIME_RE.exec(t);
	if (!dateMatch) return null;
	const [, year, month, day, hour, minute] = dateMatch;

	const amount = parseFloat(s.replace(",", "."));
	if (isNaN(amount) || amount <= 0) return null;

	return {
		amount,
		date: `${year}-${month}-${day}`,
		time: `${hour}:${minute}`,
		type: n === "2" ? "income" : "expense",
		fn,
		fd,
		fp
	};
}

export function receiptFingerprint(r: Pick<ParsedReceipt, "fn" | "fd" | "fp">): string {
	return `receipt:${r.fn}:${r.fd}:${r.fp}`;
}

export function receiptComment(r: Pick<ParsedReceipt, "date" | "time">): string {
	const [year, month, day] = r.date.split("-");
	return `Чек от ${day}.${month}.${year} ${r.time}`;
}
