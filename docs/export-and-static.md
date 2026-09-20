# 导出与静态发布

本文说明 markview 如何把「展出」带出本地服务：应用内 PDF、`markview build` 静态站，以及托管到 GitHub Pages 一类静态主机时的注意点。

产品定位见根目录 [STRATEGY.md](../STRATEGY.md)。

## 1. 应用内 PDF 导出

### 1.1 单文档

在文档右侧工具列点击 PDF 按钮，会把**当前渲染后的文章**截成一页（不截断）JPEG，再写入 PDF。

特点：

- 跟随当前明暗主题填充背景（暗色主题不再白底浅字）
- 等待 Mermaid 等图表渲染完成后再截图
- 尽量保留可点击链接与标题大纲（PDF outline）

### 1.2 分组合并

侧边栏/顶栏提供「合并 PDF」：按当前分组内文件顺序，把多篇文档合并为一个 PDF（每篇一页或按内容高度分页）。

### 1.3 边界

- PDF 本质是**渲染结果截图**，不是纯文本排版引擎；复杂 CSS / 超大图可能影响清晰度。
- PlantUML 依赖在线 Kroki；导出前需图表已成功渲染。
- **内置 Slides 演示模式目前不能直接导出为幻灯片 PDF**；讲稿离线可用下方 Marp 路径，或先退出 Slides 再导出整篇文档 PDF。

## 2. `markview build`：生成静态站点

不启动预览服务，把 Markdown 打成可双击/`npx serve` 打开的静态目录：

```console
$ markview build docs/                    # 输出到 docs-static/
$ markview build docs/ -o dist/           # 指定输出目录
$ markview build README.md CHANGELOG.md   # 只打包列出的文件
$ markview build .                        # 从当前目录递归扫描 .md/.mdx
```

产物通常包含：

- `index.html` + 前端资源（相对路径，便于子路径托管）
- 嵌入的文件内容、图片等 raw 资源
- 图谱 / 大纲等静态数据（`window.__MARKVIEW_STATIC_DATA__`）

### 2.1 与在线会话的差异

| 能力 | 本地 `markview` 服务 | `markview build` 静态站 |
| ---- | -------------------- | ----------------------- |
| 多分组 / 动态加文件 | 支持 | 当前打成**单一 default 分组** |
| 保存后实时刷新 (SSE) | 支持 | 无（纯静态） |
| 侧边栏切换文档 | 支持 | 支持（只读会话内文件） |
| PlantUML | 需访问 Kroki | 同样需网络（浏览器端渲染） |
| 会话备份 / watch | 支持 | 无 |

### 2.2 本地预览静态产物

```console
$ markview build docs/ -o dist
$ npx --yes serve dist
```

## 3. 托管到 GitHub Pages（或其他静态主机）

`markview build` 输出的是相对资源路径的 SPA，一般可丢到任意静态托管。

### 3.1 推荐流程（仓库文档站）

1. 在 CI 或本地执行：`markview build docs/ -o site`（路径按仓库调整）。
2. 将 `site/` 发布为 Pages 产物（GitHub Actions `peaceiris/actions-gh-pages`、`actions/upload-pages-artifact` 等均可）。
3. 若站点挂在子路径（例如 `https://user.github.io/repo/`），确认托管平台对 SPA fallback（`index.html`）配置正确；当前构建以相对 `assets/` 为主，多数子路径场景可用。

### 3.2 尚无独立产品化的部分

- 仓库**未内置**官方 `gh-pages` workflow；需自行加 Actions。
- 静态导出暂不支持多 `--target` 分组原样镜像。
- 无自定义 domain / base-path 专用 CLI 开关；子路径异常时优先检查托管 SPA 回退与资源路径。

示例 Actions 骨架（需按仓库改路径，仅作参考）：

```yaml
# .github/workflows/pages.yml （示例，默认未启用）
name: pages
on:
  push:
    branches: [master]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"
      - name: Install markview
        run: go install ./...
      - name: Build static site
        run: markview build docs/ -o site
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
  # 另需配置 GitHub Pages environment / deploy job
```

## 4. 可选：Marp 讲稿导出（仓库工具链）

与**应用内 Slides** 是两条路径：

| | 应用内 Slides | Marp（Makefile） |
| --- | --- | --- |
| 入口 | 浏览器 `Slides` 按钮 | `make slides-pdf` / `slides-pptx` |
| 分页 | Markdown `---` | Marp 语法 + 仓库主题 |
| 用途 | 现场演示 | 离线 PDF/PPTX 讲稿 |

```console
$ make slides-preview
$ make slides-pdf
$ make slides-pptx
$ make slides-pdf SLIDES_FILE=docs/slides/my-talk.md
```

说明见 [docs/slides/README.md](slides/README.md)。

## 5. 相关文档

- [产品策略](../STRATEGY.md)
- [策略落地现状](strategy-status.md)
- [Markdown 能力清单](markdown-capabilities.md)
