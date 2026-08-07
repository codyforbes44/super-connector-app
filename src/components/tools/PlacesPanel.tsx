import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Loader2, MapPin, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/format";
import { searchPlaces } from "@/lib/integrations.functions";

type Place = { id: string; name: string; address: string; lat: number; lng: number; phone?: string };

const browserKey = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as
  | string
  | undefined;

export function PlacesPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);

  const search = useMutation({
    mutationFn: () => searchPlaces({ data: { query } }),
    onSuccess: (res) => {
      if (!res.connected) {
        toast.error("Google Maps isn’t connected yet.");
        return;
      }
      setResults(res.results as Place[]);
      setSelected((res.results[0] as Place) ?? null);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && query && search.mutate()}
          placeholder="Search a business or address"
        />
        <Button variant="secondary" disabled={!query || search.isPending} onClick={() => search.mutate()}>
          {search.isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
        </Button>
      </div>

      {selected && browserKey && (
        <iframe
          title="Map"
          className="h-56 w-full rounded-2xl border border-white/10"
          loading="lazy"
          src={`https://www.google.com/maps/embed/v1/view?key=${browserKey}&center=${selected.lat},${selected.lng}&zoom=15`}
        />
      )}

      <div className="space-y-2">
        {results.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p)}
            className="glass-panel flex w-full items-start gap-3 rounded-2xl p-3 text-left"
          >
            <MapPin className="mt-0.5 size-4 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">{p.address}</p>
              {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground"
            >
              <ExternalLink className="size-4" />
            </a>
          </button>
        ))}
      </div>
    </div>
  );
}