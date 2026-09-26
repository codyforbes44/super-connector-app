import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Search, Smartphone, Trash2, Upload, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
import { ContactImportSheet } from "@/components/contacts/ContactImportSheet";
import { AsyncList, Empty, ListGroup, Screen, Section } from "@/components/screen";
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
  select: (props: string[], options?: { multiple?: boolean }) => Promise<DeviceContact[]>;
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
  const [importing, setImporting] = useState(false);
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
    <div className="min-w-0">
      <ScreenHeader
        title="Contacts"
        subtitle={rows.length ? `${rows.length} saved` : "Your people, in one place"}
        action={
          <>
            <Button
              variant="outline"
              className="h-11 rounded-xl px-3"
              onClick={() => setImporting(true)}
            >
              <Upload className="size-4" />
              Import
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-11 w-11"
              onClick={() => setEditing("new")}
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">Add contact</span>
            </Button>
          </>
        }
      />

      <Screen onRefresh={refresh}>
        <div className="space-y-3 pt-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, number or email"
              aria-label="Search contacts by name, number, or email"
              className="h-11 rounded-lg pl-9"
            />
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
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
              className="rounded-xl"
              disabled={!deviceSupported || syncDevice.isPending}
              onClick={() => syncDevice.mutate()}
            >
              {syncDevice.isPending ? <Loader2 className="size-4 animate-spin" /> : "Sync"}
            </Button>
          </div>
        </div>

        <AsyncList
          query={contacts}
          items={rows}
          skeletonRows={6}
          className="mt-4"
          errorTitle="Couldn't load contacts"
          empty={
            <Empty
              icon={Users}
              title={term ? "No matches" : "No contacts yet"}
              description={
                term
                  ? "Try a different name or number."
                  : "Save the homeowners you work for so the next call shows a name, not just a number. Import a list, or add people one at a time."
              }
              action={
                <>
                  <Button className="h-12 rounded-xl px-5" onClick={() => setEditing("new")}>
                    Add a contact
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl px-5"
                    onClick={() => setImporting(true)}
                  >
                    Import
                  </Button>
                </>
              }
            />
          }
        >
          {(page) =>
            groupContacts(page).map(([letter, list]) => (
              <Section key={letter} title={letter}>
                <ListGroup>
                  {list.map((contact) => (
                    <div key={contact.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto min-h-11 min-w-0 flex-1 justify-start gap-3 overflow-hidden px-0 py-0 text-left hover:bg-transparent"
                        onClick={() => setEditing(contact)}
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/15 text-sm font-semibold text-primary">
                          {initialsFor(contact.name || contact.phone_number)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[0.95rem] font-medium">
                            {contact.name || formatPhone(contact.phone_number)}
                          </span>
                          <span className="tabular block truncate text-xs text-muted-foreground">
                            {contact.name
                              ? formatPhone(contact.phone_number)
                              : contact.email || "No name"}
                          </span>
                        </span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => del.mutate(contact.id)}
                        disabled={del.isPending}
                      >
                        <Trash2 className="size-4 text-destructive" />
                        <span className="sr-only">Delete contact</span>
                      </Button>
                    </div>
                  ))}
                </ListGroup>
              </Section>
            ))
          }
        </AsyncList>
      </Screen>

      <ContactImportSheet open={importing} onOpenChange={setImporting} onImported={refresh} />

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

/** A–Z sections keep long lists scannable on a phone. */
function groupContacts(list: Contact[]): [string, Contact[]][] {
  const map = new Map<string, Contact[]>();
  for (const contact of list) {
    const label = (contact.name || formatPhone(contact.phone_number)).trim();
    const first = label.charAt(0).toUpperCase();
    const key = /[A-Z]/.test(first) ? first : "#";
    const existing = map.get(key);
    if (existing) existing.push(contact);
    else map.set(key, [contact]);
  }
  return [...map.entries()].sort(([a], [b]) =>
    a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b),
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
    mutationFn: () => saveContact({ data: { phoneNumber: phone, name, email, address, notes } }),
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
        className="max-h-[85dvh] overflow-y-auto rounded-t-lg border-border bg-card"
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
            className="h-12 w-full rounded-xl font-semibold"
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
