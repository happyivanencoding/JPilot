import test from 'node:test';
import assert from 'node:assert/strict';
import {readAgentDockRpcResponse} from '../src/lib/agentdock-result.mjs';
test('RPC resolves matching SSE response without waiting for the stream to close',async()=>{
 let cancelled=false;
 const encoder=new TextEncoder();
 const response=new Response(new ReadableStream({start(c){
   c.enqueue(encoder.encode('data: {"jsonrpc":"2.0","method":"notifications/progress"}\n\n'));
   c.enqueue(encoder.encode('data: {"jsonrpc":"2.0","id":6,"result":"unrelated"}\n\n'));
   c.enqueue(encoder.encode('data: {"jsonrpc":"2.0","id":7,\n'));
   c.enqueue(encoder.encode('data: "result":{"message":"terminé"}}\n\n'));
 },cancel(){cancelled=true;}}),{headers:{'content-type':'text/event-stream'}});
 const actual=await readAgentDockRpcResponse(response,7);
 assert.equal(actual.result.message,'terminé');assert.equal(cancelled,true);
});
test('ordinary JSON and RPC error SSE envelopes are preserved',async()=>{
 assert.deepEqual(await readAgentDockRpcResponse(Response.json({id:1,result:{ok:true}}),1),{id:1,result:{ok:true}});
 const response=new Response('data: {"id":2,"error":{"code":-1,"message":"Unavailable"}}\n\n',{headers:{'content-type':'text/event-stream'}});
 assert.equal((await readAgentDockRpcResponse(response,2)).error.message,'Unavailable');
});
