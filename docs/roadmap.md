# 开发路线图（Roadmap）

> 制定日期：2026-09-30。承接 [STRATEGY.md](../STRATEGY.md) 的四条投资轨道与 [strategy-status.md](strategy-status.md) 的成熟度审计，把「未齐项」排成可执行的计划。
> 本文是滚动计划：完成一项勾一项；每季度随 strategy-status 审计一起复核。

## 0. 基线快照（2026-09-30）

- **版本**：v0.19.0（首个 pubgo 自主维护版本，2026-09-29 发布）
- **工程**：master CI 已全绿（gosec G703 经 `os.Root` 重构解决；gostyle 存量违规清零；pages-reusable workflow file issue 修复）；发版 = 更新 `version/version.go` 后推 `v*` tag
- **前端 bundle 基线（gzip，构建产物实测）**：

  | chunk | gzip | 备注 |
  | --- | --- | --- |
  | shiki | ~1.65 MB | 代码高亮，最大头 |
  | mermaid | ~1.10 MB | 图表渲染 |
  | @antv/g6 | ~377 KB | 链接/大纲图谱 |
  | index（主包） | ~310 KB | 应用入口 |
  | pdf（jspdf + html-to-image） | ~134 KB | 导出 |
  | katex | ~87 KB | 公式 |
  | react | ~60 KB | |
  | d3 | ~37 KB | mermaid/图谱共用 |
  | CSS | ~22 KB | |

  **首屏合计约 3.9 MB gzip**：`frontend/src` 目前没有任何 dynamic import，`vite.config.ts` 的 manualChunks 只做了拆分，静态 import 图上的所有 chunk 首屏全部加载。
- **测试**：前端 35 文件 / 288 用例；Go 6 个测试文件（`internal/server` 已有穿越/符号链接逃逸安全用例，总体覆盖偏薄）

## 1. P0 · 止血（已完成 ✅）

- [x] pages-reusable.yml：input description 中的 GitHub context（actionlint expression error，每次 master push 产生失败 run）+ setup-go 互斥输入 (#26)
- [x] gosec G703：`handleFileRaw` 改 `os.OpenRoot`，符号链接逃逸回归测试 (#26)
- [x] gostyle 存量违规清零（`handlerrors` ×4、`getters` ×1）(#27)
- [x] goreleaser release notes 降噪（排除 Merge / version-bump commit）(#26)
- [x] 安装文档纠正：`go install module@version` 因 embed 构建期产物不可用，改为 release 二进制 / 源码构建 (#25)

## 2. P1 · 近期（1–2 个月）

### 2.1 前端加载性能（工程）

- [x] mermaid / @antv（图谱视图）/ pdf 导出 改 `import()` 动态加载（图谱组件 `React.lazy` + Suspense；mermaid/jspdf/html-to-image 在使用点动态 import）— **首屏 3.79 → ~2.06 MB gzip（-46%）**
  - 关键坑：vite 8/rolldown 会把 `\0vite/preload-helper` 等虚拟 helper 放进"第一个被切出的 chunk"（此处为 mermaid），使 entry 静态依赖该懒 chunk 并进入 modulepreload；已用 `rolldownOptions.output.codeSplitting.groups`（`manualChunks` 已废弃）把所有 `\0` 虚拟模块锁进常驻 chunk 修复
- [x] shiki 惰性初始化：`codeToHtml` 改为使用点动态 `import("shiki")`（`utils/highlight.ts` 统一封装 + plaintext 回退）；组件在 html 就绪前本就渲染无高亮 `<pre>` 兜底，天然实现「先出文本、后高亮」
- [x] 目标：首屏 ≤ 1.2 MB gzip — **实际 ~456 KB**（entry 52 + markdown-runtime 327 + react 57 + CSS 20 + runtime ~1）
- [x] CI 产物体积回归防护：ci.yml 新增首屏体积检查——解析 index.html 的 eager 资产按 gzip 求和，默认 640 KB 上限（`BUNDLE_LIMIT_KB` 可调），当前 ~462 KB

### 2.2 导出保真（轨道 3）

- [x] PlantUML 离线化：服务地址可配置（设置 → PlantUML 服务，Kroki 兼容端点，默认公共 kroki.io；自托管即可离线渲染），修改后图表自动重渲染
- [x] `markview build --group`：单分组静态导出——`--group design` 只导出 `docs/design/` 子树，导出分组命名为该组名
- [x] 图片加载失败占位与重试提示：图片加载失败（含本地 raw 路径）时显示占位（图标 + alt + 重试按钮），点击重试重新加载

### 2.3 演示质感（轨道 1）

- [x] 转场选项（none / fade / slide）——slides 工具栏内选择，localStorage 持久化；`prefers-reduced-motion` 下自动关闭动画
- [x] 提词器计时器：经过时间时钟（暂停/继续/归零）
- [x] 手机遥控翻页：Go 侧 presenter 中继（`POST /_/api/presenter/{session}/messages` + SSE events），提词器 URL 带 `remote=1` 时走服务器通道，同一局域网内任何设备打开该 URL 即可遥控；主窗口 presenter 模式自动向中继发布状态并接收远程 goto
- [x] slides 页面内容超高适配：内容超出页高时整页等比缩小（下限 0.5x），ResizeObserver + 轮询兜底覆盖 mermaid/图片异步渲染；`computeFitScale` 纯函数可单测

### 2.4 Go 测试摸底（工程）

- [x] `internal/server` HTTP API 用例补齐：新增 api_test.go（groups / file content / graph / outline / reorder / patterns 全生命周期 / move / upload / status / shutdown）+ State 纯函数用例——server 包 62.1% → **74.7%**，全仓 50.5% → **56.6%**；下一版目标：server ≥ 80%（缺口集中在 fsnotify watchLoop 与 SSE 长连接）

## 3. P2 · 中期（3–6 个月，按建议顺序）

1. [ ] **LAN 访问鉴权（token）**——手机遥控使 `0.0.0.0` 绑定成为常态场景，裸奔风险随之放大。方案：启动时生成 token 并编入遥控二维码（URL 参数），非 loopback 请求校验；`--dangerously-allow-remote-access` 保留为显式跳过
2. [ ] **发布生态**——`pubgo/homebrew-tap` + goreleaser `brews` 配置恢复 Homebrew 安装，或先提供 `curl | sh` install script（release 产物已就绪，只差分发渠道，一次配置长期生效）
3. [ ] **搜索键盘导航**——`↑/↓` 选择、`Enter` 跳转、`Esc` 关闭（阅读轨定点打磨，不扩面）
4. [ ] **frontmatter 容错**——`...` 结束符、BOM
5. [ ] 大会话性能：虚拟列表、索引防抖（有实测卡顿再做）
6. [ ] 可配置 Markdown 扩展开关；图谱维度增强（标签 / 引用类型 / 跨分组）
7. [ ] Go 覆盖率第二阶段：server 74.7% → 80%（fsnotify watchLoop + SSE 长连接需要进程级测试）

## 4. P3 · 远期 / 探索（需单独设计，不承诺排期）

- [ ] 文本可选的 PDF 导出：截图 PDF 的不可选中/超长单页是机制性短板，探索 headless print-to-PDF
- [ ] 全盘索引：突破「仅会话内文件」边界（需索引缓存与失效机制设计）
- [ ] 新渲染器一等公民化（Graphviz / D2 / Typst，按真实文档需求增量）
- [ ] `go install` 支持：embed 占位 + build tag 方案（当前 19MB dist 不宜入库）

## 5. 度量与节奏

- **北极星**：沿用 STRATEGY 五指标（冷启动、少开编辑器、演示可用、导出保真、美化缺口）。
- **工程三数**：master CI 常绿；前端首屏 gzip 体积（基线 ~3.9 MB，P1 目标 ≤1.2 MB）；octocov 覆盖率趋势。
- **节奏**：小 PR 快合并，PR 绿才进 master；每积累 2–4 个 feature 推一次 minor tag；季度复核本文件与 strategy-status。
