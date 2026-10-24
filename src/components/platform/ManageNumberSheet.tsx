import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { errorMessage, formatPhone } from "@/lib/format";
import { platformAddPerson, platformMoveNumber, platformNumberDetail, platformSetAssignee } from "@/lib/platform.functions";

export function ManageNumberSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["platform", "number", id], queryFn: () => platformNumberDetail({ data: { id: id! } }), enabled: !!id, retry: false });
  const [team, setTeam] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [newTeam, setNewTeam] = useState("");
  const [comp, setComp] = useState(false);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["platform"] });
  };
  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => { toast.success("Saved"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const d = q.data;

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:mx-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{d ? formatPhone(d.number) : "Number"}</SheetTitle>
          <SheetDescription>Controls who sees this number in SixVox. Twilio call and text settings aren't changed.</SheetDescription>
        </SheetHeader>
        {q.isError ? <p className="p-4 text-sm text-destructive">{errorMessage(q.error)}</p> : null}
        {d ? (
          <div className="space-y-6 p-4">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Team</h3>
              <div className="flex gap-2">
                <select
                  className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
                  value={team || d.workspaceId}
                  onChange={(e) => setTeam(e.target.value)}
                  aria-label="Team"
                >
                  {d.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <Button
                  className="h-11"
                  disabled={!team || team === d.workspaceId || run.isPending}
                  onClick={() => {
                    if (!confirm("Move this number to the selected team? Its people assignments will be cleared.")) return;
                    run.mutate(() => platformMoveNumber({ data: { id: d.id, workspaceId: team } }), { onSuccess: () => setTeam("") });
                  }}
                >
                  Move
                </Button>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">People who can use it</h3>
              {d.members.length === 0 ? <p className="text-sm text-muted-foreground">No one is on this team yet.</p> : null}
              {d.members.map((m) => (
                <label key={m.userId} className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3">
                  <Checkbox
                    checked={m.assigned}
                    disabled={run.isPending}
                    onCheckedChange={(v) => run.mutate(() => platformSetAssignee({ data: { id: d.id, userId: m.userId, assigned: v === true } }))}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{m.email || m.userId}</span>
                  <span className="text-xs text-muted-foreground">{m.role}</span>
                </label>
              ))}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Add a person</h3>
              <Input className="h-11 rounded-xl" type="email" placeholder="Their SixVox sign-in email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="agent">Agent</option>
              </select>
              <Input className="h-11 rounded-xl" placeholder="New team name (optional — leave blank to join this team)" value={newTeam} onChange={(e) => setNewTeam(e.target.value)} />
              {newTeam.trim() ? (
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <Checkbox checked={comp} onCheckedChange={(v) => setComp(v === true)} /> Give the new team a free Team plan
                </label>
              ) : null}
              <Button
                className="h-11 w-full"
                disabled={!email.trim() || run.isPending}
                onClick={() =>
                  run.mutate(() => platformAddPerson({ data: { id: d.id, email, role, newTeamName: newTeam, comp } }), {
                    onSuccess: () => { setEmail(""); setNewTeam(""); setComp(false); },
                  })
                }
              >
                Add and give this number
              </Button>
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
