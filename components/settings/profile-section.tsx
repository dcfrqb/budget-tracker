"use client";

import { useT } from "@/lib/i18n";
import { useState, useTransition } from "react";
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

  function genderLabel(g: Gender): string {
    if (g === "MALE") return t("settings.profile.gender_male");
    if (g === "FEMALE") return t("settings.profile.gender_female");
    return t("settings.profile.gender_unspecified");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    const fd = new FormData();
    fd.set("name", nameVal);
    fd.set("gender", genderVal);
    startTransition(async () => {
      const result = await updateProfileAction(fd);
      if (result?.error) {
        setError(t("settings.profile.error_save"));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title mono">
        {t("settings.profile.section_title")}
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="settings-field-row">
          <label className="settings-field-label mono" htmlFor="profile-name">
            {t("settings.profile.field_name")}
          </label>
          <input
            id="profile-name"
            type="text"
            className="settings-input mono"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            placeholder={t("settings.profile.placeholder_name")}
            maxLength={120}
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
            onChange={(e) => setGenderVal(e.target.value as Gender)}
          >
            {GENDER_VALUES.map((g) => (
              <option key={g} value={g}>
                {genderLabel(g)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="submit" className="btn primary" disabled={isPending}>
            {t("settings.profile.save")}
          </button>
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
      </form>
    </div>
  );
}
