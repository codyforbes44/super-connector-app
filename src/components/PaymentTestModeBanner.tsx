const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="border-b border-destructive/40 bg-destructive/15 px-4 py-2 text-center text-xs text-destructive-foreground">
        Production checkout is not configured yet. Complete payments go-live to accept real
        payments.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="border-b border-border bg-accent/40 px-4 py-2 text-center text-xs text-muted-foreground">
        Payments are in test mode in the preview.{" "}
        <a
          href="https://docs.lovable.dev/features/payments#test-and-live-environments"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline"
        >
          Read more
        </a>
      </div>
    );
  }
  return null;
}
