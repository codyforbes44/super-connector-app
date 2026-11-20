import { beforeEach, describe, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({params:{} as Record<string,string>,rpc:vi.fn(),log:vi.fn()}));
vi.mock("@/lib/twilio-signature.server",()=>({verifyTwilioWebhook:async()=>({ok:true,params:state.params}),rejectWebhook:()=>new Response("Unauthorized",{status:401})}));
vi.mock("@/integrations/supabase/client.server",()=>({supabaseAdmin:{rpc:state.rpc}}));
vi.mock("@/lib/webhook-errors.server",()=>({logWebhookError:state.log}));
import { Route } from "./status";
describe("message delivery callback",()=>{
  beforeEach(()=>{state.params={MessageSid:"SM"+"a".repeat(32),MessageStatus:"delivered"};state.rpc.mockReset();state.rpc.mockResolvedValue({error:null});state.log.mockReset();});
  const invoke=async()=>{
    const handlers=Route.options.server?.handlers;
    if(!handlers || typeof handlers === "function") throw new Error("Missing handler map");
    const handler=handlers.POST;
    if(typeof handler!=="function")throw new Error("Missing POST handler");
    const response=await handler({request:new Request("http://localhost:8080/api/public/twilio/status",{method:"POST"})} as never);
    if(!(response instanceof Response))throw new Error("Expected response");
    return response;
  };
  it("persists a delivered receipt even before the message exists",async()=>{
    const response=await invoke();expect(response.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith("record_message_delivery",{p_sid:"SM"+"a".repeat(32),p_status:"delivered",p_error:null});
  });
  it("persists failed state and the actual carrier error",async()=>{
    state.params["MessageStatus"]="failed";state.params["ErrorCode"]="30003";
    await invoke();expect(state.rpc).toHaveBeenCalledWith("record_message_delivery",{p_sid:"SM"+"a".repeat(32),p_status:"failed",p_error:"30003"});
  });
  it("returns a retryable failure when saving the receipt fails",async()=>{
    state.rpc.mockResolvedValue({error:new Error("write failed")});
    expect((await invoke()).status).toBe(500);expect(state.log).toHaveBeenCalled();
  });
});