import Link from "next/link";

export function AddAccountCta() {
  return (
    <div className="section fade-in" style={{ animationDelay: "380ms" }}>
      <div className="add-cta">
        <div className="l">
          <div className="ico mono">+</div>
          <div>
            <div className="t">Добавить новый счёт</div>
            <div className="s">банк · крипто · наличка · ручной ввод</div>
          </div>
        </div>
        <div className="r">
          <Link href="/wallet/accounts/new?kind=CARD" className="btn">Банк</Link>
          <Link href="/wallet/accounts/new?kind=CRYPTO" className="btn">Крипто</Link>
          <Link href="/wallet/accounts/new?kind=CASH" className="btn">Наличка</Link>
          <Link href="/wallet/accounts/new" className="btn primary">Ручной ввод</Link>
        </div>
      </div>
    </div>
  );
}
