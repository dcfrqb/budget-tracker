// ─────────────────────────────────────────────────────────────
// One-liner quick-input lexicon
// All matching is case-insensitive; keys must be lower-cased.
// Category keys match names from prisma/seed-demo.ts CATEGORY_IDS.
// ─────────────────────────────────────────────────────────────

/**
 * Trigger words that signal the transaction is INCOME.
 * Checked against individual tokens (split by whitespace/punctuation).
 */
export const INCOME_TRIGGERS: Set<string> = new Set([
  // RU
  "зарплата", "зп", "аванс", "премия", "фриланс", "кэшбэк", "подарок",
  "возврат", "поступление", "доход", "получил", "получила",
  // EN
  "salary", "freelance", "bonus", "cashback", "gift", "refund", "payout",
  "income", "received",
]);

/**
 * Maps canonical category name → list of trigger substrings (lower-cased).
 * Canonical names match seed-demo.ts exactly.
 */
export const CATEGORY_LEXICON: Record<string, string[]> = {
  // EXPENSE categories (from seed-demo.ts)
  "Продукты": [
    "продукты", "продуктов", "магазин", "супермаркет", "пятёрочка", "пятерочка",
    "перекрёсток", "перекресток", "лента", "ашан", "вкусвилл", "groceries",
    "supermarket", "grocery",
  ],
  "Кафе и рестораны": [
    "кафе", "ресторан", "обед", "ужин", "кофе", "завтрак", "пицца", "бургер",
    "суши", "доставка", "яндекс еда", "яндекс.еда", "delivery", "cafe",
    "restaurant", "coffee", "lunch", "dinner", "breakfast",
  ],
  "Транспорт": [
    "такси", "метро", "автобус", "трамвай", "маршрутка", "транспорт", "uber",
    "яндекс такси", "каршеринг", "проездной", "taxi", "metro", "transport",
    "bus", "carsharing",
  ],
  "Здоровье": [
    "аптека", "врач", "лекарства", "медицина", "здоровье", "стоматолог",
    "клиника", "анализы", "pharmacy", "doctor", "medicine", "health", "clinic",
  ],
  "Одежда": [
    "одежда", "обувь", "платье", "куртка", "джинсы", "рубашка", "кроссовки",
    "clothes", "clothing", "shoes", "jacket", "dress",
  ],
  "Развлечения": [
    "кино", "театр", "концерт", "игра", "развлечения", "netflix", "нетфликс",
    "спортзал", "gym", "cinema", "movie", "entertainment", "games", "sport",
  ],
  "Дом": [
    "мебель", "ремонт", "икея", "ikea", "дом", "хозтовары", "cleaning", "home",
    "furniture", "repair",
  ],
  "Авто": [
    "авто", "заправка", "бензин", "страховка", "шины", "осаго", "автосервис",
    "мойка", "парковка", "car", "gas", "fuel", "parking", "insurance",
  ],
  "ЖКХ": [
    "жкх", "коммунальные", "электричество", "вода", "газ", "отопление",
    "квартплата", "utilities", "electricity", "water", "heating",
  ],
  "Интернет и связь": [
    "интернет", "мобильный", "телефон", "связь", "симка", "тариф",
    "internet", "mobile", "phone", "telecom",
  ],
  "Образование": [
    "курс", "обучение", "образование", "учёба", "урок", "репетитор",
    "education", "course", "learning", "study", "lesson",
  ],
  "Поездки": [
    "поездка", "отпуск", "билет", "самолёт", "отель", "гостиница", "путешествие",
    "trip", "travel", "hotel", "flight", "vacation",
  ],
  "Электроника": [
    "электроника", "телефон", "ноутбук", "гаджет", "apple", "samsung",
    "electronics", "laptop", "gadget", "computer",
  ],
  "Займы и кредиты": [
    "кредит", "займ", "ипотека", "платёж", "loan", "credit", "mortgage",
  ],
  "Подписки": [
    "подписка", "subscription", "spotify", "youtube", "яндекс плюс",
    "subscription", "subs",
  ],
  "Налоги": [
    "налог", "ифнс", "фнс", "налоги", "tax", "taxes", "ндс", "ндфл",
  ],
  // INCOME categories
  "Работа": [
    "зарплата", "зп", "salary", "работа", "аванс",
  ],
  "Фриланс": [
    "фриланс", "freelance", "заказ", "проект", "project",
  ],
  "Кэшбэк": [
    "кэшбэк", "cashback", "бонус", "бонусы",
  ],
  "Прочий доход": [
    "подарок", "gift", "dividend", "дивиденды", "пенсия", "pension",
  ],
};

/**
 * Maps currency marker → ISO currency code.
 * Keys are lower-cased.
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  "₽": "RUB",
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  // Note: single-char "р" intentionally omitted — text.includes("р") would corrupt
  // any Russian word containing that letter (e.g. "зарплата" → "за плата").
  // "500р" (no space) falls back to accountCurrency (RUB) via the default path.
  "руб": "RUB",
  "rub": "RUB",
  "usd": "USD",
  "eur": "EUR",
  "gbp": "GBP",
  "¥": "CNY",
  "cny": "CNY",
};

// ─────────────────────────────────────────────────────────────
// Date parsing patterns
// ─────────────────────────────────────────────────────────────

/** Matches ISO date YYYY-MM-DD */
export const RE_ISO_DATE = /\b(\d{4}-\d{2}-\d{2})\b/;

/** Matches DD.MM (with optional year) */
export const RE_DDMM = /\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\b/;

/** Matches "N числа", "N-го", "Nth" */
export const RE_DAY_OF_MONTH = /\b(\d{1,2})(?:-?(?:го|th|st|nd|rd|числа))\b/i;

/** Russian weekday triggers */
export const RU_WEEKDAYS: Record<string, number> = {
  "понедельник": 1, "пн": 1,
  "вторник": 2, "вт": 2,
  "среда": 3, "среду": 3, "ср": 3,
  "четверг": 4, "чт": 4,
  "пятница": 5, "пятницу": 5, "пт": 5,
  "суббота": 6, "субботу": 6, "сб": 6,
  "воскресенье": 0, "вс": 0,
};

/** English weekday triggers */
export const EN_WEEKDAYS: Record<string, number> = {
  "monday": 1, "mon": 1,
  "tuesday": 2, "tue": 2,
  "wednesday": 3, "wed": 3,
  "thursday": 4, "thu": 4,
  "friday": 5, "fri": 5,
  "saturday": 6, "sat": 6,
  "sunday": 0, "sun": 0,
};

/** RU/EN "today" triggers */
export const TODAY_TRIGGERS = new Set([
  "сегодня", "today",
]);

/** RU/EN "yesterday" triggers */
export const YESTERDAY_TRIGGERS = new Set([
  "вчера", "yesterday",
]);

/** RU-only "day before yesterday" */
export const DAY_BEFORE_YESTERDAY_TRIGGERS = new Set([
  "позавчера",
]);

/** Prepositions to strip before weekdays */
export const WEEKDAY_PREPOSITIONS = new Set([
  "в", "во", "on", "last",
]);
