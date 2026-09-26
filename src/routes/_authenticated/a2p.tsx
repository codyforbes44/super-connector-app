import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Check, CircleDashed, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
import { PullToRefresh } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useBootstrap } from "@/hooks/useBootstrap";
import { a2pStatus, submitBrand, submitBusinessProfile, submitCampaign } from "@/lib/a2p.functions";
import { A2P_FEE_SCHEDULE, type A2pPath } from "@/lib/a2p-fees";
import { errorMessage } from "@/lib/format";
import { listMessagingServices, refreshMessagingReadiness } from "@/lib/twilio.functions";

const TITLE = "US texting registration — SixVox";
const DESCRIPTION =
  "Register your business, brand and campaign so US carriers stop blocking your text messages.";

export const Route = createFileRoute("/_authenticated/a2p")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: A2pScreen,
});

const USE_CASES = [
  ["MIXED", "Mixed — a bit of everything"],
  ["CUSTOMER_CARE", "Customer care"],
  ["2FA", "Verification codes"],
  ["ACCOUNT_NOTIFICATION", "Account notifications"],
  ["MARKETING", "Marketing"],
  ["POLLING_VOTING", "Polling and voting"],
];

const INDUSTRIES = [
  "TECHNOLOGY",
  "PROFESSIONAL_SERVICES",
  "REAL_ESTATE",
  "HEALTHCARE",
  "FINANCIAL",
  "RETAIL",
  "HOSPITALITY",
  "EDUCATION",
  "TRANSPORTATION",
  "CONSTRUCTION",
  "NGO",
  "ENERGY",
];

const BUSINESS_TYPES = [
  "Sole Proprietorship",
  "Partnership",
  "Limited Liability Corporation",
  "Corporation",
  "Co-operative",
  "Non-profit Corporation",
];

function StepBadge({ state }: { state: string }) {
  if (state === "approved")
    return (
      <Badge className="bg-success/15 text-success text-[0.6rem]" variant="secondary">
        <Check className="mr-1 h-3 w-3" /> Approved
      </Badge>
    );
  if (state === "failed")
    return (
      <Badge variant="destructive" className="text-[0.6rem]">
        <TriangleAlert className="mr-1 h-3 w-3" /> Needs fixing
      </Badge>
    );
  if (state === "pending")
    return (
      <Badge variant="secondary" className="text-[0.6rem]">
        <CircleDashed className="mr-1 h-3 w-3" /> In review
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-[0.6rem]">
      Not started
    </Badge>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        className="h-11 rounded-2xl"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function A2pScreen() {
  const boot = useBootstrap();
  const status = useQuery({
    queryKey: ["a2p-status"],
    queryFn: () => a2pStatus(),
    enabled: boot.isOwner,
    retry: false,
    refetchOnWindowFocus: true,
  });
  const services = useQuery({
    queryKey: ["messaging-services"],
    queryFn: () => listMessagingServices(),
    enabled: boot.isOwner,
    retry: false,
  });
  // Per-number texting readiness, refreshed straight from the carrier campaign.
  const readiness = useQuery({
    queryKey: ["messaging-readiness"],
    queryFn: () => refreshMessagingReadiness(),
    enabled: boot.isOwner,
    retry: false,
  });

  const [biz, setBiz] = useState({
    legalName: "",
    businessType: "Limited Liability Corporation",
    industry: "TECHNOLOGY",
    registrationNumber: "",
    website: "",
    street: "",
    city: "",
    region: "",
    postalCode: "",
    country: "US",
    contactFirstName: "",
    contactLastName: "",
    contactEmail: "",
    contactPhone: "",
    contactTitle: "Owner",
  });
  const [registrationPath, setRegistrationPath] = useState<A2pPath>("low_volume_standard");
  const [confirmFees, setConfirmFees] = useState(false);
  const fees = A2P_FEE_SCHEDULE[registrationPath];
  const [camp, setCamp] = useState({
    messagingServiceSid: "",
    useCase: "MIXED",
    description: "",
    messageFlow: "",
    sampleOne: "",
    sampleTwo: "",
    hasEmbeddedLinks: false,
    hasEmbeddedPhone: false,
  });

  // Pre-fill from whatever was already submitted so the form can be corrected.
  useEffect(() => {
    const b = status.data?.business.input;
    if (b && Object.keys(b).length > 0) setBiz((prev) => ({ ...prev, ...b }));
    const c = status.data?.campaign.input;
    if (c && Object.keys(c).length > 0) setCamp((prev) => ({ ...prev, ...c }));
  }, [status.data]);

  const saveBusiness = useMutation({
    mutationFn: () => submitBusinessProfile({ data: { ...biz, registrationPath, confirmFees } }),
    onSuccess: async () => {
      await status.refetch();
      toast.success("Business profile submitted for review.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const saveBrand = useMutation({
    mutationFn: () => submitBrand({ data: { confirmFees } }),
    onSuccess: async () => {
      await status.refetch();
      toast.success("Brand submitted to the carriers.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const saveCampaign = useMutation({
    mutationFn: () => submitCampaign({ data: { ...camp, confirmFees } }),
    onSuccess: async () => {
      await status.refetch();
      toast.success("Campaign submitted. Carrier review usually takes a day or two.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!boot.isOwner) {
    return (
      <div className="px-6 py-20 text-center text-sm text-muted-foreground">
        This area is for the account owner.
      </div>
    );
  }

  const s = status.data;
  const numberRows = (readiness.data ?? []) as unknown as Array<{
    phoneNumber: string;
    campaignStatus: string | null;
    ready: boolean;
  }>;

  /** Plain-English reason a number still can't send US texts. */
  function readinessReason(n: { campaignStatus: string | null }): string {
    if (!s || s.overall === "not_started") {
      return "US texting approval hasn't been started for this account yet.";
    }
    if (s.overall === "blocked") return s.nextStep ?? "Approval needs attention.";
    if (!n.campaignStatus) return "This number hasn't been added to your approved texting group.";
    if (s.overall === "in_review") return "Waiting on approval \u2014 usually a day or two.";
    return "Not approved for US texting yet.";
  }

  const serviceList = (services.data ?? []) as unknown as Array<{
    sid: string;
    friendly_name: string;
  }>;

  return (
    <div className="pb-10">
      <ScreenHeader
        title="US texting registration"
        subtitle="Required before US carriers deliver your texts"
        action={
          <Link
            to="/advanced"
            className="key-raised grid size-9 place-items-center rounded-full text-muted-foreground"
            aria-label="Back to advanced"
          >
            <ArrowLeft className="size-4" />
          </Link>
        }
      />

      <PullToRefresh
        onRefresh={async () => {
          await Promise.all([status.refetch(), services.refetch(), readiness.refetch()]);
        }}
      />

      {s ? (
        <section className="px-4 pt-4">
          <div
            className={
              "glass-panel space-y-1 rounded-2xl border-l-4 p-4 " +
              (s.overall === "approved"
                ? "border-l-success"
                : s.overall === "blocked"
                  ? "border-l-destructive"
                  : "border-l-primary")
            }
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{s.headline}</p>
              <StepBadge
                state={
                  s.overall === "approved"
                    ? "approved"
                    : s.overall === "blocked"
                      ? "failed"
                      : s.overall === "in_review"
                        ? "pending"
                        : "todo"
                }
              />
            </div>
            {s.nextStep ? <p className="text-xs text-muted-foreground">{s.nextStep}</p> : null}
          </div>
        </section>
      ) : null}

      <section className="px-4 pt-4">
        <div className="glass-panel space-y-2 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Your numbers</h2>
            <button
              type="button"
              onClick={() => void readiness.refetch()}
              className="key-raised rounded-full px-3 py-1 text-[0.7rem] text-muted-foreground"
            >
              {readiness.isFetching ? "Checking\u2026" : "Recheck"}
            </button>
          </div>
          {numberRows.length ? (
            <ul className="divide-y divide-border/60">
              {numberRows.map((n) => (
                <li key={n.phoneNumber} className="space-y-0.5 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular">{n.phoneNumber}</span>
                    <span
                      className={
                        n.ready
                          ? "text-[0.7rem] font-medium text-success"
                          : "text-[0.7rem] text-muted-foreground"
                      }
                    >
                      {n.ready ? "Can text" : "Can't text yet"}
                    </span>
                  </div>
                  {n.ready ? null : (
                    <p className="text-[0.7rem] text-muted-foreground">{readinessReason(n)}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              {readiness.isError ? errorMessage(readiness.error) : "No numbers checked yet."}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3 px-4 py-4">
        <p className="text-xs text-muted-foreground">
          US phone companies only deliver business texts from numbers that have been approved. Three
          short steps: tell us about the business, register the business name, then describe the
          kind of texts you send.
        </p>
        {s?.blocked ? (
          <p className="glass-panel rounded-2xl p-3 text-xs text-destructive">{s.blocked}</p>
        ) : null}
        {status.isError ? (
          <p className="glass-panel rounded-2xl p-3 text-xs text-destructive">
            {errorMessage(status.error)}
          </p>
        ) : null}
        {s?.ready ? (
          <p className="glass-panel rounded-2xl p-3 text-xs text-success">
            Approved \u2014 {s.numbersInPool} number{s.numbersInPool === 1 ? "" : "s"} can text US
            phones.
          </p>
        ) : null}
      </section>

      <section className="space-y-3 border-t border-border px-4 py-4">
        <h2 className="font-display text-sm font-semibold">Registration path and fees</h2>
        <p className="text-xs text-muted-foreground">
          Submitting a brand charges real carrier fees. They are not refunded if vetting is
          declined. The original SixVox workspace is already approved and does not need to submit
          again.
        </p>
        <div className="space-y-1.5">
          <Label>Path</Label>
          <Select
            value={registrationPath}
            onValueChange={(value) => setRegistrationPath(value as A2pPath)}
          >
            <SelectTrigger className="h-11 rounded-2xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low_volume_standard">
                Low-Volume Standard (EIN required)
              </SelectItem>
              <SelectItem value="sole_proprietor">
                Sole Proprietor (no EIN, not for LLCs)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="glass-panel rounded-2xl p-3 text-xs text-muted-foreground">{fees.summary}</p>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={confirmFees}
            onChange={(event) => setConfirmFees(event.target.checked)}
          />
          <span>
            I am the workspace owner and I confirm these fees: ${fees.brandUsd.toFixed(2)} brand, $
            {fees.vettingUsd.toFixed(2)} vetting, from ${fees.monthlyFromUsd.toFixed(2)} per month.
          </span>
        </label>
      </section>

      {/* ------------------------------------------------ step 1: business */}
      <section className="space-y-3 border-t border-border px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold">1. Business profile</h2>
          <StepBadge state={s?.business.state ?? "todo"} />
        </div>
        {s?.business.detail && s.business.state === "failed" ? (
          <p className="text-xs text-destructive">{s.business.detail}</p>
        ) : null}
        <div className="space-y-3">
          <Field
            label="Legal business name"
            value={biz.legalName}
            onChange={(v) => setBiz({ ...biz, legalName: v })}
            placeholder="Exactly as registered"
          />
          <div className="space-y-1.5">
            <Label>Business type</Label>
            <Select
              value={biz.businessType}
              onValueChange={(v) => setBiz({ ...biz, businessType: v })}
            >
              <SelectTrigger className="h-11 rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Select value={biz.industry} onValueChange={(v) => setBiz({ ...biz, industry: v })}>
              <SelectTrigger className="h-11 rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replaceAll("_", " ").toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field
            label="EIN / Tax ID"
            value={biz.registrationNumber}
            onChange={(v) => setBiz({ ...biz, registrationNumber: v })}
            placeholder="12-3456789"
          />
          <Field
            label="Website"
            value={biz.website}
            onChange={(v) => setBiz({ ...biz, website: v })}
            placeholder="https://"
          />
          <Field
            label="Street"
            value={biz.street}
            onChange={(v) => setBiz({ ...biz, street: v })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="City" value={biz.city} onChange={(v) => setBiz({ ...biz, city: v })} />
            <Field
              label="State"
              value={biz.region}
              onChange={(v) => setBiz({ ...biz, region: v })}
              placeholder="TX"
            />
            <Field
              label="ZIP"
              value={biz.postalCode}
              onChange={(v) => setBiz({ ...biz, postalCode: v })}
            />
            <Field
              label="Country"
              value={biz.country}
              onChange={(v) => setBiz({ ...biz, country: v })}
              placeholder="US"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Contact first name"
              value={biz.contactFirstName}
              onChange={(v) => setBiz({ ...biz, contactFirstName: v })}
            />
            <Field
              label="Contact last name"
              value={biz.contactLastName}
              onChange={(v) => setBiz({ ...biz, contactLastName: v })}
            />
          </div>
          <Field
            label="Contact title"
            value={biz.contactTitle}
            onChange={(v) => setBiz({ ...biz, contactTitle: v })}
          />
          <Field
            label="Contact email"
            value={biz.contactEmail}
            onChange={(v) => setBiz({ ...biz, contactEmail: v })}
          />
          <Field
            label="Contact phone"
            value={biz.contactPhone}
            onChange={(v) => setBiz({ ...biz, contactPhone: v })}
            placeholder="+15558675310"
          />
          <Button
            className="key-signal h-11 w-full rounded-xl"
            onClick={() => saveBusiness.mutate()}
            disabled={saveBusiness.isPending || !confirmFees}
          >
            {s?.business.state === "todo" ? "Submit business profile" : "Resubmit business profile"}
          </Button>
        </div>
      </section>

      {/* --------------------------------------------------- step 2: brand */}
      <section className="space-y-3 border-t border-border px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold">2. Brand</h2>
          <StepBadge state={s?.brand.state ?? "todo"} />
        </div>
        <p className="text-xs text-muted-foreground">
          Sends the business profile to the carrier registry. There is a one-time carrier fee.
        </p>
        {s?.brand.detail ? <p className="text-xs text-muted-foreground">{s.brand.detail}</p> : null}
        <Button
          variant="secondary"
          className="h-11 w-full rounded-xl"
          onClick={() => saveBrand.mutate()}
          disabled={saveBrand.isPending || !confirmFees || s?.business.state !== "approved"}
        >
          {s?.brand.sid ? "Resubmit brand" : "Register brand"}
        </Button>
        {s?.business.state !== "approved" ? (
          <p className="text-[0.65rem] text-muted-foreground">
            Available once the business profile is approved.
          </p>
        ) : null}
      </section>

      {/* ------------------------------------------------ step 3: campaign */}
      <section className="space-y-3 border-t border-border px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold">3. Campaign</h2>
          <StepBadge state={s?.campaign.state ?? "todo"} />
        </div>
        {s?.campaign.detail && s.campaign.state === "failed" ? (
          <p className="text-xs text-destructive">{s.campaign.detail}</p>
        ) : null}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Sender pool</Label>
            <Select
              value={camp.messagingServiceSid}
              onValueChange={(v) => setCamp({ ...camp, messagingServiceSid: v })}
            >
              <SelectTrigger className="h-11 rounded-2xl">
                <SelectValue placeholder="Choose a Messaging Service" />
              </SelectTrigger>
              <SelectContent>
                {serviceList.map((x) => (
                  <SelectItem key={x.sid} value={x.sid}>
                    {x.friendly_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>What you send</Label>
            <Select value={camp.useCase} onValueChange={(v) => setCamp({ ...camp, useCase: v })}>
              <SelectTrigger className="h-11 rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USE_CASES.map(([value, label]) => (
                  <SelectItem key={value} value={value as string}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Campaign description</Label>
            <Textarea
              className="rounded-2xl"
              rows={3}
              value={camp.description}
              placeholder="What these messages are for, in plain English."
              onChange={(e) => setCamp({ ...camp, description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>How people opt in</Label>
            <Textarea
              className="rounded-2xl"
              rows={3}
              value={camp.messageFlow}
              placeholder="e.g. Customers give their number on our booking form and agree to receive texts."
              onChange={(e) => setCamp({ ...camp, messageFlow: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sample message 1</Label>
            <Textarea
              className="rounded-2xl"
              rows={2}
              value={camp.sampleOne}
              onChange={(e) => setCamp({ ...camp, sampleOne: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sample message 2</Label>
            <Textarea
              className="rounded-2xl"
              rows={2}
              value={camp.sampleTwo}
              onChange={(e) => setCamp({ ...camp, sampleTwo: e.target.value })}
            />
          </div>
          <div className="glass-panel flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5">
            <span className="text-xs">Messages can contain links</span>
            <Switch
              checked={camp.hasEmbeddedLinks}
              onCheckedChange={(v) => setCamp({ ...camp, hasEmbeddedLinks: v })}
            />
          </div>
          <div className="glass-panel flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5">
            <span className="text-xs">Messages can contain phone numbers</span>
            <Switch
              checked={camp.hasEmbeddedPhone}
              onCheckedChange={(v) => setCamp({ ...camp, hasEmbeddedPhone: v })}
            />
          </div>
          <Button
            className="key-signal h-11 w-full rounded-xl"
            onClick={() => saveCampaign.mutate()}
            disabled={saveCampaign.isPending || !confirmFees || s?.brand.state !== "approved"}
          >
            {s?.campaign.sid ? "Resubmit campaign" : "Register campaign"}
          </Button>
          {s?.brand.state !== "approved" ? (
            <p className="text-[0.65rem] text-muted-foreground">
              Available once the brand is approved.
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-2 border-t border-border px-4 py-4">
        <h2 className="font-display text-sm font-semibold">4. Numbers in the pool</h2>
        <p className="text-xs text-muted-foreground">
          {s?.numbersInPool
            ? `${s.numbersInPool} number${s.numbersInPool === 1 ? "" : "s"} attached to the registered pool.`
            : "No numbers attached yet — add them from Messaging Services on the Advanced screen."}
        </p>
      </section>
    </div>
  );
}
