export const DEFAULT_USER_ID = "usr_default_single";
export const DEFAULT_USER_EMAIL = "dcfrqb@gmail.com";
export const DEFAULT_USER_NAME = "Владимир";

export const DEFAULT_CURRENCY = "RUB";

export const SUPPORTED_CURRENCIES = [
  { code: "RUB", name: "Российский рубль", symbol: "₽", decimals: 2 },
  { code: "USD", name: "Доллар США", symbol: "$", decimals: 2 },
  { code: "EUR", name: "Евро", symbol: "€", decimals: 2 },
  { code: "GEL", name: "Грузинский лари", symbol: "₾", decimals: 2 },
  { code: "USDT", name: "Tether", symbol: "₮", decimals: 2 },
  { code: "BTC", name: "Bitcoin", symbol: "₿", decimals: 8 },
] as const;
