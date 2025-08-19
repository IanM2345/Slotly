"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter, type Href } from "expo-router";
import { useSession } from "./SessionContext";
import type { BusinessTier } from "./SessionContext";

/** Absolute, typed paths generated from your file structure */
export const ONBOARDING_ROUTES = {
  step1: "/business/onboarding",
  step2: "/business/onboarding/plan",
  step3: "/business/onboarding/kyc",
  step4: "/business/onboarding/live-capture",
  step5: "/business/onboarding/payment-setup",
  step6: "/business/onboarding/review",
  step7: "/business/onboarding/pending",
} as const satisfies Record<string, Href>;
export type StepKey = keyof typeof ONBOARDING_ROUTES;

/** Lightweight shared data collected across steps */
export type OnboardingData = {
  // step 1
  businessName?: string;
  businessType?: string;
  email?: string;
  phone?: string;
  address?: string;

  // step 2
  selectedPlan?: { name: string; tier: string; price: string };
  tier?: BusinessTier;            

  // step 3 (examples)
  kraDocsUploaded?: boolean;
  ownerProvided?: boolean;
  industry?: string;

  // step 5 (examples)
  paymentMethod?: "mpesa" | "bank";
  mpesaTill?: string;

  // etc.
  adminUsers?: Array<{ name: string; email: string; role?: string }>;
};

type Ctx = {
  routes: typeof ONBOARDING_ROUTES;

  /** Shared form state across steps */
  data: OnboardingData;
  setData: (patch: Partial<OnboardingData>) => void;

  /** Path helpers (typed) */
  nextFrom: (from: StepKey) => Href;
  prevFrom: (from: StepKey) => Href;

  /** Imperative navigation helpers (typed) */
  goNext: (from: StepKey) => void;
  goPrev: (from: StepKey) => void;
};

const OnboardingContext = createContext<Ctx | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useSession();
  const tier = user?.business?.tier ?? 1;

  // shared data
  const [data, setDataState] = useState<OnboardingData>({});
  const setData = (patch: Partial<OnboardingData>) =>
    setDataState((prev) => ({ ...prev, ...patch }));

  const nextFrom = (from: StepKey): Href => {
    switch (from) {
      case "step1":
        return ONBOARDING_ROUTES.step2;
      case "step2":
        return tier >= 3 ? ONBOARDING_ROUTES.step3 : ONBOARDING_ROUTES.step4;
      case "step3":
        return ONBOARDING_ROUTES.step4;
      case "step4":
        return ONBOARDING_ROUTES.step5;
      case "step5":
        return ONBOARDING_ROUTES.step6;
      case "step6":
        return ONBOARDING_ROUTES.step7;
      case "step7":
        return ONBOARDING_ROUTES.step7; // terminal for now
    }
  };

  const prevFrom = (from: StepKey): Href => {
    switch (from) {
      case "step1":
        return ONBOARDING_ROUTES.step1;
      case "step2":
        return ONBOARDING_ROUTES.step1;
      case "step3":
        return ONBOARDING_ROUTES.step2;
      case "step4":
        return tier >= 3 ? ONBOARDING_ROUTES.step3 : ONBOARDING_ROUTES.step2;
      case "step5":
        return ONBOARDING_ROUTES.step4;
      case "step6":
        return ONBOARDING_ROUTES.step5;
      case "step7":
        return ONBOARDING_ROUTES.step6;
    }
  };

  const goNext = (from: StepKey) => router.push(nextFrom(from));
  const goPrev = (from: StepKey) => router.push(prevFrom(from));

  const value = useMemo<Ctx>(
    () => ({ routes: ONBOARDING_ROUTES, data, setData, nextFrom, prevFrom, goNext, goPrev }),
    [data, tier] // keep tier so back/next recomputes when plan changes
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
