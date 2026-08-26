/* SixVox web push worker. Messaging only — this worker never caches app assets. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "SixVox", body: event.data ? event.data.text() : "" };
  }

  // A finished call clears its ringing notification instead of showing one.
  if (payload.type === "call-ended") {
    event.waitUntil(
      (async () => {
        const open = await self.registration.getNotifications({ tag: payload.tag });
        for (const notification of open) notification.close();
        // Backstop: never leave a stale sticky ring behind.
        const rest = await self.registration.getNotifications();
        for (const notification of rest) {
          if (notification.data && notification.data.type === "call") notification.close();
        }
      })(),
    );
    return;
  }

  const isCall = payload.type === "call";
  const title = payload.title || "SixVox";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/notification-large.png",
    badge: "/notification-badge.png",
    image: payload.image || undefined,
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/inbox", type: payload.type || "message" },
    requireInteraction: Boolean(payload.requireInteraction),
    silent: false,
    vibrate: isCall ? [400, 200, 400, 200, 400] : [80, 40, 80],
    actions: isCall
      ? [
          { action: "answer", title: "Answer" },
          { action: "dismiss", title: "Dismiss" },
        ]
      : undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const data = event.notification.data || {};
  const base = data.url || "/inbox";
  const answering = data.type === "call" && event.action === "answer";
  const target = answering ? `${base}${base.includes("?") ? "&" : "?"}answer=1` : base;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = all.find((entry) => entry.url.startsWith(self.location.origin));
      if (client) {
        await client.focus();
        // Route client-side: a document navigation would reload the page and
        // destroy the Twilio device holding the ringing call.
        client.postMessage({
          type: "open-url",
          url: target,
          kind: data.type || "message",
          answer: answering,
        });
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

/* The app tells the worker to clear ring notifications once a call is handled in-app. */
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "clear-call-notifications") return;
  event.waitUntil(
    (async () => {
      const open = await self.registration.getNotifications();
      for (const notification of open) {
        const kind = notification.data && notification.data.type;
        if (kind === "call") notification.close();
      }
    })(),
  );
});