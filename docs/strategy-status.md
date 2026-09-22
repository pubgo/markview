# 策略落地现状（对照 STRATEGY.md）

> 审计日期：2026-09-20。对照根目录 [STRATEGY.md](../STRATEGY.md) 与当前代码/文档，说明「做到哪一步了」。  
> 本文是**现状快照**，不是排期；功能细节以代码与 README 为准。

## 1. 指标快照

| 指标 | 成熟度 | 说明 |
| ---- | ------ | ---- |
| 冷启动到可读 | 强 | `markview …` 起服务并打开浏览器 |
| 少开编辑器 | 偏强 | 只读展出面：分组、搜索、图谱、Slides、PDF |
| 演示可用 | 够用 | 内置 `---` Slides + 全屏舞台；未完全替代 PPT |
| 导出保真 | 够用 | PDF 主题背景已对齐；静态站/Pages 包装仍薄 |
| 美化缺口 (~80%) | 与策略一致 | 功能大体具备；易用与视觉质感是主要剩余工作 |

## 2. 四条投资轨道

### 2.1 演示质感 — **够用**

**已有**

- `---` 分页（忽略代码块内分隔线）、键盘/点击翻页、全屏 `F`、控件自动隐藏
- 短封面自动居中、演示页排版（标题/列表/表格/图/Mermaid）
- 全屏舞台氛围（明暗主题）
- 底部进度条（页码 + 可点击跳转；全屏随控件显隐）
- 演讲者备注（HTML 注释剥离 + 备注面板；`N` 切换；全屏随控件显隐）
- 独立提词器窗口（`P`；BroadcastChannel 同步；适合双屏投屏）
- 翻页短淡入过渡（`prefers-reduced-motion` 关闭）
- 页内双栏（单独一行 `|||` 分列）
- Slides 模式可导出多页 deck PDF（逐页截幻灯片面）

**未齐（相对「拿得出手的技术分享」）**

- 更丰富转场选项；提词器计时 / 手机遥控
- 应用内 PPTX 导出（PDF deck 已有；完整 PPTX 仍靠 Marp Makefile）
- 更丰富的图文排版启发式（全幅背景图等）

### 2.2 阅读 / review 体验 — **强**

**已有**

- 多文件会话、命名分组、平铺/树侧边栏、拖拽排序
- ToC、宽窄布局、原文视图、全局全文搜索、反向链接
- 链接图 / 大纲图 / 重力视图 / 缩进树
- `--watch` + 项目 `.gitignore` 过滤、会话备份恢复

**未齐**

- 搜索结果键盘导航等（见 `docs/global-search.md` / `docs/design.md`）
- 未加入会话的全盘索引（设计边界：仅会话内文件）

### 2.3 导出与静态发布 — **够用**

**已有**

- 单文档 PDF、分组合并 PDF（主题感知背景）
- Slides 模式多页 deck PDF（逐页截取幻灯片面）
- `markview build` 自包含静态 SPA
- 仓库内 Marp 讲稿导出（Makefile）

**未齐**

- 无官方 GitHub Pages workflow；静态导出单分组
- 应用内无 PPTX（deck PDF 已有；PPTX 仍靠 Marp）

详见 [export-and-static.md](export-and-static.md)。

### 2.4 图表与扩展渲染 — **内置强 / 插件无（符合策略）**

**已有**

- Mermaid、PlantUML（Kroki）、SvgBob、KaTeX；GFM / Shiki / Alerts 等

**未齐**

- 无用户插件市场（策略明确：先深度、不做插件平台）
- PlantUML 离线不可用
- 更多渲染器（Graphviz 等）未一等公民化

详见 [markdown-capabilities.md](markdown-capabilities.md)。

## 3. 文档对齐情况

| 文档 | 角色 |
| ---- | ---- |
| [STRATEGY.md](../STRATEGY.md) | 问题、做法、用户、指标、轨道 |
| 本文 | 轨道成熟度与缺口快照 |
| [export-and-static.md](export-and-static.md) | PDF / build / Pages 操作说明 |
| [design.md](design.md) | 产品设计原则与边界 |
| [architecture.md](architecture.md) | 运行时架构 |
| [markdown-capabilities.md](markdown-capabilities.md) | 渲染能力盘点 |

## 4. 建议的下一步（文档层之外）

按策略「功能约 80%，盯易用/美化」：

1. 合入本策略与文档更新。
2. 在**演示质感**或**静态发布包装**中择一做缺口清单（5–10 条可验收项），再开实现。
3. 阅读/review 轨道以定点打磨为主，不宜再当主战场。
