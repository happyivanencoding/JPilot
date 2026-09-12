# V1 Product Analytics

Onward / JobPilot 独立 V1 的 Product Analytics 只回答第一轮商业验证需要的问题：用户有没有真正完成 CV、看到岗位、读懂岗位分析、尝试并成功生成岗位 CV，以及第二天是否回来。Android 与 Web 共用同一事件契约；原始 telemetry 仍由 JobPilot V1 保存，Project OS 只读聚合展示，不是第二个 source of truth。

## 隐私与身份边界

客户端只向 `POST /api/analytics` 发送有界事件。服务端必须验证当前 V1 bearer/cookie session，并从会话派生 Profile；body、Profile cookie 和未签名 gateway header 都不能指定 telemetry 身份。

禁止进入 telemetry 的内容：email、raw Profile ID、CV 文本、岗位正文、URL、用户输入、secret。每个 Profile 在私有目录 `.career-ops-web/analytics/<sha256-profile>/events.json` 对应一个随机 pseudonymous `userId`。岗位级阅读去重使用客户端本地 SHA-256 后截取的 opaque `contextId`；只用于“同一匿名用户 / 同一岗位”去重，服务端不会收到原始岗位 URL。

Analytics 写失败永远不能改变业务任务结果。

## Canonical page taxonomy

Android / Web 新产生的数据统一使用：

`onboarding_email`, `onboarding_upload`, `onboarding_analysis`, `onboarding_direction`, `onboarding_search`, `onboarding_results`, `home`, `offers`, `profile`, `profile_analysis`, `task_center`, `task_detail`, `job_report`, `compare`, `cv_edit`, `job_match`, `job_cv`, `job_tracking`, `pdf`。

报表层继续兼容历史 token，例如：`login → onboarding_email`、`upload → onboarding_upload`、`analysis_wait → onboarding_analysis`、`directions → onboarding_direction`、`search_wait → onboarding_search`、`first_results → onboarding_results`、`opportunities → offers`、`cv_preview → pdf`。未知 page token 会被拒绝，避免 taxonomy 再次漂移。

## V1 核心 KPI：唯一口径

### Upload attempted

`upload_cv` 保留为历史 funnel / 上传尝试信号。它只说明用户已经发起上传，不代表系统已经成功读取 CV。

### CV Ready

`cv_ready` 是服务端 product milestone，不由按钮点击产生。

定义：backend 已成功读取/解析 CV，并在当前 Profile 的 canonical Candidate 存储中持久化了一个可供后续分析使用的有效 CV。V1 auto-import 在 `saveImportedCv()` 成功返回后记录；显式确认导入也在 `saveCanonicalCv()` 成功后记录。失败的解析、空文件、只创建 ingest task 都不算 CV Ready。

### Jobs Seen

报表中的 `jobs_seen` 来自兼容 funnel step `view_jobs`，但客户端只有在岗位结果已经真实存在时才发出。进入空的 loading / 空 Offers 页面不计数。

### Job Opened

`job_opened` 来自 `open_job`，表示匿名用户实际打开岗位详情。

### Analysis Read

不把打开岗位等同于阅读分析。报表在已有 page lifecycle 数据上派生 `analysis_read`：同一匿名用户 / 同一岗位的 `job_match` 前台累计有效停留时间达到 **8 秒**，或最大滚动深度达到 **50%**，任一满足即记一次。新客户端用 opaque `contextId` 跨 session 去重，同一用户反复打开同一岗位仍只算一次；旧的无 context 历史数据只能按 session 做 best-effort 兼容。

### CV Generate Started

用户主动发起岗位 CV 生成记录 `generate_cv_started`。旧数据里的 `generate_cv` 继续兼容，不重写历史事件。

### CV Generate Completed / Failed

成功与失败只认服务端真实 `kind=cv` 任务终态：

- `cv_completed`：岗位 CV task 已 completed，且现有业务链已经确认真实 draft/PDF 存在。
- `cv_failed`：同一类 task 真实 failed。

前端点击、预计进度、`cv_review` 完成都不能冒充“成功生成 CV”。

## 核心 Funnel

报表单独输出：

`CV Ready → Jobs Seen → Job Opened → Analysis Read → CV Generate Started → CV Generate Completed`

每个后续阶段必须在同一 pseudonymous user 的前一阶段之后出现；跨 session 连续计算。Dashboard 同时显示每层人数、相对前一步转化率、相对登录用户占比和 drop-off。原来的 8 步 funnel 仍保留为兼容诊断，不再是 V1 商业验证的主漏斗。

## D1 Retention

统一时区：**Europe/Paris**。

- Day 0：该匿名用户第一次达到 `cv_ready` 的巴黎自然日。
- D1 returned：用户在 Day 0 的下一个巴黎自然日产生至少一个真实前台 `page_enter` 或 `page_heartbeat`。
- `server_ai_task`、后台 task 完成、纯服务端刷新不算回访。
- denominator 只包含已经经历完整 D1 自然日窗口的 D0 用户。今天或昨天刚完成 Day 0、完整次日尚未结束的人不会被提前判定流失。

输出：`eligibleD0Users`, `d1ReturnedUsers`, `rate`。

## Time to Value

只输出 p50 / p90，不用 average 掩盖长尾：

- `login_to_cv_ready`
- `cv_ready_to_jobs_seen`
- `login_to_jobs_seen`
- `login_to_first_job_opened`
- `first_job_opened_to_analysis_read`

每项同时输出有效样本数。

## AI Performance

客户端 `ai_wait` 仍表示**用户实际可见的前台等待段**，不是 provider 推理时间。App 切后台结束该可见等待段并记 `abandoned`；后台任务本身可以继续。

服务端 `server_ai_task` 表示 task created → terminal persistence，包含排队和非模型处理。新数据保留真实 `taskKind`，因此 Dashboard 可以区分：

- CV Analysis
- Search
- Job Analysis (`deep_match`)
- CV Generation (`cv`，不混入 `cv_review`)

每项显示：client p50、client p90、abandoned rate、client failed rate、server p50、server p90、server failure rate。旧 server 事件没有 `taskKind` 时继续 best-effort 兼容；不会回填或重跑历史 AI。

## Anonymous User Journey

每个 pseudonymous tester 可看到：first seen、每次 session、page path、前台停留、最大 scroll、funnel milestones、AI wait、最后页面、CV Ready / Jobs Seen / opened count / Analysis Read count / CV started / generated / failed，以及 D1 eligible / returned。

Journey 永远不展示 email、CV、raw Profile ID、岗位正文或用户输入。

## Storage / retention

- 默认保留最近 30 天。
- 每个 Profile 最多 20,000 条事件。
- event ID 重试幂等；server/client namespace 和 event type 共同参与去重。
- 每小时有新 ingestion 时物理 prune；也可运行 `node scripts/analytics-report.mjs --root /data --prune`。
- cap / retention 丢弃数量通过 `discardedEvents` 报告。

CLI：

```sh
node scripts/analytics-report.mjs --root /data
node scripts/analytics-report.mjs --root /data --profile PROFILE_ID
node scripts/analytics-report.mjs --root /data --html /private/analytics.html
node scripts/analytics-report.mjs --root /data --prune
```

## Project OS internal read

没有公共 `/api/analytics/all`。JobPilot V1 只提供 owner-internal、read-only 的 `GET /api/internal/analytics`：必须使用服务器私有 bearer secret，默认 `Cache-Control: no-store`，返回 aggregate + pseudonymous journeys，不返回 Candidate 私人身份/内容。

部署建议使用 `JOBPILOT_ANALYTICS_INTERNAL_SECRET_FILE` 指向私有只读 secret。Project OS backend 持有同一私有凭据并 server-to-server 查询；浏览器只访问 Project OS 自己的受认证 `/api/projects/<JobPilot>/analytics?dashboard=v1`，永远拿不到 secret。Project OS 不持久化另一份 Analytics 数据。

Project OS 的 Analytics 页带 Dashboard 版本选择器。本轮唯一真实版本是 **V1**；以后 V2/V3 有独立真实口径后再增加选项，不预建空数据源。

## Validation fixture

`tests/product-analytics-fixture.test.mjs` 使用纯 synthetic telemetry：

- User A：完成全部 funnel，D1 回访。
- User B：CV Ready / Jobs Seen / Job Opened，2 秒离开，不算 Analysis Read。
- User C：阅读 12 秒，点击生成 CV，服务端生成失败。
- User D：不足 8 秒但 scroll 75%，算 Analysis Read。

它锁定 funnel、同岗位阅读去重、CV success/failure、Paris D1 完整窗口、Time-to-Value、旧页面 normalization 与隐私 context 边界，不进入 production 数据，也不触发 AI。
