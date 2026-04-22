import { AddAccountCta } from "@/components/wallet/add-cta";
import { Archive } from "@/components/wallet/archive";
import { CashStashSection } from "@/components/wallet/cash-stash";
import { FxRates } from "@/components/wallet/fx-rates";
import { Institutions } from "@/components/wallet/institutions";
import { WalletStatusStrip } from "@/components/wallet/status-strip";
import { WalletTotals } from "@/components/wallet/totals";

export default function WalletPage() {
  return (
    <>
      <WalletStatusStrip />
      <WalletTotals />
      <FxRates />
      <Institutions />
      <CashStashSection />
      <AddAccountCta />
      <Archive />
    </>
  );
}
