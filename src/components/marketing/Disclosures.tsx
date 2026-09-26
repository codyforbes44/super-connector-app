import { TRIAL_DAYS, TRIAL_LIMITS } from "@/lib/plans";

const E911_RULES = "https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-9/subpart-D";
const E911_FCC = "https://www.fcc.gov/911-dispatchable-location";
const A2P_UNREGISTERED = "https://www.twilio.com/docs/api/errors/30125";

export function E911Disclosure({ className }: { className?: string }) {
  return (
    <p className={className}>
      SixVox is an internet phone service (VoIP). A 911 call from it is not the same as a call from
      a traditional phone: it may not reach your local dispatch center, and it may not send your
      location. Do not use SixVox as your only way to reach emergency services.{" "}
      <a href={E911_RULES} className="font-medium text-primary underline underline-offset-4">
        47 CFR 9.11
      </a>
      {" · "}
      <a href={E911_FCC} className="font-medium text-primary underline underline-offset-4">
        FCC 911 dispatchable location
      </a>
      .
    </p>
  );
}

export function TextingDisclosure({ className }: { className?: string }) {
  return (
    <p className={className}>
      US carriers filter texts from numbers that are not registered for business texting. SixVox
      handles that registration (A2P 10DLC) on every plan. Texts can fail to deliver until the
      carrier approves it.{" "}
      <a href={A2P_UNREGISTERED} className="font-medium text-primary underline underline-offset-4">
        Unregistered sender details
      </a>
      .
    </p>
  );
}

export function TrialLimitsNote({ className }: { className?: string }) {
  return (
    <p className={className}>
      The {TRIAL_DAYS}-day trial includes {TRIAL_LIMITS.numbers} number, {TRIAL_LIMITS.seats} seat,
      and {TRIAL_LIMITS.aiCalls} AI receptionist calls. Cancel from Billing in the app. You keep
      access until the end of a period you have already paid for.
    </p>
  );
}
