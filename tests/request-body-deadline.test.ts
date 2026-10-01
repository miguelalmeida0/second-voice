import test from "node:test";
import assert from "node:assert/strict";
import {readGhostwriterJsonBody} from "../src/server/ghostwriter-request.ts";
function request(body:ReadableStream<Uint8Array>){
 return new Request("https://example.invalid",{method:"POST",body,duplex:"half"} as RequestInit);
}
test("oversized body rejects even when stream cancellation never resolves",async()=>{
 const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(10001));},cancel(){return new Promise(()=>{});}});
 const result=await readGhostwriterJsonBody(request(stream));
 assert.equal(result.ok,false);
 if(!result.ok)assert.equal(result.status,413);
});
test("stalled body read has a total deadline",async(t)=>{
 t.mock.timers.enable({apis:["setTimeout"]});
 const result=readGhostwriterJsonBody(request(new ReadableStream<Uint8Array>()));
 t.mock.timers.tick(10000);
 const body=await result;
 assert.equal(body.ok,false);
 if(!body.ok)assert.equal(body.status,408);
});
test("normal bounded JSON remains accepted",async()=>{
 const response=await readGhostwriterJsonBody(new Request("https://example.invalid",{method:"POST",body:'{"text":"hello"}'}));
 assert.deepEqual(response,{ok:true,data:{text:"hello"}});
});
