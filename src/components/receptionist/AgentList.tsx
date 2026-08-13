import { useQuery } from "@tanstack/react-query";
import { Bot, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AgentEditorSheet } from "@/components/receptionist/AgentEditorSheet";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/format";
import { deleteElevenLabsAgent, listElevenLabsAgents } from "@/lib/elevenlabs.functions";

export const agentsQuery = {
  queryKey: ["el-agents"] as const,
  queryFn: () => listElevenLabsAgents(),
};

export function AgentList({
  canEdit,
  onRefresh,
}: {
  canEdit: boolean;
  onRefresh: () => Promise<unknown>;
}) {
  const agents = useQuery(agentsQuery);
  const [editing, setEditing] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function remove(agentId: string, name: string) {
    if (!window.confirm(`Delete "${name}"? Numbers using it fall back to classic voicemail.`)) {
      return;
    }
    setRemoving(agentId);
    try {
      await deleteElevenLabsAgent({ data: { agentId } });
      await onRefresh();
      toast.success("Agent deleted.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-3">
      {canEdit ? (
        <Button
          className="key-signal h-12 w-full rounded-xl font-semibold"
          onClick={() => setCreating(true)}
        >
          <Plus className="mr-2 size-4" />
          New agent
        </Button>
      ) : null}

      {agents.isLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : agents.isError ? (
        <p className="px-1 text-sm text-destructive">{errorMessage(agents.error)}</p>
      ) : (agents.data ?? []).length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No agents yet. Create one to let the AI receptionist answer calls.
        </p>
      ) : (
        <ul className="space-y-2">
          {(agents.data ?? []).map((agent) => (
            <li key={agent.agent_id} className="flex items-center gap-3 rounded-2xl bg-muted/30 p-3">
              <div className="key-raised grid size-10 shrink-0 place-items-center rounded-full">
                <Bot className="size-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{agent.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{agent.agent_id}</p>
              </div>
              {canEdit ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(agent.agent_id)}
                    className="grid size-9 place-items-center rounded-full bg-muted/40 text-muted-foreground transition hover:text-foreground"
                    aria-label={`Edit ${agent.name}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicating(agent.agent_id)}
                    className="grid size-9 place-items-center rounded-full bg-muted/40 text-muted-foreground transition hover:text-foreground"
                    aria-label={`Duplicate ${agent.name}`}
                  >
                    <Copy className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(agent.agent_id, agent.name)}
                    className="grid size-9 place-items-center rounded-full bg-muted/40 text-muted-foreground transition hover:text-destructive"
                    aria-label={`Delete ${agent.name}`}
                  >
                    {removing === agent.agent_id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {creating || editing || duplicating ? (
        <AgentEditorSheet
          agentId={editing}
          duplicateOf={duplicating}
          onClose={() => {
            setCreating(false);
            setEditing(null);
            setDuplicating(null);
          }}
          onSaved={onRefresh}
        />
      ) : null}
    </div>
  );
}