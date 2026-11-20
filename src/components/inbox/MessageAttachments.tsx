import { useQuery } from "@tanstack/react-query";
import { getMessageAttachments } from "@/lib/twilio.functions";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function MessageAttachments({id,hasMedia}:{id:string;hasMedia:boolean}) {
  const media=useQuery({queryKey:["message-attachments",id],queryFn:()=>getMessageAttachments({data:{id}}),staleTime:600000,retry:false});
  if(media.isPending) return hasMedia ? <p className="mt-2 text-xs">Loading attachment…</p> : null;
  if(media.isError) return hasMedia ? <Button variant="ghost" size="sm" onClick={()=>void media.refetch()}><RefreshCw className="size-4"/>Attachment unavailable · Retry</Button> : null;
  return <div className="space-y-2">{media.data.map((item,index)=><a key={index} href={item.url} target="_blank" rel="noopener noreferrer" className="mt-2 block min-h-11" aria-label={`Open attachment ${index+1}`}>
    {item.contentType?.startsWith("image/") ? <img src={item.url} alt={`Picture attachment ${index+1}`} className="max-h-80 w-full max-w-80 rounded-lg object-contain"/> : item.contentType?.startsWith("video/") ? <video src={item.url} controls className="max-h-80 w-full"/> : item.contentType?.startsWith("audio/") ? <audio src={item.url} controls className="max-w-full"/> : <span className="underline">Open attachment {index+1}</span>}
  </a>)}</div>;
}