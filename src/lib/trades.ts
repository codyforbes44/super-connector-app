import type { LucideIcon } from "lucide-react";
import { Droplets, Wind, Zap, Sparkles, Hammer, Trees, Warehouse } from "lucide-react";

export type TradeScenario = {
  /** Always shown to the reader so the scene is not mistaken for a customer story. */
  label: "Example";
  when: string;
  what: string;
};

export type TradePage = {
  slug: string;
  name: string;
  noun: string;
  icon: LucideIcon;
  title: string;
  description: string;
  headline: string;
  lede: string;
  scenarios: TradeScenario[];
  jobs: string[];
};

export const TRADES: TradePage[] = [
  {
    slug: "plumbers",
    name: "Plumbers",
    noun: "plumber",
    icon: Droplets,
    title: "Business phone for plumbers — SixVox",
    description:
      "A business line for plumbers that answers when you're under a sink, books the job, and texts back missed callers. 14-day trial.",
    headline: "The burst-pipe call gets answered while you're under a sink.",
    lede: "Homeowners call the first plumber who picks up. SixVox is the business line on your truck: it rings you, and the AI receptionist takes the job when you can't.",
    scenarios: [
      {
        label: "Example",
        when: "Under a sink",
        what: "A homeowner calls about a leak. Your hands are full. The receptionist asks for the address, what's leaking, and how soon they need someone.",
      },
      {
        label: "Example",
        when: "After hours",
        what: "A call at 9 p.m. about no hot water. The line still answers, and you see the summary in the morning instead of a blank voicemail.",
      },
    ],
    jobs: ["Leaks and clogs", "Water heaters", "Emergency calls", "Estimates"],
  },
  {
    slug: "hvac",
    name: "HVAC",
    noun: "HVAC tech",
    icon: Wind,
    title: "Business phone for HVAC — SixVox",
    description:
      "A business line for HVAC crews that picks up when you're on a roof or in an attic. AI receptionist, texts, and one inbox.",
    headline: "No more losing a no-cool call because you're on a roof.",
    lede: "A no-cool call in July does not wait. SixVox answers with your business number while you're on the unit, then leaves the address and the problem in your inbox.",
    scenarios: [
      {
        label: "Example",
        when: "On a roof",
        what: "You're changing a condenser. The phone in your pocket would have gone to voicemail. The receptionist takes the address and whether the house has no cool or no heat.",
      },
      {
        label: "Example",
        when: "Between jobs",
        what: "You call the customer back from the app with your business caller ID, not your personal cell.",
      },
    ],
    jobs: ["No cool / no heat", "Maintenance", "Install estimates", "After-hours emergencies"],
  },
  {
    slug: "electricians",
    name: "Electricians",
    noun: "electrician",
    icon: Zap,
    title: "Business phone for electricians — SixVox",
    description:
      "A business line for electricians that answers panel, outlet, and outage calls while you're on a job. Trial included.",
    headline: "Panel and outage calls don't die in voicemail.",
    lede: "You're in a panel or a crawl space. SixVox keeps the business number separate from your personal cell and answers when you can't get to the phone.",
    scenarios: [
      {
        label: "Example",
        when: "In a panel",
        what: "A homeowner calls about a dead circuit. The receptionist asks which rooms are out and whether they smell burning — so you know if it can wait.",
      },
      {
        label: "Example",
        when: "After you leave the job",
        what: "The missed call is in one inbox with the text thread, not split across a personal phone and a voicemail box.",
      },
    ],
    jobs: ["Outlets and panels", "Lighting", "Outages", "Remodel estimates"],
  },
  {
    slug: "cleaners",
    name: "Cleaners",
    noun: "cleaner",
    icon: Sparkles,
    title: "Business phone for cleaning businesses — SixVox",
    description:
      "A business line for solo cleaners and small crews. It answers booking calls while you're on a job and keeps texts in one inbox.",
    headline: "Recurring cleans get booked while you're still at the last house.",
    lede: "Cleaning calls come in while you're mid-job, gloves on. SixVox answers with your business number and keeps the request in the same inbox as your texts.",
    scenarios: [
      {
        label: "Example",
        when: "Mid-clean",
        what: "A new customer wants a recurring clean. The receptionist takes the address, home size, and the day they asked for.",
      },
      {
        label: "Example",
        when: "After hours",
        what: "Someone texts a photo of a kitchen they want cleaned. It lands on the business number, not your personal messages.",
      },
    ],
    jobs: ["Recurring cleans", "Move-out cleans", "One-time deep cleans", "Crew scheduling"],
  },
  {
    slug: "handyman",
    name: "Handyman",
    noun: "handyman",
    icon: Hammer,
    title: "Business phone for handymen — SixVox",
    description:
      "A business line for handymen who miss calls on the job. AI receptionist, missed-call follow-up, and a number that isn't your cell.",
    headline: "The honey-do list call doesn't go to your personal voicemail.",
    lede: "Handyman work is a string of short jobs. SixVox gives that work its own number and answers when you're on a ladder.",
    scenarios: [
      {
        label: "Example",
        when: "On a ladder",
        what: "A neighbor wants a door repaired and a faucet swapped. The receptionist captures both jobs and the address instead of a hang-up.",
      },
      {
        label: "Example",
        when: "Driving to the next stop",
        what: "You glance at the inbox and call back the urgent one first, with your business name on their caller ID.",
      },
    ],
    jobs: ["Punch lists", "Drywall and doors", "Fixtures", "Small repairs"],
  },
  {
    slug: "landscaping",
    name: "Landscaping",
    noun: "landscaper",
    icon: Trees,
    title: "Business phone for landscapers — SixVox",
    description:
      "A business line for lawn and landscape crews of 1–5. It answers estimate calls while you're on a mower.",
    headline: "Estimate calls get answered while the mower is running.",
    lede: "You can't hear the phone over equipment. SixVox answers the business line, takes the property address, and leaves you something you can call back.",
    scenarios: [
      {
        label: "Example",
        when: "On a mower",
        what: "A homeowner wants a weekly mow and a spring cleanup. The receptionist gets the address and which service they asked about.",
      },
      {
        label: "Example",
        when: "Saturday afternoon",
        what: "The call still gets answered after you've knocked off, and the summary is waiting when you check the phone.",
      },
    ],
    jobs: ["Weekly mowing", "Cleanups", "Planting", "Estimate requests"],
  },
  {
    slug: "garage-doors",
    name: "Garage doors",
    noun: "garage-door tech",
    icon: Warehouse,
    title: "Business phone for garage-door businesses — SixVox",
    description:
      "A business line for garage-door techs. It answers stuck-door calls when you're already on a job.",
    headline: "A stuck door at dinner time still reaches your business line.",
    lede: "Garage-door calls spike when a door won't close. SixVox answers if you're already under another door, and keeps that call off your personal cell.",
    scenarios: [
      {
        label: "Example",
        when: "Under a door",
        what: "Someone's opener died and the car is trapped. The receptionist notes the door type and whether anyone is stuck outside.",
      },
      {
        label: "Example",
        when: "After hours",
        what: "The line still picks up. You decide in the morning which calls were emergencies and which can wait for a weekday.",
      },
    ],
    jobs: ["Springs and openers", "Off-track doors", "New door estimates", "After-hours calls"],
  },
];

export function tradeBySlug(slug: string): TradePage | undefined {
  return TRADES.find((trade) => trade.slug === slug);
}
