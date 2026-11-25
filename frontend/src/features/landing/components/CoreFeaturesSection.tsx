"use client";

import { useState } from "react";
import { useI18n } from "@/i18n";
import { formatCurrency } from "@/i18n";

const SAMPLE_TRIP_TOTAL_VND = 5400000;
const SAMPLE_FOOD_VND = 2430000;
const SAMPLE_TICKETS_VND = 1620000;
const SAMPLE_TRANSIT_VND = 1350000;

function FeatureBullet({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="size-6 rounded-lg bg-blue-50 text-[#0194F3] flex items-center justify-center shrink-0 mt-0.5">
        <svg
          className="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <p className="text-sm text-slate-700 font-medium">{text}</p>
    </div>
  );
}

export function CoreFeaturesSection() {
  const { locale, t, messages } = useI18n();
  const f = messages.landing.features;

  const [routeState, setRouteState] = useState<"da-nang" | "phu-quoc">("da-nang");
  const [groupCount, setGroupCount] = useState<number>(2);
  const costPerPerson = Math.round(SAMPLE_TRIP_TOTAL_VND / groupCount);
  const [vote1, setVote1] = useState<boolean>(true);
  const [vote2, setVote2] = useState<boolean>(false);

  const stops =
    routeState === "da-nang"
      ? [
          {
            step: 1,
            badgeBg: "bg-[#0194F3]",
            title: f.route.daNangStop1Title,
            sub: f.route.daNangStop1Sub,
            legAfter: f.route.daNangLeg1,
          },
          {
            step: 2,
            badgeBg: "bg-blue-600",
            title: f.route.daNangStop2Title,
            sub: f.route.daNangStop2Sub,
            legAfter: f.route.daNangLeg2,
          },
          {
            step: 3,
            badgeBg: "bg-indigo-600",
            title: f.route.daNangStop3Title,
            sub: f.route.daNangStop3Sub,
            legAfter: null,
          },
        ]
      : [
          {
            step: 1,
            badgeBg: "bg-[#0194F3]",
            title: f.route.phuQuocStop1Title,
            sub: f.route.phuQuocStop1Sub,
            legAfter: f.route.phuQuocLeg1,
          },
          {
            step: 2,
            badgeBg: "bg-blue-600",
            title: f.route.phuQuocStop2Title,
            sub: f.route.phuQuocStop2Sub,
            legAfter: f.route.phuQuocLeg2,
          },
          {
            step: 3,
            badgeBg: "bg-indigo-600",
            title: f.route.phuQuocStop3Title,
            sub: f.route.phuQuocStop3Sub,
            legAfter: null,
          },
        ];

  return (
    <section
      id="timeline"
      className="relative py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#F0F7FF] via-[#F8FAFC] to-[#F1F5F9] border-y border-slate-200/80 overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none opacity-[0.035] bg-[radial-gradient(#0194F3_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="relative z-10 max-w-7xl mx-auto w-full space-y-16 sm:space-y-20">
        {/* Section Title & Intro */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-50 text-[#0194F3] border border-blue-200/80 text-xs font-bold uppercase tracking-wider">
            {f.sectionBadge}
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            {f.sectionTitleLine1}
            <br className="hidden sm:inline" /> {f.sectionTitleLine2}
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            {f.sectionSubtitle}
          </p>
        </div>

        {/* FEATURE BLOCK 1: ROUTE OPTIMIZATION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs font-bold tracking-widest uppercase text-[#0194F3]">
              {f.route.eyebrow}
            </span>
            <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {f.route.title}
            </h3>
            <p className="text-slate-600 text-base leading-relaxed">
              {f.route.description}
            </p>
            <div className="space-y-3.5 pt-2">
              <FeatureBullet text={f.route.bullet1} />
              <FeatureBullet text={f.route.bullet2} />
              <FeatureBullet text={f.route.bullet3} />
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    {f.route.cardEyebrow}
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">
                    {routeState === "da-nang"
                      ? f.route.daNangTitle
                      : f.route.phuQuocTitle}
                  </h4>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                  {routeState === "da-nang"
                    ? f.route.daNangSaved
                    : f.route.phuQuocSaved}
                </span>
              </div>

              <div className="space-y-3.5">
                {stops.map((stop) => (
                  <div key={stop.step} className="space-y-3.5">
                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span
                        className={`size-7 rounded-xl ${stop.badgeBg} text-white text-xs font-bold flex items-center justify-center shrink-0`}
                      >
                        {stop.step}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {stop.title}
                        </p>
                        <p className="text-xs text-slate-500">{stop.sub}</p>
                      </div>
                    </div>
                    {stop.legAfter && (
                      <div className="ml-4 pl-4 border-l-2 border-dashed border-slate-200 text-xs text-slate-500 py-1">
                        {stop.legAfter}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setRouteState((prev) =>
                    prev === "da-nang" ? "phu-quoc" : "da-nang"
                  )
                }
                className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg
                  className="size-4 text-[#0194F3]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>
                  {routeState === "da-nang"
                    ? f.route.switchToPhuQuoc
                    : f.route.switchToDaNang}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* FEATURE BLOCK 2: TRANSPARENT BUDGETING */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    {f.budget.cardEyebrow}
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">
                    {f.budget.cardTitle}
                  </h4>
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-50 text-[#0194F3] text-xs font-bold border border-blue-200">
                  {f.budget.accuracyBadge}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">
                    {f.budget.totalLabel}
                  </span>
                  <span className="text-base font-extrabold text-slate-900 tabular-nums">
                    {formatCurrency(SAMPLE_TRIP_TOTAL_VND, locale)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden flex">
                    <div
                      className="bg-[#0194F3] h-full"
                      style={{ width: "45%" }}
                      title={f.budget.foodTooltip}
                    />
                    <div
                      className="bg-amber-400 h-full"
                      style={{ width: "30%" }}
                      title={f.budget.ticketsTooltip}
                    />
                    <div
                      className="bg-indigo-500 h-full"
                      style={{ width: "25%" }}
                      title={f.budget.transitTooltip}
                    />
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600 pt-1 tabular-nums">
                    <span>
                      {f.budget.foodLabel}{" "}
                      <strong>{formatCurrency(SAMPLE_FOOD_VND, locale)}</strong>
                    </span>
                    <span>
                      {f.budget.ticketsLabel}{" "}
                      <strong>{formatCurrency(SAMPLE_TICKETS_VND, locale)}</strong>
                    </span>
                    <span>
                      {f.budget.transitLabel}{" "}
                      <strong>{formatCurrency(SAMPLE_TRANSIT_VND, locale)}</strong>
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">
                      {f.budget.splitLabel}
                    </span>
                    <div className="flex items-center gap-1.5 bg-white rounded-xl p-1 border border-slate-300 shadow-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setGroupCount((prev) => Math.max(1, prev - 1))
                        }
                        className="size-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-sm flex items-center justify-center cursor-pointer transition-colors"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm font-extrabold text-slate-900 tabular-nums">
                        {groupCount}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setGroupCount((prev) => Math.min(6, prev + 1))
                        }
                        className="size-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-sm flex items-center justify-center cursor-pointer transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      {f.budget.membersUnit}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 block">
                      {f.budget.perPersonLabel}
                    </span>
                    <span className="text-lg font-black text-slate-900 tabular-nums">
                      {formatCurrency(costPerPerson, locale)}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center">
                {f.budget.footnote}
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
            <span className="text-xs font-bold tracking-widest uppercase text-[#0194F3]">
              {f.budget.eyebrow}
            </span>
            <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {f.budget.title}
            </h3>
            <p className="text-slate-600 text-base leading-relaxed">
              {f.budget.description}
            </p>
            <div className="space-y-3.5 pt-2">
              <FeatureBullet text={f.budget.bullet1} />
              <FeatureBullet text={f.budget.bullet2} />
              <FeatureBullet text={f.budget.bullet3} />
            </div>
          </div>
        </div>

        {/* FEATURE BLOCK 3: REAL-TIME COLLABORATION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs font-bold tracking-widest uppercase text-[#0194F3]">
              {f.collab.eyebrow}
            </span>
            <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {f.collab.title}
            </h3>
            <p className="text-slate-600 text-base leading-relaxed">
              {f.collab.description}
            </p>
            <div className="space-y-3.5 pt-2">
              <FeatureBullet text={f.collab.bullet1} />
              <FeatureBullet text={f.collab.bullet2} />
              <FeatureBullet text={f.collab.bullet3} />
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    {f.collab.cardEyebrow}
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">
                    {f.collab.cardTitle}
                  </h4>
                </div>
                <div className="flex items-center -space-x-2">
                  <div className="size-8 rounded-full bg-[#0194F3] border-2 border-white text-xs font-bold text-white flex items-center justify-center shadow-xs">
                    MH
                  </div>
                  <div className="size-8 rounded-full bg-indigo-600 border-2 border-white text-xs font-bold text-white flex items-center justify-center shadow-xs">
                    LA
                  </div>
                  <div className="size-8 rounded-full bg-amber-500 border-2 border-white text-xs font-bold text-white flex items-center justify-center shadow-xs">
                    HN
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setVote1((prev) => !prev)}
                  className={`w-full p-4 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                    vote1
                      ? "bg-blue-50/70 border-2 border-[#0194F3]"
                      : "bg-slate-50 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        vote1
                          ? "bg-[#0194F3] text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {vote1 ? "✓" : "+"}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {f.collab.item1Title}
                      </p>
                      <p className="text-xs text-slate-500">{f.collab.item1Sub}</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                      vote1
                        ? "bg-white text-[#0194F3] border border-blue-200"
                        : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {t("landing.features.collab.votesLabel", {
                      count: vote1 ? 3 : 2,
                    })}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setVote2((prev) => !prev)}
                  className={`w-full p-4 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                    vote2
                      ? "bg-blue-50/70 border-2 border-[#0194F3]"
                      : "bg-slate-50 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        vote2
                          ? "bg-[#0194F3] text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {vote2 ? "✓" : "+"}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {f.collab.item2Title}
                      </p>
                      <p className="text-xs text-slate-500">{f.collab.item2Sub}</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                      vote2
                        ? "bg-white text-[#0194F3] border border-blue-200"
                        : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {t("landing.features.collab.votesLabel", {
                      count: vote2 ? 2 : 1,
                    })}
                  </span>
                </button>
              </div>

              <p className="text-xs text-slate-500 text-center font-medium">
                {f.collab.hint}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
