# JPilot Data Contract

JPilot 是 local-first 产品。Git 仓库保存产品代码与公开配置模板；真实求职数据、模型运行记录、凭据和私有验收证据留在本机。

## 1. 私有 Candidate / Runtime 层

下列内容不得因为代码清理、重构、更新或 Git 操作被覆盖、迁移到仓库或批量删除：

- `cv.md`
- `config/profile.yml`
- `modes/_profile.md`、`modes/_custom.md`、`modes/_brief.md`
- `portals.yml`
- `data/applications.md`、`data/applications.db`、`data/candidatures.json`、`data/profiles.json`、`data/pipeline.md`、`data/scan-history.tsv`、`data/pdf-index.tsv` 以及其他真实 tracker/runtime 数据
- `reports/` 中的真实岗位评估
- `output/` 中的真实 CV/PDF/HTML
- `jds/` 中的私有岗位材料
- `documents/` 中的简历、证明、导出文件
- `interview-prep/`、`writing-samples/` 中的个人内容
- `.career-ops-web/` 下的 Profile、task、CV history/draft、localization cache、benchmark/QA、session/runtime 等私有状态
- `web/.env.local`、根 `.env*` 中的本地 secrets（公开 example 除外）
- Android `local.properties`、本机 keystore/签名材料、Cloudflare/gateway session、API key
- Web/Android build 输出、日志和临时运行文件

这些文件大多已经通过 `.gitignore` 隔离；忽略规则本身不是删除许可。

## 2. Profile 隔离

`data/profiles.json` 定义当前本机可用 Profile 与各自 canonical 文件位置。所有 backend/API/AI 操作必须以显式 Profile 为边界，不能把一个人的 CV、配置、分析、岗位、任务或报告混入另一个 Profile。

任何批量清理都必须避开 `.career-ops-web/profiles/`、真实 `data/`、`reports/`、`output/` 和 Profile 指向的 Candidate 文件。

## 3. 产品代码层

可以进入 Git 的内容包括：

- `android/` 原生客户端代码与公开资源
- `web/` 当前 Android parity Web 与 backend/API 代码
- `shared/` 共享产品资源
- 当前 JPilot docs、测试和构建配置
- `web/src/lib/backend/` 文件与 PDF 服务、`web/src/lib/job-search/` 自有搜索适配器等当前 JobPilot 实现
- `LICENSE`、`LICENSES/`、`THIRD_PARTY_NOTICES.md` 等许可文件

旧的 root CLI、provider/plugin catalog、mode Prompt 和 CV template 执行引擎已被替换。不能为了旧目录名清理而删除同目录中的 ignored 私有数据；系统运行不再要求 Candidate 数据目录同时包含代码。

## 4. 历史上游文件的处理原则

`santifer/career-ops` 不再是 JPilot 的产品上游。旧的社区运营、Manifesto/Hired Wall、npm 发布、多 CLI onboarding、旧桌面/TUI、宣传素材、upstream updater 等若与当前 JPilot 运行无关，可以删除。

删除前应检查真实引用；如果删除会导致当前 Android/Web/backend build、产品测试或合法许可归属失效，则先保留或先完成依赖抽离。

## 5. 写入规则

- Candidate 主 CV、Profile、candidature、tracker、report 等写入继续走现有 JPilot backend 的 canonical writer/lock/version 机制，不绕过它们手改。
- UI 语言切换不得改写 CV 或业务事实。
- 接受 CV 草稿前必须保留现有 preview/version/confirmation 语义。
- 自动化验收优先使用 synthetic fixture；若必须读取真人数据，应保持只读并证明没有业务写操作。

## 6. Git 规则

唯一开发仓库为 `https://github.com/happyivanencoding/JPilot`。

不得把私有 Candidate/Runtime 层加入 Git。不得用 reset/clean/stash 等方式“整理”工作区。删除 tracked 历史文件时，必须保留适用的 MIT/第三方许可证和 attribution。


## V1 preview upload consent (2026-09-11)

In the isolated per-session V1 preview, choosing a CV file in the explicit upload control authorizes saving the extracted **original** text to that session's own Profile. There is no second raw-text confirmation screen. Source-language and insight-language preferences accompany that upload. This does not authorize invented/AI-rewritten facts: tailored CV drafts retain explicit keep/reject, and one Profile's upload never writes another Profile's canonical files. Preview sign-in creates empty files rather than cloning a pre-existing candidate. Legacy/production import confirmation remains unchanged until that product line is intentionally migrated.

## V1 original CV file authority (2026-09-12)

For V1 uploads, the uploaded source file and the processed Candidate representation have different roles:

- The file selected by the user is retained as the immutable **original CV file** for that upload. “View original CV” must return those original bytes; it must not silently rebuild the document from extracted text or a later template.
- Extracted/canonical CV text may still be normalized, analyzed or edited for matching and for generating new role-specific CVs. Those processing steps do not replace the original uploaded file.
- A role-specific CV is a newly generated document and may use the current processed Candidate evidence. Its “Original CV” comparison should use the upload that is the ancestor of that Candidate version when the original is a PDF.
- A later explicit CV upload establishes a new original source for subsequent Candidate versions. Derived config/notes/CV revisions continue to point back to the nearest uploaded ancestor.
- PDF originals are displayed directly from the exact uploaded bytes. DOCX/TXT/MD originals remain exact files for download/share rather than being mislabeled as an unchanged PDF preview.

This source-file rule is presentation/data provenance. It does not authorize rewriting Candidate facts and does not change the keep/reject contract for generated CV drafts.
