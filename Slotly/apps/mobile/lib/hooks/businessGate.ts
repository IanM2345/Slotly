import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useSession } from "../../context/SessionContext";
import { getMe } from "../../lib/api/modules/users";

type GateStatus =
  | "checking"
  | "unauthenticated"
  | "needs_onboarding"
  | "pending_verification"
  | "active_business"
  | "error";

const PENDING_STATES = ["pending", "submitted", "review"];
const ACTIVE_STATES = ["approved", "active", "verified"];

export function useBusinessGate(opts: { autoRedirect?: boolean } = {}) {
  const { autoRedirect = true } = opts;
  const router = useRouter();
  const { token, ready, setUser } = useSession();

  const [status, setStatus] = useState<GateStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);

  // guards to stop loops
  const inFlight = useRef(false);
  const lastSnap = useRef<string | null>(null);
  const redirectedRef = useRef(false);

  const compute = useCallback(async () => {
    if (!ready) return;               // wait for session hydration
    if (!token) {                     // unauthenticated
      setStatus("unauthenticated");
      return;
    }
    if (inFlight.current) return;     // de-dupe
    inFlight.current = true;

    try {
      setError(null);
      const me = await getMe(token);

      const v = (me?.business?.verificationStatus || "")
        .toString()
        .toLowerCase() || null;

      const snap = JSON.stringify({
        uid: me?.id ?? null,
        biz: me?.business?.id ?? null,
        ver: v,
      });

      // Only update state if something meaningful changed
     // Only update state if something meaningful changed
if (snap !== lastSnap.current) {
  lastSnap.current = snap;

  setBusinessId(me?.business?.id ?? null);
  setVerificationStatus(v);

  // keep session fresh — direct value (no functional update)
  setUser?.(me as any);

  if (me?.business && v && ACTIVE_STATES.includes(v)) {
    setStatus("active_business");
  } else if (me?.business && v && PENDING_STATES.includes(v)) {
    setStatus("pending_verification");
  } else {
    setStatus("needs_onboarding");
  }
}

    } catch (e: any) {
      const msg =
        e?.response?.data?.error ??
        e?.response?.data?.message ??
        e?.message ??
        "Failed to check account";
      setError(msg);
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }, [ready, token]); // ← ONLY depends on ready/token

  // run once (and again if token/ready changes)
  useEffect(() => {
    compute();
  }, [compute]);

  // redirect exactly once per mount
  useEffect(() => {
    if (!autoRedirect || redirectedRef.current) return;
    if (status === "active_business") {
      redirectedRef.current = true;
      router.replace("/business/dashboard");
    } else if (status === "pending_verification") {
      redirectedRef.current = true;
      router.replace("/business/onboarding/pending");
    }
  }, [autoRedirect, status, router]);

  const loading = status === "checking";

  return {
    ready,
    loading,
    status,
    error,
    businessId,
    verificationStatus,
    refresh: compute,
    isActive: useMemo(() => status === "active_business", [status]),
    isPending: useMemo(() => status === "pending_verification", [status]),
    needsOnboarding: useMemo(() => status === "needs_onboarding", [status]),
  };
}
