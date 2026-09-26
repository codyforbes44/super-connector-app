import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { E911_ACK_LABEL, E911_DISCLOSURE_PARAGRAPHS } from "@/lib/compliance/disclosure";

export function E911DisclosureDialog({
  open,
  busy,
  onAcknowledge,
  onDismiss,
}: {
  open: boolean;
  busy?: boolean;
  onAcknowledge: () => void;
  onDismiss: () => void;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader className="pr-8">
          <DialogTitle>911 limitations on SixVox</DialogTitle>
          <DialogDescription>
            Required acknowledgment for interconnected VoIP service under 47 CFR 9.11.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          {E911_DISCLOSURE_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => setChecked(value === true)}
            className="mt-0.5"
          />
          <span>{E911_ACK_LABEL}</span>
        </label>
        <Button className="h-11 w-full" disabled={!checked || busy} onClick={onAcknowledge}>
          {busy ? "Saving…" : "I understand"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
