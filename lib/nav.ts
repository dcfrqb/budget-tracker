export type NavTab = {
  id: string;
  href: string;
  icon: string;   // unicode glyph used in rail
  code: string;   // 3-letter code under icon
  label: string;  // tooltip / full name
};

export const NAV_TABS: NavTab[] = [
  { id: "home", href: "/",            icon: "⌂", code: "ГЛВ", label: "Главная" },
  { id: "txn",  href: "/transactions", icon: "↕", code: "ТРН", label: "Транзакции" },
  { id: "inc",  href: "/income",       icon: "↑", code: "ДХД", label: "Доходы" },
  { id: "exp",  href: "/expenses",     icon: "↓", code: "РСХ", label: "Расходы" },
  { id: "plan", href: "/planning",     icon: "◈", code: "ПЛН", label: "Планирование" },
  { id: "anl",  href: "/analytics",    icon: "∿", code: "АНЛ", label: "Аналитика" },
  { id: "wal",  href: "/wallet",       icon: "◎", code: "КШЛ", label: "Кошелёк" },
  { id: "fam",  href: "/family",       icon: "◉", code: "СЕМ", label: "Семья" },
];

export const NAV_ITEM_HEIGHT = 56;
export const NAV_TOP_PADDING = 6;

/** Отдельная «нижняя» вкладка — настройки. Не входит в основной NAV_TABS,
 *  пинится к низу рельсы и отделена тонким разделителем. */
export const SETTINGS_TAB: Omit<NavTab, "icon" | "code"> = {
  id: "settings",
  href: "/settings",
  label: "Настройки",
};
