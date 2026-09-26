import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { QuietHoursCard, type QuietHoursValue } from "@/components/compliance/QuietHoursCard";
import { getQuietHoursSettings, saveQuietHoursSettings } from "@/lib/compliance.functions";
import { errorMessage } from "@/lib/format";

const DEFAULTS: QuietHoursValue = {
  enabled: false,
  quietStart: "21:00",
  quietEnd: "08:00",
  timezone: "America/Chicago",
};

export function QuietHoursSettings() {
  const query = useQuery({
    queryKey: ["sms-quiet-hours"],
    queryFn: () => getQuietHoursSettings(),
  });
  const [draft, setDraft] = useState<QuietHoursValue | null>(null);
  const [busy, setBusy] = useState(false);
  const value = draft ?? query.data ?? (query.isLoading ? null : DEFAULTS);
  if (!value) return null;

  return (
    <QuietHoursCard
      value={value}
      busy={busy}
      onChange={setDraft}
      onSave={() => {
        setBusy(true);
        void saveQuietHoursSettings({ data: value })
          .then(() => {
            toast.success("Quiet hours saved.");
            return query.refetch();
          })
          .catch((error: unknown) => toast.error(errorMessage(error)))
          .finally(() => setBusy(false));
      }}
    />
  );
}
