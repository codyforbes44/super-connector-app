import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { E911DisclosureDialog } from "@/components/compliance/E911DisclosureDialog";
import { acknowledgeE911Disclosure, getE911Gate } from "@/lib/compliance.functions";
import { errorMessage } from "@/lib/format";

/** Blocks the signed-in app with the 911 disclosure until this user acknowledges it. */
export function E911Gate() {
  const queryClient = useQueryClient();
  const gate = useQuery({
    queryKey: ["e911-gate"],
    queryFn: () => getE911Gate(),
  });
  const open = gate.data?.acknowledged === false;

  return (
    <E911DisclosureDialog
      open={open}
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
