import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage } from "@/lib/format";
import {
  listFavoritePlaces,
  quickPlaces,
  recentPlaceSearches,
  removeFavoritePlace,
  saveFavoritePlace,
} from "@/lib/tools.functions";

type Place = { id: string; name: string; address: string; lat: number; lng: number; phone?: string };
type Favorite = {
  id: string;
  nickname: string;
  label: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
};

const LABELS = ["home", "work", "client", "venue", "other"];

const directionsUrl = (p: { lat: number; lng: number; address?: string }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    p.address ? p.address : `${p.lat},${p.lng}`,
  )}&travelmode=driving`;

const browserKey = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as
  | string
  | undefined;

export function PlacesPanel() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [saving, setSaving] = useState<Place | null>(null);
  const [nickname, setNickname] = useState("");
  const [label, setLabel] = useState("other");
  const searchRef = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(id);
  }, [query]);

  const search = useQuery({
    queryKey: ["places", debounced],
    queryFn: () => quickPlaces({ data: { query: debounced } }),
    enabled: debounced.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!search.data) return;
    if (!search.data.connected) return;
    searchRef.current += 1;
    const list = search.data.results as Place[];
    setResults(list);
    setSelected(list[0] ?? null);
  }, [search.data]);

  const favorites = useQuery({
    queryKey: ["saved-places"],
    queryFn: () => listFavoritePlaces(),
  });

  const recent = useQuery({
    queryKey: ["place-searches"],
    queryFn: () => recentPlaceSearches(),
  });

  const save = useMutation({
    mutationFn: (place: Place) =>
      saveFavoritePlace({
        data: {
          nickname: nickname.trim() || place.name,
          label,
          name: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          placeId: place.id,
          ...(place.phone ? { phone: place.phone } : {}),
        },
      }),
    onSuccess: async () => {
      toast.success("Saved to favorites");
      setSaving(null);
      setNickname("");
      await queryClient.invalidateQueries({ queryKey: ["saved-places"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFavoritePlace({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["saved-places"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const favoriteList = useMemo(() => (favorites.data ?? []) as unknown as Favorite[], [favorites.data]);
  const notConnected = search.data && !search.data.connected;

  return (
    <div className="space-y-4">
      <div className="relative flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a business or address"
        />
        <Button variant="secondary" disabled className="pointer-events-none">
          {search.isFetching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
        </Button>
      </div>

      {notConnected && (
        <p className="glass-panel rounded-2xl p-3 text-xs text-muted-foreground">
          Google Maps isn’t connected yet.
        </p>
      )}

      {!query && (recent.data ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(recent.data ?? []).map((r) => (
            <button
              key={r.query as string}
              type="button"
              onClick={() => setQuery(r.query as string)}
              className="glass-panel rounded-full px-3 py-1 text-xs text-muted-foreground"
            >
              {r.query as string}
            </button>
          ))}
        </div>
      )}

      {favoriteList.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Favorites
          </p>
          {favoriteList.map((f) => (
            <div key={f.id} className="glass-panel flex items-center gap-3 rounded-2xl p-3">
              <Star className="size-4 shrink-0 text-primary" />
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() =>
                  setSelected({
                    id: f.id,
                    name: f.name,
                    address: f.address,
                    lat: f.lat,
                    lng: f.lng,
                  })
                }
              >
                <p className="truncate text-sm font-medium">
                  {f.nickname}{" "}
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {f.label}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{f.address}</p>
              </button>
              {f.phone && (
                <a href={`tel:${f.phone}`} className="text-muted-foreground">
                  <Phone className="size-4" />
                </a>
              )}
              <a href={directionsUrl(f)} target="_blank" rel="noreferrer" className="text-primary">
                <Navigation className="size-4" />
              </a>
              <button
                type="button"
                onClick={() => remove.mutate(f.id)}
                className="text-muted-foreground"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && browserKey && (
        <iframe
          title="Map"
          className="h-56 w-full rounded-2xl border border-white/10"
          loading="lazy"
          src={`https://www.google.com/maps/embed/v1/view?key=${browserKey}&center=${selected.lat},${selected.lng}&zoom=15`}
        />
      )}

      {selected && (
        <div className="flex gap-2">
          <Button asChild className="flex-1 rounded-full">
            <a href={directionsUrl(selected)} target="_blank" rel="noreferrer">
              <Navigation className="size-4" /> Directions
            </a>
          </Button>
          <Button
            variant="secondary"
            className="rounded-full"
            onClick={() => {
              setSaving(selected);
              setNickname(selected.name);
            }}
          >
            <Star className="size-4" /> Save
          </Button>
        </div>
      )}

      {saving && (
        <div className="glass-panel space-y-3 rounded-2xl p-4">
          <p className="text-sm font-medium">Save “{saving.name}”</p>
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Nickname (e.g. Main office)"
          />
          <Select value={label} onValueChange={setLabel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LABELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              className="flex-1 rounded-full"
              disabled={save.isPending}
              onClick={() => save.mutate(saving)}
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save favorite"}
            </Button>
            <Button variant="ghost" className="rounded-full" onClick={() => setSaving(null)}>
              Cancel
            </Button>
          </div>
        </div>
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
              href={directionsUrl(p)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary"
            >
              <Navigation className="size-4" />
            </a>
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