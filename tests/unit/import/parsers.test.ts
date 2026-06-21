import { describe, it, expect } from "vitest";
import { parseTinkoff } from "@/lib/import/parsers/tinkoff";
import { parseGeneric } from "@/lib/import/parsers/generic";

// ─────────────────────────────────────────────────────────────
// Tinkoff parser tests
// ─────────────────────────────────────────────────────────────

const TINKOFF_HEADER =
  "Дата операции;Статус;Сумма операции;Валюта операции;Категория;Описание;Номер карты";

function makeTinkoffCsv(rows: string[]): string {
  return [TINKOFF_HEADER, ...rows].join("\n");
}

describe("parseTinkoff", () => {
  it("parses a basic EXPENSE row", () => {
    const csv = makeTinkoffCsv([
      "15.06.2024 12:30:00;OK;-1500,00;RUB;Супермаркеты;Пятёрочка;*1234",
    ]);
    const { rows, warnings } = parseTinkoff(csv);
    expect(warnings).toHaveLength(0);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.kind).toBe("EXPENSE");
    expect(row.direction).toBe("out");
    expect(row.amount).toBe("1500.00");
    expect(row.currencyCode).toBe("RUB");
    expect(row.rawCategory).toBe("Супермаркеты");
    expect(row.description).toBe("Пятёрочка");
    expect(row.cardLast4).toBe("1234");
  });

  it("parses a basic INCOME row", () => {
    const csv = makeTinkoffCsv([
      "15.06.2024 09:00:00;OK;50000,00;RUB;Пополнение;Зарплата;*5678",
    ]);
    const { rows } = parseTinkoff(csv);
    expect(rows).toHaveLength(1);
    // Category "Пополнение" is a transfer category
    expect(rows[0].kind).toBe("TRANSFER");
    expect(rows[0].direction).toBe("in");
    expect(rows[0].amount).toBe("50000.00");
  });

  it("classifies Переводы category as TRANSFER", () => {
    const csv = makeTinkoffCsv([
      "15.06.2024 10:00:00;OK;-5000,00;RUB;Переводы;Перевод в банк;*1234",
    ]);
    const { rows } = parseTinkoff(csv);
    expect(rows[0].kind).toBe("TRANSFER");
  });

  it("skips FAILED rows and adds warning", () => {
    const csv = makeTinkoffCsv([
      "15.06.2024 12:00:00;FAILED;-100,00;RUB;Супермаркеты;Test;*1234",
      "15.06.2024 13:00:00;OK;-200,00;RUB;Рестораны;Кафе;*1234",
    ]);
    const { rows, warnings } = parseTinkoff(csv);
    expect(rows).toHaveLength(1);
    expect(warnings.some((w) => w.includes("status_failed"))).toBe(true);
    expect(rows[0].amount).toBe("200.00");
  });

  it("skips CANCELLED rows and adds warning", () => {
    const csv = makeTinkoffCsv([
      "15.06.2024 12:00:00;CANCELLED;-100,00;RUB;Такси;Яндекс;*1234",
    ]);
    const { rows, warnings } = parseTinkoff(csv);
    expect(rows).toHaveLength(0);
    expect(warnings.some((w) => w.includes("status_cancelled"))).toBe(true);
  });

  it("skips rows with invalid date and adds warning", () => {
    const csv = makeTinkoffCsv([
      "bad-date;OK;-100,00;RUB;Такси;Яндекс;*1234",
    ]);
    const { rows, warnings } = parseTinkoff(csv);
    expect(rows).toHaveLength(0);
    expect(warnings.some((w) => w.includes("invalid_date"))).toBe(true);
  });

  it("skips rows with invalid amount and adds warning", () => {
    const csv = makeTinkoffCsv([
      "15.06.2024 12:00:00;OK;не-сумма;RUB;Такси;Яндекс;*1234",
    ]);
    const { rows, warnings } = parseTinkoff(csv);
    expect(rows).toHaveLength(0);
    expect(warnings.some((w) => w.includes("invalid_amount"))).toBe(true);
  });

  it("extracts cardLast4 from masked card number with asterisk prefix", () => {
    const csv = makeTinkoffCsv([
      "15.06.2024 12:00:00;OK;-100,00;RUB;Рестораны;Test;*123456781234",
    ]);
    const { rows } = parseTinkoff(csv);
    expect(rows[0].cardLast4).toBe("1234");
  });

  it("handles absent card column (empty) gracefully", () => {
    const csv = makeTinkoffCsv([
      "15.06.2024 12:00:00;OK;-100,00;RUB;Рестораны;Test;",
    ]);
    const { rows } = parseTinkoff(csv);
    expect(rows[0].cardLast4).toBeUndefined();
  });

  it("parses Russian comma decimal format (1 234,56)", () => {
    // Tinkoff uses comma-as-decimal in their CSV exports
    const csv = makeTinkoffCsv([
      "15.06.2024 12:00:00;OK;-1 234,56;RUB;Рестораны;Test;*1234",
    ]);
    const { rows } = parseTinkoff(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe("1234.56");
  });

  it("parses short date format (dd.MM.yyyy) without time", () => {
    const csv = makeTinkoffCsv([
      "15.06.2024;OK;-100,00;RUB;Рестораны;Test;*1234",
    ]);
    const { rows } = parseTinkoff(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].occurredAt).toContain("2024-06-15");
  });

  it("generates externalId including cardLast4 to avoid collisions", () => {
    const csv = makeTinkoffCsv([
      "15.06.2024 12:00:00;OK;-100,00;RUB;Рестораны;Same desc;*1111",
      "15.06.2024 12:00:00;OK;-100,00;RUB;Рестораны;Same desc;*2222",
    ]);
    const { rows } = parseTinkoff(csv);
    expect(rows).toHaveLength(2);
    // Different cards → different externalIds
    expect(rows[0].externalId).not.toBe(rows[1].externalId);
  });

  it("normalizes RUR currency to RUB", () => {
    const csv = makeTinkoffCsv([
      "15.06.2024 12:00:00;OK;-100,00;RUR;Рестораны;Test;*1234",
    ]);
    const { rows } = parseTinkoff(csv);
    expect(rows[0].currencyCode).toBe("RUB");
  });

  it("handles comma delimiter option", () => {
    const csv = [
      "Дата операции,Статус,Сумма операции,Валюта операции,Категория,Описание,Номер карты",
      "15.06.2024 12:00:00,OK,-100.00,RUB,Рестораны,Test,*1234",
    ].join("\n");
    const { rows } = parseTinkoff(csv, { delimiter: "," });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe("100.00");
  });
});

// ─────────────────────────────────────────────────────────────
// Generic parser tests
// ─────────────────────────────────────────────────────────────

describe("parseGeneric", () => {
  it("parses a basic CSV with date/amount/currency mapping", () => {
    const csv = "Date,Amount,Currency,Description\n2024-06-15,100.00,USD,Salary";
    const { rows, warnings } = parseGeneric(csv, {
      mapping: { date: "Date", amount: "Amount", currency: "Currency", description: "Description" },
    });
    expect(warnings).toHaveLength(0);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.kind).toBe("INCOME");
    expect(row.direction).toBe("in");
    expect(row.amount).toBe("100.00");
    expect(row.currencyCode).toBe("USD");
    expect(row.description).toBe("Salary");
  });

  it("maps negative amount to EXPENSE", () => {
    const csv = "Date,Amount\n2024-06-15,-250.00";
    const { rows } = parseGeneric(csv, {
      mapping: { date: "Date", amount: "Amount" },
    });
    expect(rows[0].kind).toBe("EXPENSE");
    expect(rows[0].direction).toBe("out");
    expect(rows[0].amount).toBe("250.00");
  });

  it("parses Russian comma decimal (1 234,56) correctly", () => {
    const csv = "Дата;Сумма\n15.06.2024;-1 234,56";
    const { rows } = parseGeneric(csv, {
      mapping: { date: "Дата", amount: "Сумма", delimiter: ";" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe("1234.56");
  });

  it("defaults currency to RUB when no currency mapping provided", () => {
    const csv = "Date,Amount\n2024-06-15,100.00";
    const { rows } = parseGeneric(csv, {
      mapping: { date: "Date", amount: "Amount" },
    });
    expect(rows[0].currencyCode).toBe("RUB");
  });

  it("skips rows with invalid date and adds warning", () => {
    const csv = "Date,Amount\nnot-a-date,100.00";
    const { rows, warnings } = parseGeneric(csv, {
      mapping: { date: "Date", amount: "Amount" },
    });
    expect(rows).toHaveLength(0);
    expect(warnings.some((w) => w.includes("invalid_date"))).toBe(true);
  });

  it("skips rows with invalid amount and adds warning", () => {
    const csv = "Date,Amount\n2024-06-15,not-an-amount";
    const { rows, warnings } = parseGeneric(csv, {
      mapping: { date: "Date", amount: "Amount" },
    });
    expect(rows).toHaveLength(0);
    expect(warnings.some((w) => w.includes("invalid_amount"))).toBe(true);
  });

  it("uses semicolon delimiter when specified in mapping", () => {
    const csv = "Дата;Сумма;Валюта\n15.06.2024;-500,00;EUR";
    const { rows } = parseGeneric(csv, {
      mapping: { date: "Дата", amount: "Сумма", currency: "Валюта", delimiter: ";" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].currencyCode).toBe("EUR");
    expect(rows[0].amount).toBe("500.00");
  });

  it("classifies transfer category as TRANSFER kind", () => {
    const csv = "Date,Amount,Category\n2024-06-15,-100.00,Переводы";
    const { rows } = parseGeneric(csv, {
      mapping: { date: "Date", amount: "Amount", category: "Category" },
    });
    expect(rows[0].kind).toBe("TRANSFER");
  });

  it("parses dd.MM.yyyy date format", () => {
    const csv = "Date,Amount\n15.06.2024,-100.00";
    const { rows } = parseGeneric(csv, {
      mapping: { date: "Date", amount: "Amount" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].occurredAt).toContain("2024-06-15");
  });

  it("parses ISO date format 2024-01-15", () => {
    const csv = "Date,Amount\n2024-01-15,-100.00";
    const { rows } = parseGeneric(csv, {
      mapping: { date: "Date", amount: "Amount" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].occurredAt).toContain("2024-01-15");
  });

  it("sets raw field containing original row data", () => {
    const csv = "Date,Amount\n2024-06-15,100.00";
    const { rows } = parseGeneric(csv, {
      mapping: { date: "Date", amount: "Amount" },
    });
    expect(rows[0].raw).toBeDefined();
    expect(typeof rows[0].raw).toBe("object");
  });

  it("handles multiple rows correctly", () => {
    const csv = "Date,Amount\n2024-06-01,100.00\n2024-06-02,-200.00\n2024-06-03,50.00";
    const { rows } = parseGeneric(csv, {
      mapping: { date: "Date", amount: "Amount" },
    });
    expect(rows).toHaveLength(3);
    expect(rows[0].kind).toBe("INCOME");
    expect(rows[1].kind).toBe("EXPENSE");
    expect(rows[2].kind).toBe("INCOME");
  });
});
