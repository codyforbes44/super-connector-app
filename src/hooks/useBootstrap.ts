import { useSuspenseQuery } from "@tanstack/react-query";

import { getBootstrap } from "@/lib/twilio.functions";

export const bootstrapQuery = {
  queryKey: ["bootstrap"] as const,
  queryFn: () => getBootstrap(),
  staleTime: 30_000,
};

export function useBootstrap() {
  return useSuspenseQuery(bootstrapQuery).data;
}
