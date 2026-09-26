// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { E911_ACK_LABEL } from "@/lib/compliance/disclosure";
import {
  clearE911NoticeDismissals,
  dismissE911Notice,
  handleE911AuthEvent,
} from "@/lib/compliance/e911-session";

import { E911Gate } from "./E911Gate";

const { getE911Gate, acknowledgeE911Disclosure, toast } = vi.hoisted(() => ({
  getE911Gate: vi.fn(),
  acknowledgeE911Disclosure: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/compliance.functions", () => ({
  getE911Gate,
  acknowledgeE911Disclosure,
}));

vi.mock("sonner", () => ({
  toast,
}));

let acknowledged = false;

function renderGate(userId: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <E911Gate userId={userId} />
    </QueryClientProvider>,
  );
}

async function shownDialog() {
  return screen.findByRole("dialog", { name: "911 limitations on SixVox" });
}

async function expectClosedWithoutAcknowledgment() {
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "911 limitations on SixVox" })).toBeNull();
  });
  expect(acknowledgeE911Disclosure).not.toHaveBeenCalled();
}

/** A new mount is what a route change does: the layout can remount, the module stays. */
async function expectStillDismissedAfterRemount(userId: string) {
  cleanup();
  const calls = getE911Gate.mock.calls.length;
  renderGate(userId);
  await waitFor(() => expect(getE911Gate.mock.calls.length).toBeGreaterThan(calls));
  expect(screen.queryByRole("dialog", { name: "911 limitations on SixVox" })).toBeNull();
  expect(acknowledgeE911Disclosure).not.toHaveBeenCalled();
}

describe("E911 disclosure gate", () => {
  beforeAll(() => {
    const element = Element.prototype as Element & {
      hasPointerCapture?: (pointerId: number) => boolean;
      setPointerCapture?: (pointerId: number) => void;
      releasePointerCapture?: (pointerId: number) => void;
    };
    element.hasPointerCapture ??= () => false;
    element.setPointerCapture ??= () => undefined;
    element.releasePointerCapture ??= () => undefined;
    HTMLElement.prototype.scrollIntoView ??= () => undefined;
  });

  beforeEach(() => {
    acknowledged = false;
    clearE911NoticeDismissals();
    getE911Gate.mockReset();
    acknowledgeE911Disclosure.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    getE911Gate.mockImplementation(async () => ({ acknowledged }));
    acknowledgeE911Disclosure.mockImplementation(async () => {
      acknowledged = true;
      return { ok: true };
    });
  });

  afterEach(() => {
    cleanup();
    clearE911NoticeDismissals();
  });

  it("shows the notice for an unacknowledged user", async () => {
    renderGate("user-1");
    const dialog = await shownDialog();
    expect(dialog).toBeTruthy();
    expect(screen.getByText(E911_ACK_LABEL)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "I understand" })).toHaveProperty("disabled", true);
    expect(acknowledgeE911Disclosure).not.toHaveBeenCalled();
  });

  it("closes from the X button without saving an acknowledgment", async () => {
    const user = userEvent.setup();
    renderGate("user-1");
    await shownDialog();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await expectClosedWithoutAcknowledgment();
    await expectStillDismissedAfterRemount("user-1");
  });

  it("closes from an outside click without saving an acknowledgment", async () => {
    const user = userEvent.setup();
    renderGate("user-1");
    await shownDialog();
    const overlay = document.querySelector('[data-state="open"].fixed.inset-0');
    if (!(overlay instanceof HTMLElement)) throw new Error("Missing dialog overlay");
    await user.click(overlay);
    await expectClosedWithoutAcknowledgment();
    await expectStillDismissedAfterRemount("user-1");
  });

  it("closes from Escape without saving an acknowledgment", async () => {
    const user = userEvent.setup();
    renderGate("user-1");
    await shownDialog();
    await user.keyboard("{Escape}");
    await expectClosedWithoutAcknowledgment();
    await expectStillDismissedAfterRemount("user-1");
  });

  it("shows again on a fresh load or the next sign-in, and stays closed for this one", async () => {
    const user = userEvent.setup();
    renderGate("user-1");
    await shownDialog();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await expectClosedWithoutAcknowledgment();

    cleanup();
    renderGate("user-2");
    expect(await shownDialog()).toBeTruthy();

    cleanup();
    clearE911NoticeDismissals();
    renderGate("user-1");
    expect(await shownDialog()).toBeTruthy();

    cleanup();
    dismissE911Notice("user-1");
    handleE911AuthEvent("SIGNED_IN");
    renderGate("user-1");
    await waitFor(() => expect(getE911Gate).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: "911 limitations on SixVox" })).toBeNull();

    cleanup();
    handleE911AuthEvent("SIGNED_OUT");
    renderGate("user-1");
    expect(await shownDialog()).toBeTruthy();
    expect(acknowledgeE911Disclosure).not.toHaveBeenCalled();
  });

  it("saves the acknowledgment from I understand", async () => {
    const user = userEvent.setup();
    renderGate("user-1");
    await shownDialog();
    expect(screen.getByRole("button", { name: "I understand" })).toHaveProperty("disabled", true);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "I understand" }));
    await waitFor(() => expect(acknowledgeE911Disclosure).toHaveBeenCalledOnce());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("911 acknowledgment saved."));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "911 limitations on SixVox" })).toBeNull();
    });
  });
});
