---
title: 内容提炼面板（标签 / 话题 / TODO）
date: 2026-11-14
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
status: implementation
---

## Goal Capsule

**Objective:** 在当前分组里，偶发打开一个 Header「提炼」入口，就能扫到未解决问题与相关标签/话题，并一键跳到原文行——不必全文搜索或逐文件翻。

**Means:** Header 按钮 + 下拉浮层；只读索引（TODO / `#tag` / `[[wiki]]`）；点击跳转；不做文件列表过滤。

**Product authority:** `STRATEGY.md` 阅读/review 轨道；只读展出面（不做应用内编辑）。多格式文档（PDF/白板等）与侧栏过滤不在本计划范围。

**Open blockers:** 无（规划前无未决产品问题）。

## Product Contract

### Summary

为偶发「看一眼未解决 / 未来方向」提供结构化横切索引：当前分组内收集 TODO、标签与 wiki 话题，从 Header 浮层点选后跳到文件与行。交互对标全局搜索的「点结果即跳」，不做侧栏过滤。

### Problem Frame

Agent 与人写的 Markdown 里散落着 `- [ ]`、`#tag`、`[[topic]]`。今天只能靠记忆或全文搜索；偶发 review 时成本高、漏看多。需要的是轻量二次提炼，而不是 Logseq 式知识库。

### Key Decisions

- **三者合一入口** — 同一浮层分 Tab，不拆成三个功能。`(session-settled: user-directed — chosen over 先做单一分面: 要一起定需求)` · Governs R1
- **话题 = `[[wiki 链]]`** — 与现有 wiki 语法一致。`(session-settled: user-directed — chosen over 标题簇等其它话题定义: 用户明确指定)` · Governs R4
- **布局 D1：Header 按钮 + 下拉浮层** — 适合偶发使用，不常驻占版面。`(session-settled: user-directed — chosen over 左侧叠层/右侧码头/全宽条带: 视觉草图后选定)` · Governs R1
- **仅当前分组** — 扫描范围与侧栏当前组一致。`(session-settled: user-directed — chosen over 整会话/可切换: 降低噪音)` · Governs R2
- **v1 只要跳转，不要过滤文件** — 改掉先前的「过滤+跳转」。`(session-settled: user-directed — chosen over 过滤侧栏或轻量过滤开关: 跳转用得最多)` · Governs R6
- **TODO 默认未完成，可切换显示已完成** — `(session-settled: user-directed — chosen over 仅未完成或混排无开关: 需要回顾已完成但默认聚焦未解决)` · Governs R3
- **标签 = 正文 `#tag#` + frontmatter `tags`** — 正文需两端 `#` 以免误伤代码；后改为 `#tag#`（user-directed）。· Governs R5
- **打开默认落在 TODO Tab** — 最贴「未解决问题」的偶发用途。`(session-settled: user-approved — chosen over 默认标签/话题 Tab: 综合确认时提出，用户继续采纳)` · Governs R1

### Requirements

**入口与范围**

- **R1.** Header 提供「提炼」入口；打开后为下拉浮层，含 TODO / 标签 / 话题三个 Tab；默认选中 TODO。
- **R2.** 索引仅覆盖**当前分组**内已加载的 Markdown 文件；切换分组后索引对应该组。

**收集规则**

- **R3.** TODO Tab：收集 GFM 任务列表项；默认只列未完成 `- [ ]`；用户可切换显示已完成 `- [x]`；每条展示可读文本与来源文件提示。
- **R4.** 话题 Tab：仅收集正文中的 `[[wiki]]` 双括号（含 pipe）；**不**收集 `[text](url)`；代码块内忽略。
- **R5.** 标签 Tab：收集正文行内 `#tag#`（两端 `#` 定界，代码块内忽略）以及 frontmatter 中的 `tags` 字段（数组或等价列表）。
- **R7.** 提炼只读：不在应用内勾选任务、不改标签或 wiki；改文件仍交给外部编辑器 / agent。

**导航**

- **R6.** 点击任一条目：打开对应文件（必要时切组内文件）并跳到该出现位置附近；行为对标全局搜索结果跳转。不提供「过滤侧栏文件列表」。
- **R8.** 关闭浮层或再次点 Header 入口可收起；无活动「过滤态」需要清理。

### Key Flows

1. **偶发扫一眼：** 打开当前分组文档 → 点 Header「提炼」→ 默认看未完成 TODO → 点一条 → 正文跳到该行 → 可关浮层继续读。
2. **按标签/话题定位：** 打开浮层 → 切到标签或话题 Tab → 点一项 → 跳到首次（或所列）出现位置。
3. **回顾已完成：** TODO Tab 打开「显示已完成」→ 浏览已勾选项 → 跳转同上。

### Acceptance Examples

- **AE1.** 当前组有 3 个文件、共 5 条未完成 TODO：打开提炼默认 TODO Tab 可见这 5 条；点其中一条跳到正确文件与行。Covers R1, R2, R3, R6
- **AE2.** 某文件 frontmatter `tags: [security]` 且正文有 `#security`：标签 Tab 能聚到 `security`（去重展示）；点击可跳到正文或文档内可定位的出现处。Covers R5, R6
- **AE3.** 正文有 `[[auth]]`：话题 Tab 出现对应项；代码块内的 `[[auth]]` 不出现。Covers R4
- **AE4.** 切换到另一分组后打开提炼：列表只反映新分组内容。Covers R2
- **AE5.** 浮层内无法把 `- [ ]` 勾成已完成（只读）。Covers R7

### Scope Boundaries

**In scope:** Header 提炼浮层；当前组 TODO / `#tag` / `[[wiki]]` 索引；跳转；TODO 完成态切换显示。

**Deferred:** 侧栏文件过滤；跨分组扫描；Logseq 查询语言；在正文中高亮全部命中的持续高亮模式；标签层级/别名；应用内编辑。

**Outside product identity:** 应用内 Markdown 编辑；云协作；PDF/白板/大纲笔记等非 Markdown 主路径。

### Success Criteria

- 偶发 review：不靠全文搜索关键字，也能在数秒内看到当前组未完成 TODO 并跳到原文。
- 标签与 wiki 话题可作为第二、第三横切入口，跳转行为一致。
- 不引入常驻面板或编辑能力，符合只读展出面。

### Assumptions

- frontmatter `tags` 采用常见 YAML 列表形态；奇异标量形态在规划阶段定解析宽容度。
- wiki 话题「键」与现有 `transformWikiLinks` 目标对齐即可；死链仍可作为话题索引项展示并尽量跳到源出现处。
- 「跳到行」复用或对齐全局搜索已有的定位能力；若某命中无法精确到行，至少打开正确文件。

### Outstanding Questions

**Deferred to Planning**

- 浮层内条目排序（按文件 / 按出现顺序 / 按字母）与同键多出现时的列表粒度（聚合成一项 vs 每出现一行）。
- `#tag` 与 frontmatter 同名时的合并展示文案。
- 快捷键是否需要（可选增强，非 R 硬性）。

### Sources / Research

- 对话与视觉草图：D1 Header 下拉；偶发「未解决/未来方向」用途。
- 既有能力：`transformWikiLinks`、`parseFrontmatter`、`GlobalSearchModal` 跳转模式；无现成提炼面板。
- 策略边界：`STRATEGY.md` 只读展出；不做编辑器。

## Planning Contract

**Technical approach:** 纯前端：当前分组文件 `fetchFileContent` → 抽取模型 → Header 浮层 → 复用 `pendingSearchJump` / `findBestSearchTarget` 跳转。代码块剥离后再抽 `#tag` / `[[wiki]]`；TODO 用行级 GFM 任务列表正则。

**Deferred to planning (resolved here):**
- 排序：按文件名再按行号。
- 同键多项：每条出现各一行（可跳到具体行）；标签 Tab 可按键分组标题 + 下属出现。
- 快捷键：v1 不做。

## Implementation Units

### U1 — 抽取模型 + 单测
- 新增 `frontend/src/utils/contentExtract.ts`（+test）：输入文件内容列表，输出 TODO / tags / wiki 出现项（fileId、行号、行文本、query 针）。
- 覆盖：代码块忽略、heading 非 tag、frontmatter tags、`- [ ]`/`- [x]`、`[[wiki|label]]`。

### U2 — 提炼浮层组件
- 新增 `ContentExtractPanel`：Tab、TODO 完成态开关、列表点击回调；加载态/空态。
- 样式对齐现有 header / 搜索弹层的 GitHub 色板。

### U3 — 接入 App Header
- Header「提炼」按钮 + 浮层开关；仅扫 `activeGroup` 文件；`onSelect` 走与全局搜索相同的 jump 路径；更新 CHANGELOG Unreleased。

### Verification
- `cd frontend && pnpm exec vitest run src/utils/contentExtract.test.ts src/components/ContentExtractPanel.test.tsx`
- 手动：当前组含 TODO/tag/wiki 的文档 → 打开提炼 → 跳转正确；切换分组列表变化；无法勾选。
