# Email-Forward Integration: Architecture

This document describes how the Tinkoff Email-Forward integration would work when fully implemented.

## Overview

Tinkoff sends push-style email notifications for every transaction (debit/credit). By forwarding these to a dedicated inbox and running an IMAP idle listener, we can parse them into `ImportRow` objects and upsert transactions automatically.

This is a **separate long-running process** — not part of the Next.js server. It runs alongside the app (e.g. as a Docker sidecar or systemd service).

---

## Architecture

```
Tinkoff servers
    ↓  (email notification)
Your email inbox  (e.g. Google Workspace, Yandex, self-hosted)
    ↓  (forwarding rule: forward all from @tinkoff.ru to listener-inbox@yourdomain)
IMAP Idle Listener
    ↓  (parses email body → ImportRow)
Budget Tracker DB  (upserts Transaction records via Prisma)
```

---

## IMAP Idle Listener

### Technology

- Node.js with `imapflow` (preferred) or `node-imap`.
- Connects to the forwarding inbox using IMAP IDLE.
- On `EXISTS` event (new message arrives), fetches the message and triggers parsing.

### Connection

```ts
const client = new ImapFlow({
  host: process.env.IMAP_HOST,
  port: 993,
  secure: true,
  auth: {
    user: process.env.IMAP_USER,
    pass: process.env.IMAP_PASS,
  },
});
await client.connect();
const lock = await client.getMailboxLock("INBOX");
// subscribe to new messages
client.on("exists", handleNewMessage);
```

---

## Tinkoff Email Format

Tinkoff sends HTML+plain-text emails. Subject examples:

- `Операция по карте *1234`
- `Зачисление на счёт`

The plain-text body contains a structured block:

```
Сумма: 1 500,00 ₽
Дата: 23.04.2026 14:35
Описание: Супермаркет Пятёрочка
Баланс после: 45 200,00 ₽
```

### Parser logic

1. Extract subject to determine direction (debit vs credit).
2. Parse plain-text body with regex:
   - `Сумма:\s*([\d\s,.]+)\s*([₽$€])` → amount + currency
   - `Дата:\s*(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})` → date
   - `Описание:\s*(.+)` → description (merchant name)
3. Build `ImportRow` and call the same deduplication + upsert pipeline used in CSV import.

---

## Task Queue

To avoid blocking the IMAP listener on slow DB writes, use a simple in-process queue:

```
[IMAP listener] → [parseEmail()] → [queue.push(ImportRow)] → [worker: upsertTransaction()]
```

A lightweight queue like `p-queue` (concurrency=1) is sufficient.

---

## Configuration

Environment variables for the listener process (separate from the Next.js app `.env`):

```env
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=listener@yourdomain.com
IMAP_PASS=your-app-password
DATABASE_URL=postgresql://bdg:bdg@localhost:5433/budget_tracker?schema=public
DEFAULT_ACCOUNT_ID=  # account to attach imported transactions to
```

---

## Current Status

**Stub only.** The `tinkoff-email` adapter in `lib/integrations/adapters/tinkoff-email.ts`:
- Stores the forwarding email address in encrypted credentials.
- Returns `status=ERROR` on `fetchTransactions` with a message pointing here.

The IMAP listener process is not implemented. To implement:
1. Create a separate `services/email-listener/` directory with the listener process.
2. Implement the email parser for Tinkoff notification format.
3. Wire it to call the same `syncCredential` pipeline or write directly to the DB.
4. Deploy as a Docker sidecar or systemd service.

---

## ToS Note

Using email notifications is generally low-risk from a ToS perspective (you own your email inbox). However, forwarding bank emails to a third-party server introduces data-in-transit risk. Use with TLS-only IMAP and encrypted storage.
