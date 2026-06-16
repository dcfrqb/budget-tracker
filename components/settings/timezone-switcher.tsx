"use client";

import React, { useState } from "react";
import { useT } from "@/lib/i18n";
import { setTimezoneAction } from "@/app/(shell)/settings/actions";

const CURATED_OPTIONS = [
  "Europe/Moscow",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tbilisi",
  "Asia/Bangkok",
  "Asia/Tokyo",
  "Asia/Dubai",
  "America/New_York",
  "America/Los_Angeles",
];

function isValidIanaTz(v: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

interface TimezoneSwitcherProps {
  current: string;
}

export function TimezoneSwitcher({ current }: TimezoneSwitcherProps) {
  const t = useT();

  const isOther = !CURATED_OPTIONS.includes(current);
  const [selected, setSelected] = useState(isOther ? "other" : current);
  const [customValue, setCustomValue] = useState(isOther ? current : "");
  const [customError, setCustomError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const effectiveTz = selected === "other" ? customValue : selected;

  async function handleSelect(tz: string) {
    setSelected(tz);
    if (tz === "other") return;
    setIsPending(true);
    const fd = new FormData();
    fd.append("timezone", tz);
    await setTimezoneAction(fd);
    setIsPending(false);
  }

  async function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = customValue.trim();
    if (!isValidIanaTz(v)) {
      setCustomError(true);
      return;
    }
    setCustomError(false);
    setIsPending(true);
    const fd = new FormData();
    fd.append("timezone", v);
    await setTimezoneAction(fd);
    setIsPending(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="mono" style={{ color: "var(--muted)", fontSize: "var(--text-xs)", minWidth: 80 }}>
          {t("settings.timezone.label")}
        </span>
        <select
          className="field-input mono"
          style={{ fontSize: "var(--text-sm)", minWidth: 200 }}
          value={selected}
          disabled={isPending}
          onChange={(e) => handleSelect(e.target.value)}
        >
          {CURATED_OPTIONS.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
          <option value="other">{t("settings.timezone.option.other")}</option>
        </select>
      </div>

      {selected === "other" && (
        <form
          onSubmit={handleCustomSubmit}
          style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingLeft: 92 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <input
              type="text"
              className="field-input mono"
              style={{ fontSize: "var(--text-sm)", width: 220 }}
              placeholder="e.g. Pacific/Auckland"
              value={customValue}
              disabled={isPending}
              onChange={(e) => {
                setCustomValue(e.target.value);
                setCustomError(false);
              }}
            />
            {customError && (
              <span className="mono" style={{ color: "var(--neg)", fontSize: "var(--text-2xs)" }}>
                {t("settings.timezone.invalid")}
              </span>
            )}
          </div>
          <button
            type="submit"
            className="btn-sm"
            disabled={isPending || !customValue.trim() || !isValidIanaTz(customValue.trim())}
          >
            OK
          </button>
        </form>
      )}

      <div style={{ paddingLeft: 92 }}>
        <span className="mono" style={{ color: "var(--muted)", fontSize: "var(--text-2xs)" }}>
          {t("settings.timezone.help")}
        </span>
        {effectiveTz && effectiveTz !== "other" && (
          <span className="mono" style={{ color: "var(--muted)", fontSize: "var(--text-2xs)", marginLeft: 8 }}>
            {effectiveTz}
          </span>
        )}
      </div>
    </div>
  );
}
