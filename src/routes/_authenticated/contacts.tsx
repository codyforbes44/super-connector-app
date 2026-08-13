import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Search, Smartphone, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ScreenHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, formatPhone, initialsFor } from "@/lib/format";
import {
  importDeviceContacts,
  listContacts,
  removeContact,
  saveContact,
} from "@/lib/contacts.functions";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts — SixVox" },
      {
        name: "description",
        content: "Keep your people in one place and optionally sync your device address book.",
      },
      { property: "og:title", content: "Contacts — SixVox" },
      {
        property: "og:description",
        content: "Keep your people in one place and optionally sync your device address book.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactsScreen,
});

type Contact = {
  id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

type DeviceContact = { name?: string[]; tel?: string[]; email?: string[]; address?: unknown[] };
type ContactsManager = {
  select: (
    props: string[],
    options?: { multiple?: boolean },
  ) => Promise<DeviceContact[]>;
  getProperties: () => Promise<string[]>;
};

function contactsApi(): ContactsManager | null {
  if (typeof navigator === "undefined") return null;
  const api = (navigator as unknown as { contacts?: ContactsManager }).contacts;
  return api && typeof api.select === "function" ? api : null;
}

function ContactsScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const [deviceSupported, setDeviceSupported] = useState(false);

  useEffect(() => {
    setDeviceSupported(Boolean(contactsApi()));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const contacts = useQuery({
    queryKey: ["contacts", term],
    queryFn: () => listContacts({ data: term ? { search: term } : {} }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["contacts"] });

  const syncDevice = useMutation({
    mutationFn: async () => {
      const api = contactsApi();
      if (!api) throw new Error("This device doesn't allow apps to read your address book.");
      const picked = await api.select(["name", "tel", "email"], { multiple: true });
      const entries = picked.flatMap((person) =>
        (person.tel ?? []).map((tel) => ({
          phoneNumber: tel,
          name: person.name?.[0] ?? null,
          email: person.email?.[0] ?? null,
        })),
      );
      if (!entries.length) throw new Error("No phone numbers in that selection.");
      return importDeviceContacts({ data: { entries } });
    },
    onSuccess: async (result) => {
      await refresh();
      toast.success(
        `Added ${result.imported} · updated ${result.updated}${result.skipped ? ` · skipped ${result.skipped}` : ""}`,
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeContact({ data: { id } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Contact removed.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = (contacts.data ?? []) as Contact[];

  return (
    <div className="pb-8">
      <ScreenHeader
        title="Contacts"
        subtitle={rows.length ? `${rows.length} saved` : "Your people, in one place"}
        action={
          <Button size="icon" variant="ghost" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add contact</span>
          </Button>
        }
      />

      <div className="space-y-3 px-4 py-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, number or email"
            className="h-11 rounded-full pl-9"
          />
        </div>

        <div className="glass-panel flex items-center gap-3 rounded-3xl p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/18 text-primary">
            <Smartphone className="size-[1.05rem]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Sync device contacts</p>
            <p className="text-xs text-muted-foreground">
              {deviceSupported
                ? "You pick who to share — nothing is read automatically."
                : "Your browser can't share the address book. Open SixVox on Android Chrome, or add people by hand."}
            </p>
          </div>
          <Button
            size="sm"
            className="rounded-full"
            disabled={!deviceSupported || syncDevice.isPending}
            onClick={() => syncDevice.mutate()}
          >
            {syncDevice.isPending ? <Loader2 className="size-4 animate-spin" /> : "Sync"}
          </Button>
        </div>
      </div>

      {contacts.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={term ? "No matches" : "No contacts yet"}
          description={
            term
              ? "Try a different name or number."
              : "Add someone by hand, or sync the people already on your phone."
          }
          action={
            <Button className="rounded-full" onClick={() => setEditing("new")}>
              Add a contact
            </Button>
          }
        />
      ) : (
        <ul className="glass-panel mx-3 divide-y divide-border/60 overflow-hidden rounded-3xl">
          {rows.map((contact) => (
            <li key={contact.id} className="flex items-center gap-3 px-3.5 py-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => setEditing(contact)}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/18 text-sm font-semibold text-primary">
                  {initialsFor(contact.name || contact.phone_number)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.95rem] font-medium">
                    {contact.name || formatPhone(contact.phone_number)}
                  </span>
                  <span className="tabular block truncate text-xs text-muted-foreground">
                    {contact.name ? formatPhone(contact.phone_number) : contact.email || "No name"}
                  </span>
                </span>
              </button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => del.mutate(contact.id)}
                disabled={del.isPending}
              >
                <Trash2 className="size-4 text-destructive" />
                <span className="sr-only">Delete contact</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <ContactSheet
          contact={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refresh();
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ContactSheet({
  contact,
  onClose,
  onSaved,
}: {
  contact: Contact | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [phone, setPhone] = useState(contact?.phone_number ?? "");
  const [name, setName] = useState(contact?.name ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [address, setAddress] = useState(contact?.address ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");

  const save = useMutation({
    mutationFn: () =>
      saveContact({ data: { phoneNumber: phone, name, email, address, notes } }),
    onSuccess: async () => {
      toast.success("Contact saved.");
      await onSaved();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="app-gradient max-h-[85dvh] overflow-y-auto rounded-t-[2rem] border-border"
      >
        <SheetHeader className="px-0">
          <SheetTitle>{contact ? "Edit contact" : "New contact"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 pb-6">
          <div className="space-y-1.5">
            <Label htmlFor="contact-phone">Phone number</Label>
            <Input
              id="contact-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+1 555 010 1234"
              inputMode="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">Name</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-address">Address</Label>
            <Input
              id="contact-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-notes">Notes</Label>
            <Textarea
              id="contact-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>
          <Button
            className="h-12 w-full rounded-full font-semibold"
            onClick={() => save.mutate()}
            disabled={save.isPending || !phone.trim()}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save contact"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
