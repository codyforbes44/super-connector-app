/** Greeting seeded from the business details collected during onboarding. */
export function prefillAiGreeting(input: {
  businessName: string;
  website?: string | null;
  hours?: string | null;
}): string {
  const name = input.businessName.trim() || "our team";
  const hours = input.hours?.trim();
  const website = input.website?.trim();
  const parts = [`Thanks for calling ${name}.`];
  if (hours) parts.push(`Our hours are ${hours}.`);
  parts.push(
    "This is the assistant. Tell me how we can help, or leave a message and we'll call you back.",
  );
  if (website) parts.push(`You can also visit ${website}.`);
  return parts.join(" ");
}
