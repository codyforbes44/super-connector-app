import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { planByCode, type PlanCode } from "@/lib/plans";
import { getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";

export type SubscriptionRow = {
  id: string;
  status: string;
  plan_code: string | null;
  billing_interval: string;
  comped: boolean;
  suspended: boolean;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  trial_ends_at: string | null;
};

function activeFrom(row: SubscriptionRow | null): boolean {
  if (!row || row.suspended) return false;
  if (row.comped) return true;
  const future = !row.current_period_end || new Date(row.current_period_end) > new Date();
  if (["active", "trialing", "past_due"].includes(row.status)) return future;
  if (row.status === "canceled") return future;
  return false;
}

export function useSubscription() {
  const environment = paymentsConfigured() ? getStripeEnvironment() : "sandbox";

  const query = useQuery({
    queryKey: ["subscription", environment],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return null;

      const [{ data: rows }, { data: isSuper }] = await Promise.all([
        supabase
          .from("subscriptions")
          .select(
            "id, status, plan_code, billing_interval, comped, suspended, cancel_at_period_end, current_period_end, stripe_customer_id, trial_ends_at",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.rpc("is_super_admin", { _user_id: userId }),
      ]);

      const row = (rows?.[0] ?? null) as SubscriptionRow | null;
      return { row, isSuperAdmin: Boolean(isSuper) };
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`subscription-self-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions" },
        () => void query.refetch(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const row = query.data?.row ?? null;
  const isSuperAdmin = query.data?.isSuperAdmin ?? false;
  const plan = planByCode(row?.plan_code);

  return {
    loading: query.isLoading,
    subscription: row,
    plan,
    planCode: (plan?.code ?? null) as PlanCode | null,
    isSuperAdmin,
    isActive: isSuperAdmin || activeFrom(row),
    refetch: query.refetch,
  };
}