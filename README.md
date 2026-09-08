# JPilot

JPilot 是一个 **Android-first** 的 AI 求职产品。原生 Android 客户端是产品功能、交互、信息架构和视觉体验的唯一前端基线；Web 客户端只负责在浏览器中复刻当前 Android 体验，不再维护独立的桌面工作台或 Classic UI。

## 开发仓库

唯一开发仓库：

**https://github.com/happyivanencoding/JPilot**

本地 `C:\dev\career-ops` 的 `origin` 必须指向该仓库。`santifer/career-ops` 仅是历史代码来源和许可证归属参考，不再是 JPilot 的产品上游，也不得通过旧 updater 覆盖当前实现。

## 产品结构

- `android/` — **产品前端权威**。新功能和 UX 决策优先以原生 Android 为准。
- `web/` — Android 的 phone-first Web 镜像，同时承载当前本地 backend/API。Web 不应另起一套交互模型。
- `shared/` — Android 与 Web 共用的产品资源，例如 UI 多语言词典。
- 根目录的扫描、tracker、PDF、CV、provider、部分 `modes/` / `templates/` — 从 Career-Ops 继承但仍被 JPilot backend 实际调用的兼容引擎。它们是实现依赖，不是产品设计权威。
- `docs/` — 当前 JPilot 架构、Android/Web 交接、验收和实验结论。

更完整的目录边界见 [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md)。任何修改前先读取 `DEEP_CONTEXT_HANDOFF_FINAL.md`。

## 前端原则

1. Android 决定导航、页面结构、核心交互、状态呈现和视觉语言。
2. Web 跟随 Android；不得重新引入旧 Career-Ops 侧栏、TUI/Workbench 或桌面后台。
3. Android 与 Web 共用同一 Candidate、岗位、评估、CV、任务和 tracker 数据，不创建平行数据库。
4. App/UI 语言与求职材料语言彼此独立；当前约束见 [`docs/ANDROID_LANGUAGE_SEPARATION.md`](docs/ANDROID_LANGUAGE_SEPARATION.md)。

## AI transport

JPilot 的业务层不依赖 coding agent。正式评估、CV 分析/教练、历史结果翻译和定制 CV 都通过统一的 model transport adapter 调模型；Prompt、文件读取、岗位抓取、任务编排和持久化由 JPilot backend 自己负责。

当前生产默认使用 **OpenAI direct API (`gpt-5.6-luna / low`)**。本机只保存一个指向私有 key 文件的 ignored `.env.local` 配置；API key 本身不得进入 Git。AgentDock/ACP 只保留为可替换 transport fallback，不再是产品业务逻辑的一部分。

## 本地开发

### Android

```powershell
cd C:\dev\career-ops\android
.\gradlew.bat assembleDebug
```

### Web / backend

```powershell
cd C:\dev\career-ops\web
npm ci
npm run typecheck
npm test
npm run build
```

生产 Web 仍按现有本地服务与 gateway 方式运行；不要为了开发把 Candidate 数据、密钥或认证会话迁移到 Git。

## 数据与隐私

真实 Candidate CV、Profile、岗位追踪、报告、生成 PDF、运行任务、QA 截图、API key 和认证状态均属于本地私有数据。具体边界见 [`DATA_CONTRACT.md`](DATA_CONTRACT.md)。

## License

JPilot 自有代码采用 **AGPL-3.0-only**，完整文本见 [`LICENSE`](LICENSE)。从 Career-Ops 继承的代码继续保留其原 MIT 许可证通知，见 [`LICENSES/career-ops-MIT.txt`](LICENSES/career-ops-MIT.txt) 和 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。清理历史文件时不得删除仍适用的第三方许可证与版权声明。
