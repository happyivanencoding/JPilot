import '../scripts/register-source-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const {runTranslationTransport,prewarmTranslationTransport}=await import('../src/lib/model-transport.ts');

test('display translation uses GPT-5.6 Luna with reasoning disabled and the OpenAI credential',async()=>{
  const previous={
    key:process.env.OPENAI_API_KEY,
    url:process.env.JOBPILOT_OPENAI_CHAT_URL,
    deepseek:process.env.DEEPSEEK_API_KEY,
  };
  let received=null;
  const server=http.createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    received={authorization:req.headers.authorization,body:JSON.parse(raw)};
    res.writeHead(200,{'Content-Type':'application/json','x-request-id':'translation-test'});
    res.end(JSON.stringify({choices:[{message:{content:'{"translations":[{"id":"0","text":"Bonjour"}]}'}}],usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30,completion_tokens_details:{reasoning_tokens:0}}}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    process.env.OPENAI_API_KEY='openai-fixture-key';
    process.env.JOBPILOT_OPENAI_CHAT_URL=`http://127.0.0.1:${server.address().port}/v1/chat/completions`;
    delete process.env.DEEPSEEK_API_KEY;
    await prewarmTranslationTransport();
    let final='';let metrics;
    const result=await runTranslationTransport({prompt:'Return JSON translations.',timeoutMs:5_000,onText:()=>{},onFinalText:text=>{final=text;},onMetrics:value=>{metrics=value;}});
    assert.equal(result.status,'completed');
    assert.equal(received.authorization,'Bearer openai-fixture-key');
    assert.equal(received.body.model,'gpt-5.6-luna');
    assert.equal(received.body.reasoning_effort,'none');
    assert.equal(received.body.response_format.type,'json_object');
    assert.match(final,/Bonjour/);
    assert.equal(metrics.model,'gpt-5.6-luna');
    assert.equal(metrics.reasoning,'none');
    assert.equal(metrics.transport,'openai-direct');
    assert.equal(metrics.reasoningTokens,0);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    if(previous.key===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous.key;
    if(previous.url===undefined)delete process.env.JOBPILOT_OPENAI_CHAT_URL;else process.env.JOBPILOT_OPENAI_CHAT_URL=previous.url;
    if(previous.deepseek===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=previous.deepseek;
  }
});
