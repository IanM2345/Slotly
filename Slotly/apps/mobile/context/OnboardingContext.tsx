"use client";

import { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter, type Href } from "expo-router";
import { useSession } from "./SessionContext";
import type { BusinessTier } from "./SessionContext";
import { createBusiness, createBusinessVerification } from "../lib/api/modules/business";
import { createSubscription } from "../lib/api/modules/subscription";
import { getMe } from "../lib/api/modules/users";

// ----------------------------
// Routes & small types
// ----------------------------

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

// ---- Feature flag: disable subscription/payment during onboarding
const PAYMENTS_ENABLED = (process.env.EXPO_PUBLIC_PAYMENTS_ENABLED ?? "true") !== "false";

// response shapes coming back from your JSON endpoints
type CreateBusinessRes = { ok?: boolean; error?: string; business?: { id: string } };
type SimpleOkRes = { ok?: boolean; error?: string };

// ----------------------------
// Domain types
// ----------------------------

export type AttachmentType =
  | "SELFIE"
  | "ID_FRONT"
  | "ID_BACK"
  | "KRA_PIN"
  | "REG_CERT"
  | "BUSINESS_LICENSE"
  | "BANK_LETTER"
  | "TILL_SCREENSHOT";

export type Attachment = {
  type: AttachmentType;
  url: string;
  step: 3 | 4 | 5; // where it was captured
  uploadedAt: number;
  meta?: Record<string, any>;
};

export type BillingData = {
  planTier: string; // "LEVEL_1" | "LEVEL_2" | "LEVEL_3"
  currency: string; // "KES"
  totalDue: number; // 0 for free trial, >0 for paid
  discountReason?: string; // "PROMO_TRIAL" | etc
};

type Sections = {
  kra?: { docs?: Attachment[]; done?: boolean };
  owner?: { selfieUrl?: string; idFrontUrl?: string; idBackUrl?: string; done?: boolean };
  industry?: { category?: string; description?: string; done?: boolean };
  payment?: { method?: "mpesa" | "bank"; docs?: Attachment[]; done?: boolean };
  admin?: { invites?: string[]; done?: boolean };
};

export type OnboardingData = {
  // Step 1
  businessName?: string;
  businessType?: string;
  email?: string;
  phone?: string;
  address?: string;
  description?: string;
  latitude?: number;
  longitude?: number;

  // Step 2
  selectedPlan?: { name: string; tier: string; price: string };
  tier?: BusinessTier;

  // Step 3
  businessVerificationType?: "FORMAL" | "INFORMAL";
  needsKyc?: boolean;
  kraPin?: string;
  regNumber?: string;
  licenseUrl?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  idNumber?: string;
  industry?: string;
  industryDescription?: string;
  adminUsers?: Array<{ name: string; email: string; role?: string }>;

  // Step 4
  idPhotoUrl?: string;
  selfieWithIdUrl?: string;

  // Step 5
  paymentMethod?: "mpesa" | "bank";
  payoutType?: "MPESA_PHONE" | "MPESA_TILL" | "MPESA_PAYBILL" | "BANK";
  mpesaPhoneNumber?: string;
  tillNumber?: string;
  paybillNumber?: string;
  accountRef?: string;
  bankName?: string;
  bankAccount?: string;
  accountName?: string;
   payoutToken?: string;
  payoutDisplay?: string;

  // Promo
  billing?:  {
   planTier: string;      // "LEVEL1" | "LEVEL2" | ...
   currency: string;      // e.g. "KES"
    totalDue: number;      // amount due after discounts
    discountReason?: string;
  };

  // Attachments & sections
  attachments?: Attachment[];
  sections?: Sections;

  // Legacy validation flags
  kycSections?: {
    kra?: boolean;
    owner?: boolean;
    industry?: boolean;
    payment?: boolean;
    admin?: boolean;
  };
   promoCode?: string;
  promoApplied?: boolean;
  trialEndsOn?: string;
  summaryTotals?: {
   currency: string;      // e.g. "KES"
    subtotal: number;      // plan base price
   discount: number;      // discount applied
   total: number;         // subtotal - discount (>= 0)
 };
};

type Ctx = {
  routes: typeof ONBOARDING_ROUTES;
  data: OnboardingData;
  setData: (patch: Partial<OnboardingData>) => void;
  addAttachment: (att: Attachment) => void;
  completeSection: (key: keyof Sections, patch?: Partial<Sections[keyof Sections]>) => void;
  updateKycSection: (section: keyof NonNullable<OnboardingData["kycSections"]>, completed: boolean) => void;
  isKycComplete: () => boolean;
  isLiveCaptureComplete: () => boolean;
  firstRequiredStep: () => Href;
  canProceedToReview: () => boolean;
  nextFrom: (from: StepKey) => Href;
  prevFrom: (from: StepKey) => Href;
  goNext: (from: StepKey) => void;
  goPrev: (from: StepKey) => void;
  submitOnboarding: () => Promise<{ success: boolean; error?: string; businessId?: string }>;
  clearData: () => void;
  getStepProgress: () => number;
  isStepComplete: (step: StepKey) => boolean;
};

const OnboardingContext = createContext<Ctx | undefined>(undefined);

// ----------------------------
// Helpers
// ----------------------------

function normalizePlan(input?: string) {
  const s = String(input || "LEVEL_1").toUpperCase().replace(/\s+/g, "");
  if (s === "LEVEL1") return "LEVEL_1";
  if (s === "LEVEL2") return "LEVEL_2";
  if (s === "LEVEL3") return "LEVEL_3";
  return s;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, token, updateBusiness } = useSession();

  // Add refs to prevent infinite loops
  const hasCheckedInitialStatus = useRef(false);
  const isNavigatingRef = useRef(false);

  // initial state
  const initialData: OnboardingData = {
    kycSections: { kra: false, owner: false, industry: false, payment: false, admin: false },
    promoCode: "",
    promoApplied: false,
    trialEndsOn: undefined,
    attachments: [],
    sections: {},
    billing: undefined,
  };

  const [data, setDataState] = useState<OnboardingData>(initialData);

  const setData = useCallback((patch: Partial<OnboardingData>) => {
    setDataState((prev) => ({
      ...prev,
      ...patch,
      kycSections: patch.kycSections ? { ...prev.kycSections, ...patch.kycSections } : prev.kycSections,
      sections: patch.sections ? { ...prev.sections, ...patch.sections } : prev.sections,
      billing: patch.billing ? { ...prev.billing, ...patch.billing } : prev.billing,
    }));
  }, []);

  const clearData = useCallback(() => setDataState(initialData), []);

  // FIXED: Add entry guard for onboarding step 1 - prevent infinite loop
  useEffect(() => {
    // Only run this check once when the component mounts
    if (hasCheckedInitialStatus.current || !token || isNavigatingRef.current) {
      return;
    }

    let mounted = true;
    
    const checkInitialStatus = async () => {
      try {
        hasCheckedInitialStatus.current = true;
        const me = await getMe(token);
        
        if (!mounted || !me || isNavigatingRef.current) return;

        const status = me?.business?.verificationStatus?.toLowerCase?.() || null;

        if (me.business) {
          if (["approved", "active", "verified"].includes(status)) {
            isNavigatingRef.current = true;
            router.replace("/business/dashboard");
            return;
          }
          // has business but not approved yet
          isNavigatingRef.current = true;
          router.replace("/business/onboarding/pending");
        }
      } catch (error) {
        console.log("Initial status check failed:", error);
        // ignore; user can proceed to fill the form
      }
    };

    checkInitialStatus();
    
    return () => { 
      mounted = false; 
    };
  }, [token]); // Only depend on token, not router

  const isStepComplete = useCallback(
    (step: StepKey): boolean => {
      switch (step) {
        case "step1":
          return !!(data.businessName && data.businessType && data.email && data.phone);
        case "step2":
          return !!data.selectedPlan;
        case "step3":
          return !!(data.businessVerificationType && data.idNumber);
        case "step4":
          return !!data.idPhotoUrl && (data.businessVerificationType === "INFORMAL" || !!data.selfieWithIdUrl);
        case "step5":
          return !!(data.paymentMethod || data.payoutType);
        case "step6":
          return canProceedToReview();
        case "step7":
          return false;
        default:
          return false;
      }
    },
    [data]
  );

  const getStepProgress = useCallback((): number => {
    const steps: StepKey[] = ["step1", "step2", "step3", "step4", "step5", "step6"];
    const completedSteps = steps.filter((s) => isStepComplete(s)).length;
    return Math.round((completedSteps / steps.length) * 100);
  }, [isStepComplete]);

  const addAttachment = useCallback((att: Attachment) => {
    setDataState((prev) => {
      const filtered = (prev.attachments || []).filter((a) => a.type !== att.type);
      const nextAttachments = [...filtered, att];

      const sections: Sections = { ...(prev.sections || {}) };

      switch (att.type) {
        case "SELFIE":
          sections.owner = { ...(sections.owner || {}), selfieUrl: att.url };
          break;
        case "ID_FRONT":
          sections.owner = { ...(sections.owner || {}), idFrontUrl: att.url };
          break;
        case "ID_BACK":
          sections.owner = { ...(sections.owner || {}), idBackUrl: att.url };
          break;
        case "KRA_PIN":
        case "REG_CERT":
        case "BUSINESS_LICENSE":
          sections.kra = {
            ...(sections.kra || {}),
            docs: [...(sections.kra?.docs || []).filter((d) => d.type !== att.type), att],
          };
          break;
        case "BANK_LETTER":
        case "TILL_SCREENSHOT":
          sections.payment = {
            ...(sections.payment || {}),
            docs: [...(sections.payment?.docs || []).filter((d) => d.type !== att.type), att],
          };
          break;
      }

      // ✅ FIX: Owner section validation - check if form data exists first, then enhance with photos
      const requiresSelfie = (prev.businessVerificationType || "INFORMAL") === "FORMAL";
      const hasIdFront = !!sections.owner?.idFrontUrl;
      const hasSelfie = !!sections.owner?.selfieUrl || !requiresSelfie;
      const hasFormData = !!(prev.ownerName && prev.idNumber); // Form must be filled first
      
      // Owner is done when form is complete AND photos are captured
      // But if form isn't complete yet, don't mark as done even with photos
      const ownerDone = hasFormData && hasIdFront && hasSelfie;
      if (ownerDone) {
        sections.owner = { ...(sections.owner || {}), done: true };
      }

      const kraDone = (sections.kra?.docs?.length || 0) > 0;
      if (kraDone) sections.kra = { ...(sections.kra || {}), done: true };

      const paymentDone = (sections.payment?.docs?.length || 0) > 0 || !!sections.payment?.method;
      if (paymentDone) sections.payment = { ...(sections.payment || {}), done: true };

      const kycSections = { ...prev.kycSections, owner: ownerDone, kra: kraDone, payment: paymentDone };

      return {
        ...prev,
        attachments: nextAttachments,
        sections,
        kycSections,
        idPhotoUrl: sections.owner?.idFrontUrl || prev.idPhotoUrl,
        selfieWithIdUrl: sections.owner?.selfieUrl || prev.selfieWithIdUrl,
      };
    });
  }, []);

  const completeSection = useCallback((key: keyof Sections, patch?: Partial<Sections[keyof Sections]>) => {
    setDataState((prev) => ({
      ...prev,
      sections: {
        ...(prev.sections || {}),
        [key]: { ...(prev.sections?.[key] || {}), ...(patch || {}), done: true },
      },
      kycSections: { ...prev.kycSections, [key]: true },
    }));
  }, []);

  const updateKycSection = useCallback(
    (section: keyof NonNullable<OnboardingData["kycSections"]>, completed: boolean) => {
      setData({
        kycSections: { ...data.kycSections, [section]: completed },
        sections: { ...data.sections, [section]: { ...(data.sections?.[section] || {}), done: completed } } as Sections,
      });
    },
    [data.kycSections, data.sections, setData]
  );

  const isKycComplete = useCallback(() => {
  const s = data.kycSections;
  if (!s) return false;
  // Only these sections are required for KYC — 'payment' is handled at step 5
  const required: Array<keyof NonNullable<typeof s>> = ["kra", "owner", "industry", "admin"];
  return required.every((k) => !!s[k]);
}, [data.kycSections]);

  const isLiveCaptureComplete = useCallback(() => {
    const requiresSelfie = (data.businessVerificationType || "INFORMAL") === "FORMAL";
    return !!(data.idPhotoUrl && (!requiresSelfie || data.selfieWithIdUrl));
  }, [data.idPhotoUrl, data.selfieWithIdUrl, data.businessVerificationType]);

  const firstRequiredStep = useCallback((): Href => {
    const t = data.tier || user?.business?.tier || 1;
    if (t >= 3) {
      if (!isKycComplete()) return ONBOARDING_ROUTES.step3;     // KYC (incl. owner + docs)
      if (!isLiveCaptureComplete()) return ONBOARDING_ROUTES.step4; // Live capture
      return ONBOARDING_ROUTES.step5;                             // Payment
    } else {
      if (!isLiveCaptureComplete()) return ONBOARDING_ROUTES.step4;
      return ONBOARDING_ROUTES.step5;
    }
  }, [data.tier, user?.business?.tier, isKycComplete, isLiveCaptureComplete]);

  const canProceedToReview = useCallback(() => {
    const tier = data.tier || user?.business?.tier || 1;
    return !!(data.businessName && data.selectedPlan && data.idPhotoUrl && (tier < 3 || isKycComplete()));
  }, [data.businessName, data.selectedPlan, data.idPhotoUrl, data.tier, user?.business?.tier, isKycComplete]);

  const tier = data.tier || user?.business?.tier || 1;

  const nextFrom = useCallback(
    (from: StepKey): Href => {
      switch (from) {
        case "step1":
          return ONBOARDING_ROUTES.step2;
        case "step2":
          // After picking a plan, force the first required sub-step
          return firstRequiredStep();
        case "step3":
          // Don't allow skipping live capture if KYC incomplete
          return isKycComplete() ? ONBOARDING_ROUTES.step4 : ONBOARDING_ROUTES.step3;
        case "step4":
          // Only allow payment when live capture is done
          return isLiveCaptureComplete() ? ONBOARDING_ROUTES.step5 : ONBOARDING_ROUTES.step4;
        case "step5":
          // Guard review; if pre-reqs missing, send back to the first required step
          return canProceedToReview() ? ONBOARDING_ROUTES.step6 : firstRequiredStep();
        case "step6":
          return ONBOARDING_ROUTES.step7;
        case "step7":
        default:
          return ONBOARDING_ROUTES.step7;
      }
    },
    [firstRequiredStep, isKycComplete, isLiveCaptureComplete, canProceedToReview]
  );

  const prevFrom = useCallback(
    (from: StepKey): Href => {
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
        default:
          return ONBOARDING_ROUTES.step6;
      }
    },
    [tier]
  );

  const goNext = useCallback(
    (from: StepKey) => {
      const nextRoute = nextFrom(from);
      router.push(nextRoute);
    },
    [router, nextFrom]
  );

  const goPrev = useCallback(
    (from: StepKey) => {
      const prevRoute = prevFrom(from);
      router.push(prevRoute);
    },
    [router, prevFrom]
  );

  // ----------------------------
  // Submit flow (3 endpoints, then navigate)
  // ----------------------------
  const submitOnboarding = useCallback(
    async (): Promise<{ success: boolean; error?: string; businessId?: string }> => {
      try {
        // auth guard (fixes token: string | null)
        if (!token) {
          return { success: false, error: "Not authenticated" };
        }

        // quick client-side validation (clear errors early)
        if (!data.businessName || !data.address) {
          return { success: false, error: "Missing business name or address" };
        }
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return { success: false, error: "Invalid location coordinates" };
        }

        // ✅ FIX: Differentiate validation based on verification type
        if (data.businessVerificationType === "FORMAL") {
          if (!data.idNumber || !data.idPhotoUrl) {
            return { success: false, error: "Missing verification details (ID number / ID photo)" };
          }
        } else {
          // INFORMAL verification only requires ID photo
          if (!data.idPhotoUrl) {
            return { success: false, error: "ID photo required" };
          }
        }

        // ✅ Add debug logging for troubleshooting
        console.log("KYC snapshot", {
          idNumber: data.idNumber,
          idPhotoUrl: data.idPhotoUrl,
          businessVerificationType: data.businessVerificationType,
          sections: data.sections?.owner,
          kycSections: data.kycSections,
        });

        // 1) Create Business
        const bizRes = (await createBusiness(
          {
            name: data.businessName,
            description: data.description,
            address: data.address,
            latitude: lat,
            longitude: lng,
            type: data.businessVerificationType || "INFORMAL",
            payoutType: data.payoutType ?? null,
            mpesaPhoneNumber: data.mpesaPhoneNumber ?? null,
            tillNumber: data.tillNumber ?? null,
            paybillNumber: data.paybillNumber ?? null,
            accountRef: data.accountRef ?? null,
            bankName: data.bankName ?? null,
            bankAccount: data.bankAccount ?? null,
            accountName: data.accountName ?? null,
          },
          token
        )) as CreateBusinessRes;

        if (!bizRes?.ok || !bizRes?.business?.id) {
          return { success: false, error: bizRes?.error || "Could not create business" };
        }
        const businessId = bizRes.business.id;

        // 2) Create BusinessVerification - Fixed TypeScript error by removing kraPin
        const verRes = (await createBusinessVerification(
          {
             businessId,
             type: data.businessVerificationType || "INFORMAL",
             idNumber: data.idNumber ?? "",          
             regNumber: data.regNumber ?? null,
             idPhotoUrl: data.idPhotoUrl ?? "",      
             selfieWithIdUrl: data.selfieWithIdUrl ?? "", 
             licenseUrl: data.licenseUrl ?? null,
             // kraPin removed - not part of CreateBusinessVerificationPayload type
          },
          token
        )) as SimpleOkRes;

        if (!verRes?.ok) {
          return { success: false, error: verRes?.error || "Could not create verification" };
        }

        // 3) Create Subscription (+ link promo) – optional while payments are not live
        if (PAYMENTS_ENABLED) {
          const planTier = normalizePlan(data.billing?.planTier || data.selectedPlan?.tier || "LEVEL_1");
          const promo =
            data.promoApplied && data.promoCode
              ? { code: data.promoCode, trialEndsOn: data.trialEndsOn || undefined }
              : null;
          const subRes = (await createSubscription({ businessId, plan: planTier, promo }, token)) as SimpleOkRes;
          if (!subRes?.ok) {
            // not fatal for navigation; log if you want to surface a toast
            console.warn("Subscription creation failed:", subRes?.error);
          }
        } else {
          console.info("🔕 Payments disabled: skipping subscription creation during onboarding");
        }

        // keep local session/UI synced (optional)
        updateBusiness?.({
          businessName: data.businessName!,
          businessType: data.businessType!,
          selectedPlan: data.selectedPlan,
          tier: data.tier!,
          verificationStatus: "pending",
        });

        // navigate client-side only
        isNavigatingRef.current = true;
        router.replace("/business/onboarding/pending");
        return { success: true, businessId };
      } catch (e: any) {
        return { success: false, error: e?.message || "Submission failed" };
      }
    },
    [data, token, router, updateBusiness]
  );

  const value: Ctx = useMemo(
    () => ({
      routes: ONBOARDING_ROUTES,
      data,
      setData,
      addAttachment,
      completeSection,
      updateKycSection,
      isKycComplete,
      isLiveCaptureComplete,
      firstRequiredStep,
      canProceedToReview,
      nextFrom,
      prevFrom,
      goNext,
      goPrev,
      submitOnboarding,
      clearData,
      getStepProgress,
      isStepComplete,
    }),
    [
      data,
      setData,
      addAttachment,
      completeSection,
      updateKycSection,
      isKycComplete,
      isLiveCaptureComplete,
      firstRequiredStep,
      canProceedToReview,
      nextFrom,
      prevFrom,
      goNext,
      goPrev,
      submitOnboarding,
      clearData,
      getStepProgress,
      isStepComplete,
    ]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}