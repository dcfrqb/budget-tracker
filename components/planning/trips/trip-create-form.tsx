"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Prisma } from "@prisma/client";
import { createTripAction } from "@/app/(shell)/planning/trips/_actions";

type Fund = { id: string; name: string; currencyCode: string };

type Props = {
  currencies: string[];
  funds: Fund[];
  labels: {
    title: string;
    name_label: string;
    destination_label: string;
    start_label: string;
    end_label: string;
    currency_label: string;
    budget_label: string;
    fund_section_title: string;
    fund_none: string;
    fund_existing: string;
    fund_required_monthly: string;
    submit: string;
    cancel: string;
    validation: {
      dates_inverted: string;
      budget_positive: string;
    };
  };
};

type FundOption = "none" | "existing";

export function TripCreateForm({ currencies, funds, labels }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currencyCode, setCurrencyCode] = useState(currencies[0] ?? "RUB");
  const [totalBudget, setTotalBudget] = useState("");
  const [fundOption, setFundOption] = useState<FundOption>("none");
  const [selectedFundId, setSelectedFundId] = useState(funds[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const requiredMonthly = (() => {
    if (!startDate || !totalBudget) return null;
    const goal = parseFloat(totalBudget);
    if (isNaN(goal) || goal <= 0) return null;
    const now = new Date();
    const start = new Date(startDate);
    const monthsLeft = Math.max(
      1,
      (start.getFullYear() - now.getFullYear()) * 12 +
        (start.getMonth() - now.getMonth()),
    );
    return Math.ceil(goal / monthsLeft);
  })();

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      errs.endDate = labels.validation.dates_inverted;
    }
    if (totalBudget && parseFloat(totalBudget) <= 0) {
      errs.totalBudget = labels.validation.budget_positive;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;

    const fundId =
      fundOption === "existing" ? selectedFundId || null :
      null;

    startTransition(async () => {
      const result = await createTripAction({
        name: name.trim(),
        destination: destination.trim() || undefined,
        startDate,
        endDate,
        currencyCode,
        totalBudget,
        fundId,
      });
      if (result.ok) {
        router.push(`/planning/trips/${result.data.id}`);
      } else {
        setErrors({ _: "error" });
      }
    });
  }

  return (
    <div className="section trip-create-form fade-in">
      <div className="section-hd">
        <span className="ttl mono">{labels.title}</span>
      </div>

      <div className="form-grid">
        <div className="form-row">
          <label className="dim">{labels.name_label}</label>
          <input
            className="form-input mono"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label className="dim">{labels.destination_label}</label>
          <input
            className="form-input mono"
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label className="dim">{labels.start_label}</label>
          <input
            className="form-input mono"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          {errors.startDate && <span className="form-error neg">{errors.startDate}</span>}
        </div>
        <div className="form-row">
          <label className="dim">{labels.end_label}</label>
          <input
            className="form-input mono"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
          {errors.endDate && <span className="form-error neg">{errors.endDate}</span>}
        </div>
        <div className="form-row">
          <label className="dim">{labels.currency_label}</label>
          <select
            className="form-select mono"
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label className="dim">{labels.budget_label}</label>
          <input
            className="form-input mono"
            type="number"
            value={totalBudget}
            onChange={(e) => setTotalBudget(e.target.value)}
            min="0"
            step="1"
            required
          />
          {errors.totalBudget && <span className="form-error neg">{errors.totalBudget}</span>}
        </div>
      </div>

      <div className="trip-fund-section">
        <div className="section-hd">
          <span className="dim mono">{labels.fund_section_title}</span>
        </div>
        <div className="trip-fund-radio">
          {(["none", "existing"] as const).map((opt) => (
            <label key={opt} className="trip-fund-option">
              <input
                type="radio"
                name="fundOption"
                value={opt}
                checked={fundOption === opt}
                onChange={() => setFundOption(opt)}
              />
              <span className="dim mono">
                {opt === "none" ? labels.fund_none : labels.fund_existing}
              </span>
            </label>
          ))}
        </div>
        {fundOption === "existing" && funds.length > 0 && (
          <select
            className="form-select mono"
            value={selectedFundId}
            onChange={(e) => setSelectedFundId(e.target.value)}
          >
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.currencyCode}
              </option>
            ))}
          </select>
        )}
        {requiredMonthly !== null && fundOption === "existing" && (
          <div className="trip-fund-monthly dim mono">
            {labels.fund_required_monthly}: {requiredMonthly} {currencyCode}
          </div>
        )}
      </div>

      {errors._ && <div className="form-error neg">{errors._}</div>}

      <div className="form-actions">
        <button
          className="btn-secondary dim"
          onClick={() => router.back()}
          disabled={isPending}
        >
          {labels.cancel}
        </button>
        <button
          className="btn-primary acc"
          onClick={handleSubmit}
          disabled={isPending || !name.trim() || !startDate || !endDate || !totalBudget}
        >
          {labels.submit}
        </button>
      </div>
    </div>
  );
}
