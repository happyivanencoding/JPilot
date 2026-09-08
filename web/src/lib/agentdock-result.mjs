// MCP tool-level errors are not successful empty results.
export function agentDockToolResult(result) {
  if (!result || typeof result !== 'object') throw new Error('AgentDock returned an empty tool response.');
  let data = result.structuredContent;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    const text = (Array.isArray(result.content) ? result.content : []).find(part => part?.type === 'text')?.text;
    if (!text) throw new Error('AgentDock returned no structured tool result.');
    try { data = JSON.parse(text); }
    catch { throw new Error('AgentDock: ' + String(text).slice(0,1000)); }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('AgentDock returned an invalid tool result.');
  if (result.isError || data.is_error || (data.error && !data.run_id)) {
    const detail = typeof data.error === 'string' ? data.error : data.message || data.error?.message || JSON.stringify(data.error || data);
    const code = data.code || data.error_code || '';
    throw new Error(`AgentDock${code ? ' [' + code + ']' : ''}: ${String(detail).slice(0,1400)}`);
  }
  return data;
}

// Resolve the matching response immediately; an SSE connection may stay open.
export async function readAgentDockRpcResponse(response, id) {
  if (!response.headers.get('content-type')?.includes('text/event-stream')) return response.json();
  if (!response.body) throw new Error('AgentDock returned an empty SSE response.');
  const reader=response.body.getReader(), decoder=new TextDecoder();
  let pending='',data=[];
  const dispatch=()=>{
    if(!data.length)return null;
    const raw=data.join('\n');data=[];
    const message=JSON.parse(raw);
    return message.id === id && ('result' in message || 'error' in message) ? message : null;
  };
  try {
    for(;;) {
      const chunk=await reader.read();
      pending+=decoder.decode(chunk.value || new Uint8Array(),{stream:!chunk.done});
      if(chunk.done && pending && !pending.endsWith('\n'))pending+='\n';
      let end;
      while((end=pending.indexOf('\n'))>=0) {
        const line=pending.slice(0,end).replace(/\r$/,'');pending=pending.slice(end+1);
        if(line.startsWith('data:'))data.push(line.slice(5).replace(/^ /,''));
        else if(line===''){const message=dispatch();if(message)return message;}
      }
      if(chunk.done){const message=dispatch();if(message)return message;break;}
    }
    throw new Error('AgentDock SSE ended without the requested RPC response.');
  } finally {await reader.cancel().catch(()=>{});}
}
