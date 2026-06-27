# 可视化快速上手（3 分钟看到效果）

如果你刚接触 `markview`，可按本文一步步体验真实效果（含图表、公式、结构可视化）。

## 1) 一键启动示例会话

在仓库根目录执行：

```console
$ markview -p 16275 -b localhost --no-open testdata/basic.md testdata/mermaid-flowchart.md testdata/plantuml.md testdata/svgbob-complex.md testdata/math.md
```

然后打开：

- `http://localhost:16275`

> 说明：
>
> - `-p 16275`：使用独立端口，避免和默认 `6275` 会话互相影响。
> - `-b localhost`：仅本机可访问，避免出现远程访问安全确认提示。

## 2) 先看基础渲染能力

打开左侧文件列表，依次点击：

1. `basic.md`：基础 Markdown（标题、列表、引用、链接）
2. `math.md`：LaTeX 数学公式（KaTeX）
3. `mermaid-flowchart.md`：Mermaid 图表
4. `plantuml.md`：PlantUML 图表
5. `svgbob-complex.md`：SVG Bob 图表

你会看到：

- 页面右侧立即切换渲染内容
- 图表块支持缩放/全屏等交互（不同图表能力略有差异）
- 目录、原文、复制、导出等按钮在文档右侧工具列

### 2.1 快速体验内置演示模式（Slides）

在任意 Markdown 文档右侧点击 `Slides` 按钮即可进入演示模式：

- 使用 `---` 进行分页（代码块内 `---` 不会触发分页）
- `F` 切换全屏，`Esc` 退出（全屏时先退全屏）
- 可用 `←/→`、`Space`、`PageUp/PageDown` 翻页
- 点击幻灯片空白区域也可进入下一页
- 全屏下控件会自动隐藏；`H` 可固定/取消固定控件

## 3) 体验结构可视化模式

在页面顶部工具栏点击图谱相关按钮：

- `链接关系图`
- `标题结构图`
- `重力视图`
- `缩进树`

### 3.1 思维导图视图

- 点击导图节点可在右侧打开对应文档
- 适合做“文件关系总览”

## 4) 常见问题（看不到效果时）

### Q1：页面里看不到图谱相关按钮

通常是连接到了旧进程或旧端口。

建议：

1. 用 `markview --status --json` 看当前有哪些服务。
2. 优先访问 `http://localhost:16275`（本文示例端口）。
3. 必要时先停旧服务再重启：

```console
$ markview --shutdown -p 6275
$ markview --shutdown -p 16275
```

### Q2：前台启动后窗口关闭，服务就没了

这是正常行为。`--foreground` 会跟随终端生命周期。若你希望后台常驻，去掉 `--foreground` 即可。

### Q3：如何确认是最新构建版本

页面右下角会显示版本与修订号，例如：

- `markview 0.18.1 (HEAD)`

如果显示的 revision 与当前仓库 `git rev-parse --short HEAD` 不一致，说明你正在访问的不是这次构建出的服务实例。

## 5) 下一步建议

体验完成后，建议再看两份文档：

- `docs/markdown-capabilities.md`（功能清单）
- `docs/design.md`（设计意图与演进思路）

这样能更快理解“功能有什么”与“为什么这样设计”。
