#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyticsReport,readAllAnalytics,readProfileAnalytics,pruneAnalytics} from '../src/lib/product-analytics.mjs';

const args=process.argv.slice(2);
function option(name) { const index=args.indexOf(name); return index<0 ? null : args[index+1]; }
const escape=value=>String(value??'—').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const table=(headers,rows)=>'<table><thead><tr>'+headers.map(h=>'<th>'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+escape(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
const seconds=value=>value==null?'—':(value/1000).toFixed(1)+'s';
if(args.includes('--help')) {
  console.log('node scripts/analytics-report.mjs [--root DATA_ROOT] [--profile PROFILE_ID] [--html OUTPUT]\nOutputs pseudonymous JSON or a self-contained HTML report. No network access.');
} else {
  const root=path.resolve(option('--root') || process.env.CAREER_OPS_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)),'../..'));
  if(args.includes('--prune')) await pruneAnalytics(root,Date.now(),true);
  const profile=option('--profile');
  const report=analyticsReport(profile ? [readProfileAnalytics(root,profile)] : readAllAnalytics(root));
  const htmlFile=option('--html');
  if(!htmlFile) console.log(JSON.stringify(report,null,2));
  else {
    const exits={};
    for(const user of report.journeys) for(const session of user.sessions) {const key=session.exitStep||'unknown';exits[key]=(exits[key]||0)+1;}
    const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Product Analytics</title><style>body{font:15px system-ui;margin:32px auto;padding:0 20px;max-width:1150px;color:#172a32;background:#f7f9fa}h1,h2{color:#173e40}table{border-collapse:collapse;width:100%;background:white;margin:16px 0;display:block;overflow:auto}td,th{padding:10px 14px;border-bottom:1px solid #e0e7e8;text-align:left;white-space:nowrap}th{background:#e9f0f1}details{background:white;padding:12px;margin:10px 0}small,p{color:#526268}</style><h1>Product Analytics</h1><p>'+escape(new Date(report.generatedAt).toISOString())+' · '+report.users+' 位匿名用户 · '+report.sessions+' 次会话 · '+report.events+' 条事件</p><p>保留最近六个自然月。按用户跨会话计算有序漏斗，不补齐缺失步骤。截断/过期事件：'+report.discardedEvents+'。</p><h2>首次价值漏斗</h2>'+
      table(['步骤','人数','上一步转化','登录用户占比','流失人数'],report.coreFunnel.map(row=>[row.step,row.users,row.conversionFromPrevious==null?'—':(row.conversionFromPrevious*100).toFixed(1)+'%',row.rateOfLoggedIn==null?'—':(row.rateOfLoggedIn*100).toFixed(1)+'%',row.droppedFromPrevious]))+
      '<h2>D1 Retention</h2><p>Europe/Paris 自然日：eligible '+report.d1Retention.eligibleD0Users+'，D1 returned '+report.d1Retention.d1ReturnedUsers+'，retention '+(report.d1Retention.rate==null?'—':(report.d1Retention.rate*100).toFixed(1)+'%')+'。</p>'+
      '<h2>Time to Value</h2>'+table(['指标','样本','p50','p90'],report.timeToValue.map(row=>[row.metric,row.samples,seconds(row.p50Ms),seconds(row.p90Ms)]))+
      '<details><summary>兼容旧 Funnel</summary>'+table(['步骤','人数','上一步转化','止步人数'],report.funnel.map(row=>[row.step,row.users,row.conversionFromPrevious==null?'—':(row.conversionFromPrevious*100).toFixed(1)+'%',row.droppedAfter]))+'</details>'+
      '<h2>AI Performance</h2>'+table(['流程','client p50','client p90','abandoned','client failed','server p50','server p90','server failed'],Object.entries(report.aiPerformance).map(([kind,v])=>[kind,seconds(v.clientP50Ms),seconds(v.clientP90Ms),v.abandonedRate==null?'—':(v.abandonedRate*100).toFixed(1)+'%',v.failedRate==null?'—':(v.failedRate*100).toFixed(1)+'%',seconds(v.serverP50Ms),seconds(v.serverP90Ms),v.failureRate==null?'—':(v.failureRate*100).toFixed(1)+'%']))+
      '<h2>AI 可见等待</h2><p>客户端前台等待段；离开表示停止观看，后台任务可能继续。不是模型执行总时间。</p>'+
      table(['任务','段数','p50','p90','完成','失败','离开','离开p50','离开p90'],Object.entries(report.aiWaits).map(([kind,v])=>[kind,v.segments,seconds(v.p50Ms),seconds(v.p90Ms),v.completed,v.failed,v.abandoned,seconds(v.abandonedP50Ms),seconds(v.abandonedP90Ms)]))+
      '<h2>服务端 AI 任务耗时</h2><p>任务创建到终态持久化，包含排队与非模型处理；含后台岗位分析。仅新完成/失败任务，不等于前台等待，也不是纯模型推理时间。</p>'+
      table(['任务','数量','完成','失败','p50','p90'],Object.entries(report.serverAiTasks).map(([kind,v])=>[kind,v.tasks,v.completed,v.failed,seconds(v.p50Ms),seconds(v.p90Ms)]))+
      '<h2>离开等待分布</h2>'+table(['任务','<5s','5–15s','15–30s','30–60s','60–120s','≥120s'],Object.entries(report.aiWaits).map(([kind,v])=>[kind,...v.abandonedBuckets.map(b=>b.count)]))+
      '<h2>会话最后观察到的步骤</h2><p>最后观察位置不等于永久流失；强制关闭可能没有最终退出事件。</p>'+table(['步骤','会话数'],Object.entries(exits))+
      '<h2>页面停留与滚动</h2>'+table(['页面','进入次数','前台停留','最深滚动'],report.pages.map(p=>[p.page,p.enters,seconds(p.visibleDurationMs),p.maxScrollDepth+'%']))+
      '<h2>点击</h2>'+table(['操作','次数'],report.clicks.map(c=>[c.action,c.count]))+
      '<h2>匿名用户旅程</h2>'+report.journeys.map(user=>'<details><summary>'+escape(user.userId)+' · '+user.completedOrderedSteps+'/8 步 · '+user.sessions.length+' 次会话</summary>'+user.sessions.map(session=>'<h3>'+escape(session.sessionId)+'</h3>'+table(['时间','事件','页面','操作/步骤','等待/停留','状态','滚动'],session.journey.map(e=>[new Date(e.timestamp).toISOString(),e.event,e.page,e.action||e.step,seconds(e.durationMs),e.status,e.scrollDepth==null?'—':e.scrollDepth+'%']))).join('')+'</details>').join('')+'</html>';
    fs.mkdirSync(path.dirname(path.resolve(htmlFile)),{recursive:true});
    fs.writeFileSync(htmlFile,html,'utf8');
    console.log('Analytics HTML: '+path.resolve(htmlFile));
  }
}
