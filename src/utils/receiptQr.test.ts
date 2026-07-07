import { describe, it, expect } from "vitest";
import { parseFiscalReceiptQr, receiptFingerprint } from "./receiptQr";

const VALID_QR = "t=20260707T1530&s=1234.56&fn=1234567890123456&i=123456&fp=1234567890&n=1";

describe("parseFiscalReceiptQr", () => {
	it("parses a valid receipt QR (n=1) as expense", () => {
		const result = parseFiscalReceiptQr(VALID_QR);
		expect(result).toEqual({
			amount: 1234.56,
			date: "2026-07-07",
			time: "15:30",
			type: "expense",
			fn: "1234567890123456",
			fd: "123456",
			fp: "1234567890"
		});
	});

	it("parses n=2 as income (return of purchase)", () => {
		const result = parseFiscalReceiptQr("t=20260707T1530&s=100&fn=1&i=2&fp=3&n=2");
		expect(result?.type).toBe("income");
	});

	it("defaults to expense when n is absent", () => {
		const result = parseFiscalReceiptQr("t=20260707T1530&s=100&fn=1&i=2&fp=3");
		expect(result?.type).toBe("expense");
	});

	it("defaults to expense for unrecognized n values", () => {
		const result = parseFiscalReceiptQr("t=20260707T1530&s=100&fn=1&i=2&fp=3&n=3");
		expect(result?.type).toBe("expense");
	});

	it("parses t with seconds (15 chars), ignoring seconds", () => {
		const result = parseFiscalReceiptQr("t=20260707T153045&s=100&fn=1&i=2&fp=3&n=1");
		expect(result?.date).toBe("2026-07-07");
		expect(result?.time).toBe("15:30");
	});

	it("accepts comma as decimal separator in sum", () => {
		const result = parseFiscalReceiptQr("t=20260707T1530&s=1234,56&fn=1&i=2&fp=3&n=1");
		expect(result?.amount).toBe(1234.56);
	});

	it("extracts the query string from a full URL (?)", () => {
		const result = parseFiscalReceiptQr(`https://consumer.1-ofd.ru/qr?${VALID_QR}`);
		expect(result?.amount).toBe(1234.56);
	});

	it("extracts the query string from a fragment URL (#)", () => {
		const result = parseFiscalReceiptQr(`https://consumer.1-ofd.ru/qr#${VALID_QR}`);
		expect(result?.amount).toBe(1234.56);
	});

	it("trims surrounding whitespace", () => {
		const result = parseFiscalReceiptQr(`  ${VALID_QR}  `);
		expect(result?.amount).toBe(1234.56);
	});

	it("returns null when t is missing", () => {
		const result = parseFiscalReceiptQr("s=100&fn=1&i=2&fp=3&n=1");
		expect(result).toBeNull();
	});

	it("returns null when s is missing", () => {
		const result = parseFiscalReceiptQr("t=20260707T1530&fn=1&i=2&fp=3&n=1");
		expect(result).toBeNull();
	});

	it("returns null when fn is missing", () => {
		const result = parseFiscalReceiptQr("t=20260707T1530&s=100&i=2&fp=3&n=1");
		expect(result).toBeNull();
	});

	it("returns null when i is missing", () => {
		const result = parseFiscalReceiptQr("t=20260707T1530&s=100&fn=1&fp=3&n=1");
		expect(result).toBeNull();
	});

	it("returns null when fp is missing", () => {
		const result = parseFiscalReceiptQr("t=20260707T1530&s=100&fn=1&i=2&n=1");
		expect(result).toBeNull();
	});

	it("returns null when t has an invalid format", () => {
		const result = parseFiscalReceiptQr("t=not-a-date&s=100&fn=1&i=2&fp=3&n=1");
		expect(result).toBeNull();
	});

	it("returns null when s is not numeric", () => {
		const result = parseFiscalReceiptQr("t=20260707T1530&s=abc&fn=1&i=2&fp=3&n=1");
		expect(result).toBeNull();
	});

	it("returns null when s is zero", () => {
		const result = parseFiscalReceiptQr("t=20260707T1530&s=0&fn=1&i=2&fp=3&n=1");
		expect(result).toBeNull();
	});

	it("returns null when s is negative", () => {
		const result = parseFiscalReceiptQr("t=20260707T1530&s=-5&fn=1&i=2&fp=3&n=1");
		expect(result).toBeNull();
	});

	it("returns null for an empty string", () => {
		expect(parseFiscalReceiptQr("")).toBeNull();
	});

	it("returns null for an unrelated QR payload", () => {
		expect(parseFiscalReceiptQr("https://example.com/some-page")).toBeNull();
	});
});

describe("receiptFingerprint", () => {
	it("builds a stable fingerprint from fn/fd/fp", () => {
		expect(receiptFingerprint({ fn: "111", fd: "222", fp: "333" })).toBe("receipt:111:222:333");
	});

	it("produces different fingerprints for different receipts", () => {
		const a = receiptFingerprint({ fn: "111", fd: "222", fp: "333" });
		const b = receiptFingerprint({ fn: "111", fd: "222", fp: "444" });
		expect(a).not.toBe(b);
	});
});
