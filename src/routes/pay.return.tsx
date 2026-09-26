import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pay/return")({
  ssr: false,
  component: PayReturn,
  head: () => ({
    meta: [{ title: "Payment · SixVox" }, { name: "robots", content: "noindex" }],
  }),
});

function PayReturn() {
  const canceled =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("canceled");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <h1 className="font-display text-2xl font-semibold">
        {canceled ? "Payment canceled" : "Thanks — payment received"}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {canceled
          ? "No charge was made. You can ask for a new link if you still want to pay."
          : "The business will see the payment on the text thread. You can close this page."}
      </p>
    </main>
  );
}
