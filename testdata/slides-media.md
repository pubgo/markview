# Slides 媒体页示例

用右侧 **Slides** 按钮查看表格、图片与 Mermaid。

---

## 对比表

| 方案 | 开发成本 | 维护成本 | 推荐 |
| ---- | -------- | -------- | ---- |
| A    | 低       | 中       | ✅   |
| B    | 中       | 低       | ✅   |

---

## 架构图

```mermaid
flowchart TB
  subgraph Client["浏览器端"]
    direction TB
    SPA["React SPA<br/>Markdown 预览"]
    Slides["Slides 演示模式"]
    MermaidUI["Mermaid / PlantUML"]
  end

  subgraph Server["markview 服务"]
    direction TB
    CLI["CLI + fsnotify Watch"]
    Ignore[".gitignore 过滤"]
    API["HTTP API + SSE"]
    Raw["/raw 静态资源"]
  end

  subgraph Docs["文档仓库"]
    direction LR
    MD["*.md"]
    IMG["images/*"]
    DIAG["图表代码块"]
  end

  CLI --> Ignore
  Ignore --> API
  API -->|"内容推送"| SPA
  SPA --> Slides
  Slides --> MermaidUI
  MD --> API
  IMG --> Raw
  Raw -->|"图片 URL"| SPA
  DIAG --> MermaidUI

  classDef client fill:#e8f4ff,stroke:#3b82f6,stroke-width:1.5px,color:#0f172a
  classDef server fill:#ecfdf5,stroke:#10b981,stroke-width:1.5px,color:#064e3b
  classDef docs fill:#fff7ed,stroke:#f59e0b,stroke-width:1.5px,color:#7c2d12

  class SPA,Slides,MermaidUI client
  class CLI,Ignore,API,Raw server
  class MD,IMG,DIAG docs
```

---

## 产品图

![markview logo](../images/logo.svg)
