"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

export function AddAccountCta() {
  const t = useT();
  return (
    <div className="section fade-in" style={{ animationDelay: "380ms" }}>
      <div className="add-cta">
        <Link href="/wallet/accounts/new" className="l" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="ico mono">+</div>
          <div>
            <div className="t">{t("wallet.add_account.title")}</div>
            <div className="s">{t("wallet.add_account.sub")}</div>
          </div>
        </Link>
        <div className="r">
          <Link href="/wallet/accounts/new?kind=CARD" className="btn">{t("wallet.add_account.btn_bank")}</Link>
          <Link href="/wallet/accounts/new?kind=CRYPTO" className="btn">{t("wallet.add_account.btn_crypto")}</Link>
          <Link href="/wallet/accounts/new" className="btn primary">{t("wallet.add_account.btn_manual")}</Link>
        </div>
      </div>
    </div>
  );
}
