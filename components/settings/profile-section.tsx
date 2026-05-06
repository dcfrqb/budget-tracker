"use client";

import { useT } from "@/lib/i18n";
import { useState, useTransition, useRef, useCallback } from "react";
import { updateProfileAction } from "@/app/(shell)/settings/actions";
import type { Gender } from "@prisma/client";

type Props = {
  name: string | null;
  gender: Gender;
};

const GENDER_VALUES: Gender[] = ["MALE", "FEMALE", "UNSPECIFIED"];

export function ProfileSection({ name, gender }: Props) {
  const t = useT();
  const [nameVal, setNameVal] = useState(name ?? "");
  const [genderVal, setGenderVal] = useState<Gender>(gender);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function genderLabel(g: Gender): string {
    if (g === "MALE") return t("settings.profile.gender_male");
    if (g === "FEMALE") return t("settings.profile.gender_female");
    return t("settings.profile.gender_unspecified");
  }

  const persist = useCallback((n: string, g: Gender) => {
    setSaved(false);
    setError(null);
    const fd = new FormData();
    fd.set("name", n);
    fd.set("gender", g);
    startTransition(async () => {
      const result = await updateProfileAction(fd);
      if (result?.error) {
        setError(t("settings.profile.error_save"));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }, [t]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setNameVal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(val, genderVal), 400);
  }

  function handleGenderChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value as Gender;
    setGenderVal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    persist(nameVal, val);
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title mono">
        {t("settings.profile.section_title")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="settings-field-row">
          <label className="settings-field-label mono" htmlFor="profile-name">
            {t("settings.profile.field_name")}
          </label>
          <input
            id="profile-name"
            type="text"
            className="settings-input mono"
            value={nameVal}
            onChange={handleNameChange}
            placeholder={t("settings.profile.placeholder_name")}
            maxLength={120}
            disabled={isPending}
          />
        </div>

        <div className="settings-field-row">
          <label className="settings-field-label mono" htmlFor="profile-gender">
            {t("settings.profile.field_gender")}
          </label>
          <select
            id="profile-gender"
            className="settings-select mono"
            value={genderVal}
            onChange={handleGenderChange}
            disabled={isPending}
          >
            {GENDER_VALUES.map((g) => (
              <option key={g} value={g}>
                {genderLabel(g)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 20 }}>
          {saved && (
            <span className="mono" style={{ fontSize: 11, color: "var(--pos)" }}>
              {t("settings.profile.saved")}
            </span>
          )}
          {error && (
            <span className="mono" style={{ fontSize: 11, color: "var(--neg)" }}>
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
