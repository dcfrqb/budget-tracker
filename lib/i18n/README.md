# i18n layer

Zero external dependencies. `ru` is source of truth; `en` mirrors it.

## Persistence

Locale persists in cookie `bdg:locale` (path=/, sameSite=lax, maxAge=1 year). Default is `ru`.
Server components read the cookie via `getLocale()` and render the page in the correct locale immediately.
Client components receive the locale from `<LocaleClientProvider locale={locale}>` in the root layout.

Cookie is **not** httpOnly so client-side JS can read it if needed, but the primary mechanism is
server-side: the locale is resolved once per request in the root layout and passed down via context.

## Changing the locale

Use the server action `setLocaleAction` (from `app/settings/actions.ts`):
- Writes the new value to the `bdg:locale` cookie.
- Calls `revalidatePath("/", "layout")` so all server components re-render with the new locale.

The `LocaleSwitcher` component in `components/settings/locale-switcher.tsx` uses
`<form>` with `action={setLocaleAction}` — submitting the form triggers the action,
updates the cookie, and causes a full layout revalidation.

## How to add a key

1. Add the key in `locales/ru.ts` under the appropriate scope (max 4 levels deep).
2. Add the **same key** in `locales/en.ts`. TypeScript will error if you forget — `enDict` is typed as `typeof ruDict`.
3. Use in a **server component**: `const t = await getT(); t("scope.key")`.
4. Use in a **client component**: `const t = useT(); t("scope.key")`.
5. Use interpolation: `t("foo.bar", { vars: { name: "Ivan" } })` where the string contains `{name}`.

## Server vs client API

| Context | Import | Usage |
|---|---|---|
| Server component / server action | `import { getLocale, getT } from "@/lib/i18n"` | `const locale = await getLocale(); const t = await getT(locale);` |
| Client component | `import { useT, useLocale } from "@/lib/i18n"` | `const t = useT();` — reads locale from `<LocaleClientProvider>` in layout |
| Root layout | `import { LocaleClientProvider, getLocale } from "@/lib/i18n"` | `const locale = await getLocale(); <LocaleClientProvider locale={locale}>` |

## Key format

`<scope>.<section>.<name>` — snake_case or camelCase, consistent within scope.
Max depth: 4 levels. Examples:
- `settings.locale.label`
- `expenses.subscriptions.group.personal.title`

## What goes through t()

All user-visible text in `app/**` and `components/**`. No hardcoded RU/EN strings in JSX/TSX outside `locales/`.

## What does NOT go through t()

- Numbers, money, dates → `lib/format/*`
- Mock data strings in `lib/mock-*.ts` (considered data, not UI)

## Source of truth

See `CLAUDE.md` section "i18n (ОБЯЗАТЕЛЬНО)" for hard rules.
