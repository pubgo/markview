# Slides 测试用例

内置 Slides 演示模式的自动化与手工验收清单。产品行为见根目录 [README.md](../README.md)「内置 Slides 演示模式」；能力对照见 [markdown-capabilities.md](markdown-capabilities.md)。

## 1. 自动化测试

| 文件 | 覆盖点 |
| ---- | ------ |
| `frontend/src/utils/slideNotes.test.ts` | HTML 注释提取 / 剥离 / 多注释合并 / 空注释忽略 |
| `frontend/src/utils/slideColumns.test.ts` | 页内 `\|\|\|` 分栏（含代码块忽略） |
| `frontend/src/utils/slideCover.test.ts` | 短封面启发式 |
| `frontend/src/components/MarkdownViewer.slides.test.tsx` | 进入 Slides、翻页、封面标记、全屏/overlay、进度条、演讲者备注 + `N` |
| `frontend/src/components/SlidesToggle.test.tsx` | Slides 开关按钮 |

本地命令：

```console
$ cd frontend
$ pnpm test -- --run src/utils/slideNotes.test.ts src/components/MarkdownViewer.slides.test.tsx
```

## 2. 手工验收夹具

| 文件 | 用途 |
| ---- | ---- |
| `testdata/slides-complete.md` | **完整示例**（封面 / 备注 / 双栏 / 表 / Mermaid / 图 / 快捷键） |
| `testdata/slides-media.md` | 表格 / Mermaid / 图片 + 首页备注样例 |
| `testdata/slides-notes.md` | 演讲者备注边界场景（多注释、空注释、无备注页、封面、双栏） |

启动示例：

```console
$ markview testdata/slides-complete.md
$ markview testdata/slides-notes.md testdata/slides-media.md
```

## 3. 演讲者备注（本切片重点）

约定：页内 HTML 注释 `<!-- ... -->`（与 Marp 兼容）从观众画面剥离，进入备注面板；`N` 切换显示。

| ID | 步骤 | 期望 |
| -- | ---- | ---- |
| SN-01 | 打开 `testdata/slides-notes.md` → Slides → 第 1 页 | 幻灯片正文无注释字面量；底部备注面板显示「开场：强调本地优先」 |
| SN-02 | 同一页按 `N` | 备注面板隐藏；再按 `N` 恢复 |
| SN-03 | 翻到「多条备注」页 | 面板按段落展示两条备注；正文只剩标题与列表 |
| SN-04 | 翻到「空注释」页 | 无备注面板（空 `<!-- -->` 不产生备注） |
| SN-05 | 翻到「无备注」页 | 无备注面板；`N` 不报错、不出现空壳面板 |
| SN-06 | 翻到「封面 + 备注」页 | 封面仍垂直居中；备注在控件区，不破坏封面判定 |
| SN-07 | 全屏 `F`，静置至控件隐藏 | 备注与进度条/帮助条一并隐藏；移动鼠标后一并出现 |
| SN-08 | 备注面板上点击 | 不触发「空白点击下一页」 |
| SN-09 | 阅读模式（退出 Slides） | 原文中 HTML 注释仍在源码里；阅读渲染不依赖备注面板 |

## 3.1 翻页转场

| ID | 步骤 | 期望 |
| -- | ---- | ---- |
| TR-01 | Slides 下翻到下一页 | 新页带 `markdown-slide-page--enter`；内容切换正确 |
| TR-02 | 系统开启「减少动态效果」 | 无位移动画（仅瞬时切换） |

## 3.2 双栏

| ID | 步骤 | 期望 |
| -- | ---- | ---- |
| COL-01 | 打开含 `\|\|\|` 的页（见 `testdata/slides-notes.md`） | `data-slide-columns="2"`，左右内容同时可见 |
| COL-02 | 代码块内写 `\|\|\|` | 不分栏，当作普通代码 |

## 3.3 Deck PDF 导出

| ID | 步骤 | 期望 |
| -- | ---- | ---- |
| PDF-01 | Slides 下点右侧 PDF | 下载 `*-deck.pdf`，页数约等于幻灯片页数 |
| PDF-02 | 导出过程中 | 按钮禁用；结束后回到原页码 |
| PDF-03 | 阅读模式点 PDF | 仍为单页整篇导出（非 deck） |

## 4. 进度条回归

| ID | 步骤 | 期望 |
| -- | ---- | ---- |
| PG-01 | 进入任意多页 deck | 底部进度条 `aria-valuenow` / 标签为 `1/N` |
| PG-02 | 下一页 / `→` | 进度更新为 `2/N`，填充宽度增加 |
| PG-03 | 点击进度条约 80% 处 | 跳到接近末页 |
| PG-04 | 全屏 idle 后 | 进度条随 overlay 隐藏 |

## 5. 基础导航回归

| ID | 步骤 | 期望 |
| -- | ---- | ---- |
| NV-01 | `Slides` 进入 / 再点退出 | 仅当前页渲染；退出后恢复阅读流 |
| NV-02 | `←/→`、`PageUp/PageDown`、`Space`/`Enter`、空白点击 | 翻页正确，Home/End 到首末页 |
| NV-03 | `F` / `Esc` | 全屏进入；`Esc` 先退全屏，再 `Esc` 退出 Slides |
| NV-04 | `H` | 固定/取消固定演示控件；固定时不自动隐藏 |
| NV-05 | `testdata/slides-media.md` 表格与 Mermaid 页 | 表可读、图不溢出页框 |

## 6. 回归命令速查

```console
# 前端相关单测
$ cd frontend && pnpm test -- --run src/components/MarkdownViewer.slides.test.tsx src/utils/slideNotes.test.ts

# 格式（CI 会跑）
$ cd frontend && pnpm run fmt:check
```
