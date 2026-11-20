export type ChecklistStep = { id: string; title: string; hint: string; to: string; done: boolean };

/** First-week setup steps. Pure so the rules are testable. */
export function checklistSteps(input: {
  numbers: { webhook_wired?: boolean | null; answer_mode?: string | null }[];
  notificationsOn: boolean;
  installed: boolean;
}): ChecklistStep[] {
  const wired = input.numbers.some((n) => n.webhook_wired);
  const answering = input.numbers.some((n) => n.answer_mode && n.answer_mode !== "off");
  return [
    { id: "number", title: "Connect your business number", hint: "Calls and texts reach SixVox", to: "/numbers", done: wired },
    { id: "answer", title: "Choose who answers", hint: "Ring your phone, the AI receptionist, or both", to: "/receptionist", done: answering },
    { id: "notify", title: "Turn on notifications", hint: "Hear calls and see texts when the app is closed", to: "/settings", done: input.notificationsOn },
    { id: "install", title: "Add SixVox to your Home Screen", hint: "Opens like an app and rings like a phone", to: "/help", done: input.installed },
  ];
}
