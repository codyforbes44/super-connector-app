import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { E911DisclosureDialog } from "@/components/compliance/E911DisclosureDialog";
import { acknowledgeE911Disclosure, getE911Gate } from "@/lib/compliance.functions";
import {
  dismissE911Notice,
  isE911NoticeDismissed,
  subscribeE911NoticeDismissals,
} from "@/lib/compliance/e911-session";
import { errorMessage } from "@/lib/format";

/**
 * Shows the 911 disclosure when this user has not acknowledged the current
 * version. Closing it hides the notice for the rest of this page load only.
 */
export function E911Gate({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const gate = useQuery({
    queryKey: ["e911-gate"],
    queryFn: () => getE911Gate(),
  });
  const dismissed = useSyncExternalStore(
    subscribeE911NoticeDismissals,
    () => isE911NoticeDismissed(userId),
    () => false,
  );
  const open = gate.data?.acknowledged === false && !dismissed;

  return (
    <E911DisclosureDialog
      open={open}
      onDismiss={() => dismissE911Notice(userId)}
      onAcknowledge={() => {
        void acknowledgeE911Disclosure()
          .then(async () => {
            await queryClient.invalidateQueries({ queryKey: ["e911-gate"] });
            toast.success("911 acknowledgment saved.");
          })
          .catch((error: unknown) => toast.error(errorMessage(error)));
      }}
    />
  );
}
