# Budget Tracker — Design System v2 (Terminal Quant)

> **Status:** актуальный source of truth для UI-разработки.
> **Предыдущая версия:** `DESIGN_SYSTEM.md` — оставлена для справки, **не применять**.
> **Визуальный референс:** `design-explorations/04-terminal-quant/rail/index-grid.html` (живой прототип) + `design-explorations/04-terminal-quant/rail/README.md` (исходный дизайнерский документ).

---

## 0. Что это и зачем v2

Визуальное направление проекта сменилось с editorial/бизнес-банковского (v1) на **Terminal Quant** — биржевой инженерный dashboard. Ключевые характеристики нового языка:

- **Dark-first.** Light-тема сознательно отложена до после MVP.
- **Плотность > воздух.** Ближе к Bloomberg/Grafana/Linear, чем к Mint/YNAB.
- **Моноширинные числа везде.** JetBrains Mono с `tabular-nums`, выравнивание по правому краю.
- **Движение — функциональное.** Ничего декоративного, всё ≤ 400ms, ease-out.
- **English-only UI.** Русский контент только пользовательский (названия категорий, сумм, описаний) — системные лейблы английские.
- **Keyboard-first.** Хоткеи I/E/T уже в прототипе; развитие — в CLAUDE.md → «Планы на будущее».

---

## 1. Принципы

1. **Данные — герой.** Цифры крупнее всего остального. Декоративные элементы минимальны или отсутствуют.
2. **Ритм плотный.** Панели примыкают через 1px hairline, не «плавают» на фоне. Тени не использовать.
3. **Цвет — сигнал.** Цветные бейджи (LOAN/SUB/UTIL/TAX) и цвет режима (Lean/Normal/Relaxed) — несут смысл, не косметика.
4. **Motion подтверждает, не украшает.** Каждая анимация отвечает на действие пользователя или сигнализирует «живость данных» (heartbeat). Анимации ради анимаций нет.
5. **Reduced-motion уважается всегда.** `@media (prefers-reduced-motion: reduce)` обнуляет всё.

---

## 2. Цветовые токены

Скопировать в CSS как есть. **Всё через переменные — никакого хардкода.**

```css
:root {
  /* surfaces */
  --bg:        #0D1117;   /* страница */
  --panel:     #11171F;   /* секция feed */
  --panel-2:   #161D27;   /* плитка внутри секции */
  --panel-3:   #1A2230;   /* hover-state плитки */

  /* lines */
  --border:    #232B38;   /* основной бордер 1px */
  --grid:      #1B2230;   /* тонкие линии внутри панели */
  --hairline:  #2A3344;   /* акцентный бордер */

  /* text */
  --text:      #E6EDF3;   /* основной */
  --muted:     #7D8898;   /* вторичный */
  --dim:       #4E5766;   /* третичный, меты, ранги */

  /* accents */
  --accent:    #58D3A3;   /* primary (мятно-зелёный), также Lean mode */
  --pos:       #3FB950;   /* positive delta, Normal mode */
  --neg:       #F85149;   /* negative delta, LOAN tag */
  --info:      #79C0FF;   /* Relaxed mode, SUB tag */
  --warn:      #D29922;   /* UTIL tag, forecast */

  /* semantic aliases (то же, но с именем по роли) */
  --loan: var(--neg);
  --sub:  var(--info);
  --util: var(--warn);
  --tax:  var(--accent);
}
```

### Режимы бюджета — цветовое кодирование

| Режим | Токен | Смысл |
|---|---|---|
| `Lean` (Эконом) | `--accent` (мятный) | жёсткие лимиты, альтернативный сигнал |
| `Normal` (Нормальный) | `--pos` (зелёный) | дефолт, всё в норме |
| `Relaxed` (Свободный) | `--info` (синий) | «ты на свободе», лимиты мягкие |

Цвет режима должен подсвечивать: (а) активную кнопку в segmented control, (б) dot-индикатор в session-state widget, (в) можно использовать как акцент rail-индикатора при переключении.

### Light-тема

**Не реализуем сейчас.** Когда появится — токены будут другие, но структура CSS-переменных та же. Весь код должен уметь переключаться через `data-theme` атрибут без рефакторинга.

---

## 2.1 Number color semantics (как красить числа)

**Принцип двух слоёв.** Цвет числа всегда выбирается из одного из двух независимых слоёв — никогда не смешиваем. Если красный одновременно «расход» и «потеря» — сигнал ломается, и пользователь перестаёт верить любому красному. Industry-консенсус (Bloomberg, SAP Fiori, Atlassian, accessibility-литература) одинаков: **valence ≠ category**.

### Слой A — Valence (направление, оценочно)

Применяется к: дельтам (▲/▼), результатам (net), статусам, error-сообщениям, прогрессу против лимита.

| Токен | Когда |
|---|---|
| `--pos` (зелёный) | положительная дельта, done, returned, накопление выросло, **net > 0**, успех |
| `--neg` (красный) | отрицательная дельта, missed, overdue, debt-я-должен, перерасход, **net < 0**, error |
| `--warn` (оранжевый) | partial, near-deadline, риск-сигнал, утилиты-категория (UTIL) |
| `--text` (белый) | net = 0, нейтральные числа без оценки |

### Слой B — Category (тип сущности)

Применяется к: иконкам и лейблам типа транзакции, KPI-ярлыкам, code-тегам, кнопкам быстрых действий.

| Токен | Категория | Почему |
|---|---|---|
| `--pos` (зелёный) | **Income** (доход) | приток денег — событие положительное по определению, valence и category совпадают |
| `--info` (синий) | **Expense** (расход) | расход — нейтральное движение наружу, **не «плохо»**. Красный резервируем под перерасход / missed / debt. |
| `--warn` (оранжевый) | **Transfer** (перевод) | движение между своими счетами, нейтральное промежуточное состояние |
| `--neg` (красный) | **Loan / debt-обязательство** | категория, которая *по определению* отрицательная (ты должен) — valence и category согласованы |
| `--info` (синий) | **Subscription** (SUB) | recurring-категория, не оценочная |
| `--warn` (оранжевый) | **Utility** (UTIL) | recurring-категория с дедлайн-семантикой |
| `--accent` (мятный) | **Tax** (TAX), **brand**, **aggregate без знака** | primary-акцент: бренд, Lean mode, активная вкладка, «всего сохранено» как сумма без valence |
| `--muted` / `--dim` | планируемые / отменённые / меты | quiet-сигналы |

### Правила применения

1. **Дефолт для числа — `--text`.** Не уверен — оставь белым. Цвет добавляется только если он несёт сигнал.
2. **Нельзя совмещать слой A и слой B на одном числе через один и тот же hue.** Если расход = синий (категория), то красный остаётся **только** для valence (потеря/просрочка/overdraft). Это даёт настоящему красному силу.
3. **Net — всегда динамический по valence.** `net > 0 → --pos`, `net < 0 → --neg`, `net == 0 → --text`. Захардкоженный `--accent` для net запрещён.
4. **Дельта — всегда по valence.** ▲ → `--pos`, ▼ → `--neg`. Стрелка обязательна — цвет не должен быть единственным сигналом (8% мужчин не различают red/green).
5. **Категория «расход» — `--info` (синий) во всех контекстах:** в plan-fact, в period-table, в txn-feed, в quick-actions, в KPI. Никаких «здесь синий, а на кнопке красный».
6. **`--accent` (мятный) — НЕ для оценочных чисел.** Только: бренд, активная вкладка, Lean mode, totals-без-знака («всего сохранено», «всего источников»). Если у числа есть знак или сравнение — это `--pos`/`--neg`/`--text`.
7. **LOAN-тег и кнопка `+Expense` — разные сущности.** LOAN остаётся красным (это категория-обязательство, valence согласован). `+Expense` — синий, как сама категория «расход».
8. **Цвет не несёт смысл в одиночку.** Везде, где цвет передаёт valence, должен быть второй сигнал: знак (+/−), стрелка (▲/▼), иконка, текстовый лейбл (`MISSED`, `DONE`).
9. **Контекст-инверсия дельты в cost-секциях.** В разделах, где сама метрика — расход (top-categories, expenses-breakdown, аналитика по категориям трат), valence стрелки инвертирована: **▲ = `--neg`** (траты выросли — плохо), **▼ = `--pos`** (траты упали — хорошо). Это сознательное исключение из Rule 4 — не баг. Стрелка + знак процента остаются обязательным вторым сигналом (Rule 8), так что cognitive read однозначен.
10. **TAX — двойной токен.** Алиас `--tax` (= `--accent`) применяется **только к категориальному тегу/бейджу TAX** (по аналогии с LOAN/SUB/UTIL). *Сумма налога к уплате* — это число с deadline-семантикой, и красится в **`--warn`** (если есть «когда платить») или `--text` (нейтральный остаток). Так у нас не возникает «accent-числа» в feed, и `--accent` остаётся под бренд / Lean / aggregate-без-знака.

### Совместимость со слоем «режимы бюджета»

Цвета режимов (Lean=`--accent`, Normal=`--pos`, Relaxed=`--info`) — отдельный микро-слой и применяются только к индикатору режима (segmented control, dot, rail-flash). Они **не каскадируют** на числа в feed: расход в Normal-режиме всё равно `--info`, не `--pos`.

---

## 3. Типографика

### Шрифты

```css
--ui:   'Inter', system-ui, -apple-system, sans-serif;
--mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
```

Подключать через Google Fonts или self-host. Веса: Inter 400/500/600/700, JetBrains Mono 400/500/600/700.

### Шкала

| Роль | Шрифт | Размер / LH | Вес | Letter-spacing | Пример |
|---|---|---|---|---|---|
| Hero-число (Safe until) | Mono | 34px / 1.0 | 700 | - | `47` |
| KPI (plan-fact) | Mono | 20px / 1.15 | 700 | 0.01em | `₽ 188 400` |
| Num-med (Available) | Mono | 22px / 1.15 | 700 | - | `₽ 237 880` |
| Num-sm (balance row) | Mono | 14px / 1.2 | 600 | - | `284 120 ₽` |
| UI body | Inter | 13px / 1.4 | 500 | - | `Mortgage · Sber` |
| Section label | Inter | 11px / 1.2 | 600 | 0.1em uppercase | `plan-fact` |
| Code-tag | Mono | 10px / 1.2 | 700 | 0.08em | `LOAN`, `SUB`, `UTIL` |
| Meta / sub | Mono | 10–11px / 1.2 | 400 muted | - | `as-of 21.04 12:40` |

**Правила:**
- Любое число использует Mono + `font-variant-numeric: tabular-nums`.
- Числа всегда выровнены по правому краю в колоночном контексте (балансы, категории, KPI).
- Секционные лейблы — Inter (не Mono) в uppercase с трекингом.
- Code-теги (LOAN/SUB/UTIL) — Mono 10px uppercase с трекингом.

**Исключение — nav-rail labels:** collapsed-режим (3-буквенный код) и expanded-режим (`label-full`, полное название) оба используют JetBrains Mono для визуальной целостности рельсы. Это сознательное отклонение от правила «UI-текст = Inter».

---

## 4. Сетка, отступы, шкала

### База 4px. Всё кратно.

```
xs = 4
sm = 8
md = 12
lg = 16
xl = 24
```

### Layout главной

```
┌──────┬──────────────────────────┬──────────┐
│ rail │        feed              │ summary  │
│ 60px │        1fr               │  300px   │
└──────┴──────────────────────────┴──────────┘
```

- **Rail:** 60px ширина. nav-item высотой 56px (14×4).
- **Feed:** занимает `1fr`. Секции разделены 1px hairline (`--border`), не margin'ами.
- **Summary:** 300px. Sticky (position: sticky; top: 0). Числа выровнены по правому краю, валютные символы в фиксированной колонке 48px слева.

### Отступы внутри

- Секция feed: `16px 20px`.
- Section-header: `11px 20px`.
- Плитка `pf-cell`, `ob-card`: `14–16px`.
- Между плитками и секциями: 1px hairline (`--border`).

**Horizontal alignment** в balance-rail:
```
[48px символ валюты] [1fr пусто] [число right-aligned]
```

---

## 5. Границы и радиусы

- **Border-radius:** 2px для кодовых тегов (LOAN/SUB), 3px для kbd-шорткатов, 4px для карточек обязательств и кнопок. **Никаких больших радиусов** — это терминал, не sass-app.
- **Border:** 1px solid `--border` для секций; 1px solid цвет-по-типу для hover-состояния карточек обязательств.
- **Тени:** не использовать. Глубина через слои `--bg` → `--panel` → `--panel-2` → `--panel-3`.

---

## 6. Компоненты и состояния

Каждый компонент описан через состояния. Реализация должна поддерживать все указанные.

### 6.1 Rail nav-item (вертикальная навигация)

8 вкладок в фиксированном порядке (из CLAUDE.md): `HOME / TXN / INC / EXP / PLN / ANL / WAL / FAM`.

| Состояние | Визуал |
|---|---|
| idle | text `--muted`, icon `--muted` |
| hover | text→`--text`, icon→`--accent` с text-shadow glow, tooltip-подпись выезжает справа (120ms) |
| active | text→`--accent`, background `--panel-2`, вертикальная полоска 2px слева (плавно переезжает при смене активного пункта — 240ms top + color) |
| focus-visible | outline 1px `--accent`, offset 2px |

### 6.2 Segmented control (mode / period)

Mode: `Lean / Normal / Relaxed`. Period: `7d / 30d / 90d / 1y`.

| Состояние | Визуал |
|---|---|
| idle button | text `--muted` |
| on | текст `--bg` (тёмный) на цветной «таблетке»; цвет таблетки = цвет выбранного режима (см. раздел 2) |
| hover | text→`--text` |
| click → switch | таблетка slide 240ms ease-out (transform + width + background-color); параллельно 180ms border-flash на `safe-block` в summary — подтверждение что режим сменился глобально |

### 6.3 Obligation card (LOAN / SUB / UTIL)

Код-тег в левом верхнем углу окрашен по типу. **Без встроенного sparkline** (вынесены в Аналитику).

| Состояние | Визуал |
|---|---|
| idle | `--panel-2`, прозрачный border, курсор pointer |
| hover | `--panel-3`, translateY(-1px) за 120ms, border 1px = цвет типа карточки |
| click | (prototype no-op; в реальном UI — drill-down inline expand) |

### 6.4 Quick-action button (Income / Expense / Transaction)

Inline SVG иконки (stroke 1.5, currentColor, 15px). Знак `+` перед текстом.

| Состояние | Визуал |
|---|---|
| idle | `--panel-2`, `+` цвета `--accent` |
| hover | фон → `--bg`, `+` получает glow (text-shadow) |
| click | ripple `--accent` @ 14% → прозрачный (240ms inset wash) |
| keyboard | `I` / `E` / `T` триггерят click (hint рядом видно visually) |

Иконки (по направлению):
- **+Income** — стрелка вниз-в-коробку (inflow)
- **+Expense** — стрелка вверх-из-коробки (outflow)
- **+Transaction** — двусторонние горизонтальные стрелки (swap)

### 6.5 Safe-until block (summary)

- Hero-число count-up при загрузке (800ms ease-out-cubic, локаль `en-US` → `237,880`).
- Pulse-border при смене mode (180ms flash цветом нового режима).
- **Без sparkline** — убран в пользу Аналитики.

### 6.6 Available now (summary)

Показывает `₽ 237 880` крупно + `total 312 480 · rsv 74 600` мелко.
`total − reserved = available`. Reserved = суммы, зарезервированные под обязательства ближайших 30d.

### 6.7 Balances row (summary)

Мультивалютный баланс. **Все валюты одного размера**, одинакового веса — нет «главной» валюты. Формат:

```
[RUB]  284,120 ₽
[USD]    2,145 $
[EUR]      890 €
[CASH]  18,400 ₽
```

`CASH` — отдельная строка наравне с валютами (концептуально это тип счёта, но визуально уравнен).

### 6.8 Status pill

Heartbeat-pulse dot слева от лейбла `STABLE` (или другого статуса). Loop 2s ease-in-out, opacity + scale. Никогда не останавливается — сигнал «приложение живое, данные свежие».

### 6.9 Top-categories (2-column grid — финальный выбор)

6 категорий в сетке 3×2. В ячейке:

```
┌─────┬──────────────────┬─────────┐
│ 01  │ Groceries        │ ₽32,140 │
│     │                  │ ▲ 18.3% │
└─────┴──────────────────┴─────────┘
```

- Rank (01-06) — `--dim`, моно 12px.
- Name — Inter 13px 500.
- Amount — Mono 14px 700, выровнен вправо.
- Delta — моно 11px 700 с ▲/▼ и цветом (pos/neg).
- `sub` строка (детали транзакций) — **скрыта** в 2-колоночном варианте.

### 6.10 Signals block (soft hints)

Три типа подсказок, каждая с левой акцентной полосой 2px:

- `hint · tax` — `--accent` (самозанятость 6% от дохода за период — **только подсказка**, не автодействие)
- `signal · category drift` — `--warn` (категория превысила тренд)
- `hint · 50/30/20` — `--info` (рекомендация по распределению последнего дохода)

Все подсказки — НЕ автоматические, только визуальная нотификация.

---

## 7. Motion-каталог

**Принципы:** всё функциональное, всё ≤ 400ms, ease-out кривые, никогда bounce/back-ease.

### Easing tokens

```css
--e-out:        cubic-bezier(.2,.7,.2,1);
--e-out-cubic:  cubic-bezier(.33,1,.68,1);
--d-fast:  120ms;
--d-med:   240ms;
--d-slow:  400ms;
```

### Каталог

| # | Что | Триггер | Параметры | Почему |
|---|---|---|---|---|
| 1 | Heartbeat-dot | всегда (loop) | 2000ms ease-in-out, opacity + scale | «приложение живое» |
| 2 | Count-up чисел | page load | 800ms `--e-out-cubic` | цифры собираются, не прыгают |
| 3 | Staggered fade-in секций | page load | 400ms each, delay 0/60/120/180/240/300 | «inside-out» появление |
| 4 | Progress-bar scaleX | page load | 900ms `--e-out-cubic`, transform-origin left | «заполнение» плана |
| 5 | Segmented marker slide | click mode/period | 240ms `--e-out-cubic`, transform + width + bg | таблетка перетекает |
| 6 | Mode accent flash | mode switch | 180ms border flash на safe-block | подтверждение смены |
| 7 | Nav indicator glide | click rail-item | 240ms top + color | вертикальная полоска переезжает |
| 8 | Rail hover glow | hover nav-item | 120ms color + text-shadow | тонкое свечение |
| 9 | Rail tooltip slide-in | hover nav-item | 120ms opacity + translateX(-4→0) | подпись выезжает |
| 10 | Obligation hover lift | hover card | 120ms translateY(-1px) + border | микро-сигнал кликабельности |
| 11 | Quick-action ripple | click button | 240ms inset background wash | подтверждение клика |
| 12 | Cashflow sparkline tick | interval 4s | мгновенная перерисовка SVG path | имитация live-данных (только cashflow) |
| 13 | Clock / sync age | interval 1s | instant | свежесть данных |

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Дополнительно в JS: не запускать `setInterval` для tick-sparkline, count-up мгновенно показывает финальное значение.

---

## 8. Сетка главной — референс-разметка

Основные секции feed сверху вниз:

1. **Status strip** — breadcrumbs (`BDG:// home / overview / date`) + status pill + курсы валют + sync age.
2. **Mode row** — segmented `Lean/Normal/Relaxed` + period `7d/30d/90d/1y` + ticker info.
3. **Quick-actions** — три кнопки `+Income / +Expense / +Transaction`.
4. **Plan-fact** — три плитки: `INCOME` / `EXPENSE` / `NET` с KPI и progress bars.
5. **Obligations · next 30d** — 3 карточки LOAN / SUB / UTIL.
6. **Top-categories** — 6 категорий в 2 колонки.
7. **Signals** — 3 soft-подсказки.

Summary-rail справа:
1. Safe until (hero-число + дата + delta vs prev week)
2. Available now (total − reserved)
3. Balances (4 строки, все одинакового размера)
4. Session state (clock, sync, mode dot)
5. Cashflow 30d sparkline (**единственный оставшийся live sparkline**)

Rail слева — 8 nav-items.

---

## 9. Что НЕ делаем (и почему)

- **Light-тема** — отложена до после MVP.
- **Mobile-раскладка** — отложена до после MVP. Текущая раскладка = desktop (≥ 1280px).
- **Sparklines в карточках LOAN/SUB/UTIL** — убраны, перенесены в Аналитику. В карточках только цифры.
- **SAFE UNTIL sparkline** — убран. Hero-число + delta дают достаточно контекста.
- **Декоративные иллюстрации / эмодзи / маскот** — нет.
- **Glassmorphism, градиенты на фонах, скевоморфные тени** — нет.
- **Тени для глубины** — нет (используем слои `--panel` → `--panel-2` → `--panel-3`).
- **Большие border-radius** (> 6px) — нет.
- **Sans-serif для чисел** — нет, всё Mono.

---

## 10. Реализация (для инженеров)

### Фреймворк
Next.js (см. `AGENTS.md` — «This is NOT the Next.js you know»). Перед написанием UI-кода читать соответствующий гайд в `node_modules/next/dist/docs/`.

### Где живёт стилевой слой
- CSS-переменные — в глобальном стиле, подключаются в root layout.
- Компоненты — по принципу «один компонент = одна папка», стили рядом. Точная конвенция CSS (CSS Modules, Tailwind, vanilla) — решается при реализации, но **значения всегда через токены**, не хардкод.

### Порядок работы
1. Сначала токены (раздел 2) и шрифты (раздел 3) в root layout.
2. Потом Primitive-компоненты (Button, SegmentedControl, Pill, CodeTag).
3. Потом сложные блоки (ObligationCard, BalanceRow, SafeBlock).
4. В последнюю очередь — motion (можно реализовать на CSS transitions + Framer Motion для сложного; reduced-motion mандатно).

### Прототип как визуальный референс
Открывать `design-explorations/04-terminal-quant/rail/index-grid.html` рядом при реализации каждого компонента — все конкретные пиксели, цвета в контексте, motion-тайминги видны вживую.

---

## 11. Changelog

- **v2.0 (2026-04-21)** — переход с editorial-банковского языка (v1) на Terminal Quant. Dark-first, моноширинные числа, плотность dashboard'а, EN-only UI. 2-column grid для top-categories. Sparklines только для cashflow. Light-тема отложена.
