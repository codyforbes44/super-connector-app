import { useQuery } from "@tanstack/react-query";
import { getMessageDeliveryStats } from "@/lib/twilio.functions";
export function MessageDeliveryPanel(){
  const stats=useQuery({queryKey:["message-delivery-stats"],queryFn:()=>getMessageDeliveryStats(),refetchInterval:30000});
  return <section className="space-y-3"><h2 className="font-semibold">Text delivery</h2>{stats.isError?<p className="text-destructive">Text delivery statistics unavailable.</p>:stats.data?<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{([['Sent',stats.data.sent],['Delivered',stats.data.delivered],['Pending',stats.data.pending],['Failed',stats.data.failed]] as const).map(([label,value])=><div key={label} className="border-b border-border p-3"><p className="text-lg font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div>:<p>Loading text delivery…</p>}</section>;
}