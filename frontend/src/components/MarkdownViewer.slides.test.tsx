import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownViewer } from "./MarkdownViewer";
import { fetchFileContent, openRelativeFile } from "../hooks/useApi";

vi.mock("../hooks/useApi", () => ({
  fetchFileContent: vi.fn(),
  openRelativeFile: vi.fn(),
}));

vi.mock("./TocToggle", () => ({
  TocToggle: () => null,
}));

vi.mock("./RawToggle", () => ({
  RawToggle: () => null,
}));

vi.mock("./CopyButton", () => ({
  CopyButton: () => null,
}));

vi.mock("./PdfExportButton", () => ({
  PdfExportButton: () => null,
}));

vi.mock("./RemoveButton", () => ({
  RemoveButton: () => null,
}));

vi.mock("./BacklinksPanel", () => ({
  BacklinksPanel: () => null,
}));

describe("MarkdownViewer slides mode", () => {
  let requestFullscreenMock: ReturnType<typeof vi.fn>;
  let exitFullscreenMock: ReturnType<typeof vi.fn>;
  let fullscreenElement: Element | null;

  beforeEach(() => {
    vi.clearAllMocks();
    fullscreenElement = null;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });
    requestFullscreenMock = vi.fn().mockImplementation(function (this: HTMLElement) {
      fullscreenElement = this;
      return Promise.resolve();
    });
    exitFullscreenMock = vi.fn().mockImplementation(() => {
      fullscreenElement = null;
      return Promise.resolve();
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreenMock,
    });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreenMock,
    });
    vi.mocked(fetchFileContent).mockResolvedValue({
      content: `# 封面\n\n第一页内容\n\n---\n\n# 第二页\n\n第二页内容`,
      baseDir: "/tmp",
    });
    vi.mocked(openRelativeFile).mockResolvedValue({
      id: "file-2",
      name: "ok.md",
      path: "/tmp/ok.md",
    });
  });

  it("enters slides mode and flips pages by button", async () => {
    const user = userEvent.setup();

    render(
      <MarkdownViewer
        fileId="file-1"
        fileName="README.md"
        revision={0}
        onFileOpened={() => {}}
        onHeadingsChange={() => {}}
        isTocOpen={false}
        onTocToggle={() => {}}
        onRemoveFile={() => {}}
        isWide={false}
      />,
    );

    await screen.findByText("第一页内容");

    await user.click(screen.getByRole("button", { name: "Slides" }));

    await waitFor(() => {
      expect(screen.getByText(/PPT 模式/)).toBeInTheDocument();
      expect(screen.getByText("第一页内容")).toBeInTheDocument();
      expect(screen.queryByText("第二页内容")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "下一页" }));

    await waitFor(() => {
      expect(screen.getByText("第二页内容")).toBeInTheDocument();
      expect(screen.queryByText("第一页内容")).not.toBeInTheDocument();
    });
  });

  it("marks short title slides as covers and list slides as content", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchFileContent).mockResolvedValue({
      content: `# 封面\n\n副标题\n\n---\n\n# 要点\n\n- 第一条\n- 第二条\n`,
      baseDir: "/tmp",
    });

    render(
      <MarkdownViewer
        fileId="file-1"
        fileName="talk.md"
        revision={0}
        onFileOpened={() => {}}
        onHeadingsChange={() => {}}
        isTocOpen={false}
        onTocToggle={() => {}}
        onRemoveFile={() => {}}
        isWide={false}
      />,
    );

    await screen.findByText("副标题");
    await user.click(screen.getByRole("button", { name: "Slides" }));

    await waitFor(() => {
      const page = screen.getByTestId("markdown-slide-page");
      expect(page).toHaveAttribute("data-slide-cover", "true");
      expect(page.className).toContain("markdown-slide-page--cover");
    });

    await user.click(screen.getByRole("button", { name: "下一页" }));

    await waitFor(() => {
      const page = screen.getByTestId("markdown-slide-page");
      expect(page).toHaveAttribute("data-slide-cover", "false");
      expect(page.className).not.toContain("markdown-slide-page--cover");
      expect(screen.getByText("第一条")).toBeInTheDocument();
    });
  });

  it("renders tables and mermaid blocks inside slides pages", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchFileContent).mockResolvedValue({
      content: `# 表\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n---\n\n# 图\n\n\`\`\`mermaid\ngraph TD; A-->B\n\`\`\`\n`,
      baseDir: "/tmp",
    });

    render(
      <MarkdownViewer
        fileId="file-1"
        fileName="media.md"
        revision={0}
        onFileOpened={() => {}}
        onHeadingsChange={() => {}}
        isTocOpen={false}
        onTocToggle={() => {}}
        onRemoveFile={() => {}}
        isWide={false}
      />,
    );

    await screen.findByText("表");
    await user.click(screen.getByRole("button", { name: "Slides" }));

    await waitFor(() => {
      const page = screen.getByTestId("markdown-slide-page");
      expect(page.querySelector("table")).toBeTruthy();
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "下一页" }));

    await waitFor(() => {
      const page = screen.getByTestId("markdown-slide-page");
      expect(page.querySelector(".mermaid-block, [data-mermaid-render-status]")).toBeTruthy();
    });
  });

  it("supports keyboard navigation in slides mode", async () => {
    const user = userEvent.setup();

    render(
      <MarkdownViewer
        fileId="file-1"
        fileName="README.md"
        revision={0}
        onFileOpened={() => {}}
        onHeadingsChange={() => {}}
        isTocOpen={false}
        onTocToggle={() => {}}
        onRemoveFile={() => {}}
        isWide={false}
      />,
    );

    await screen.findByText("第一页内容");
    await user.click(screen.getByRole("button", { name: "Slides" }));

    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => {
      expect(screen.getByText("第二页内容")).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => {
      expect(screen.getByText("第一页内容")).toBeInTheDocument();
    });
  });

  it("enters fullscreen when clicking fullscreen button", async () => {
    const user = userEvent.setup();

    render(
      <MarkdownViewer
        fileId="file-1"
        fileName="README.md"
        revision={0}
        onFileOpened={() => {}}
        onHeadingsChange={() => {}}
        isTocOpen={false}
        onTocToggle={() => {}}
        onRemoveFile={() => {}}
        isWide={false}
      />,
    );

    await screen.findByText("第一页内容");
    await user.click(screen.getByRole("button", { name: "Slides" }));

    await user.click(screen.getByRole("button", { name: "全屏展示" }));
    expect(requestFullscreenMock).toHaveBeenCalledOnce();

    document.dispatchEvent(new Event("fullscreenchange"));
    await waitFor(() => {
      const shell = screen.getByTestId("markdown-slide-shell");
      expect(shell.className).toContain("markdown-slide-shell--fullscreen");
    });
  });

  it("goes to next slide when clicking slide body", async () => {
    const user = userEvent.setup();

    render(
      <MarkdownViewer
        fileId="file-1"
        fileName="README.md"
        revision={0}
        onFileOpened={() => {}}
        onHeadingsChange={() => {}}
        isTocOpen={false}
        onTocToggle={() => {}}
        onRemoveFile={() => {}}
        isWide={false}
      />,
    );

    await screen.findByText("第一页内容");
    await user.click(screen.getByRole("button", { name: "Slides" }));

    const slidePage = document.querySelector(".markdown-slide-page") as HTMLElement;
    expect(slidePage).toBeTruthy();
    await user.click(slidePage);

    await waitFor(() => {
      expect(screen.getByText("第二页内容")).toBeInTheDocument();
    });
  });

  it("exits fullscreen before leaving slides on Escape", async () => {
    const user = userEvent.setup();

    render(
      <MarkdownViewer
        fileId="file-1"
        fileName="README.md"
        revision={0}
        onFileOpened={() => {}}
        onHeadingsChange={() => {}}
        isTocOpen={false}
        onTocToggle={() => {}}
        onRemoveFile={() => {}}
        isWide={false}
      />,
    );

    await screen.findByText("第一页内容");
    await user.click(screen.getByRole("button", { name: "Slides" }));
    await user.click(screen.getByRole("button", { name: "全屏展示" }));
    expect(requestFullscreenMock).toHaveBeenCalledOnce();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(exitFullscreenMock).toHaveBeenCalledOnce();
    expect(screen.getByText(/PPT 模式/)).toBeInTheDocument();
  });

  it("auto-hides overlay controls in fullscreen after inactivity", async () => {
    const user = userEvent.setup();

    render(
      <MarkdownViewer
        fileId="file-1"
        fileName="README.md"
        revision={0}
        onFileOpened={() => {}}
        onHeadingsChange={() => {}}
        isTocOpen={false}
        onTocToggle={() => {}}
        onRemoveFile={() => {}}
        isWide={false}
      />,
    );

    await screen.findByText("第一页内容");
    await user.click(screen.getByRole("button", { name: "Slides" }));
    await user.click(screen.getByRole("button", { name: "全屏展示" }));
    document.dispatchEvent(new Event("fullscreenchange"));

    const shell = screen.getByTestId("markdown-slide-shell");
    expect(shell.className).not.toContain("markdown-slide-shell--overlay-hidden");

    await waitFor(
      () => {
        expect(shell.className).toContain("markdown-slide-shell--overlay-hidden");
      },
      {
        timeout: 4500,
      },
    );
  });

  it("shows slide progress that updates when navigating", async () => {
    const user = userEvent.setup();

    render(
      <MarkdownViewer
        fileId="file-1"
        fileName="README.md"
        revision={0}
        onFileOpened={() => {}}
        onHeadingsChange={() => {}}
        isTocOpen={false}
        onTocToggle={() => {}}
        onRemoveFile={() => {}}
        isWide={false}
      />,
    );

    await screen.findByText("第一页内容");
    await user.click(screen.getByRole("button", { name: "Slides" }));

    const progress = await screen.findByTestId("markdown-slide-progress");
    expect(progress).toHaveAttribute("aria-valuenow", "1");
    expect(progress).toHaveAttribute("aria-valuemax", "2");
    const fill = progress.querySelector(".markdown-slide-progress__fill") as HTMLElement;
    expect(fill.style.width).toBe("50%");

    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => {
      expect(progress).toHaveAttribute("aria-valuenow", "2");
      expect(fill.style.width).toBe("100%");
    });
  });

  it("extracts HTML comment speaker notes and toggles with N", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchFileContent).mockResolvedValue({
      content: `# 封面\n\n第一页内容\n\n<!-- 强调本地优先 -->\n\n---\n\n# 第二页\n\n第二页内容`,
      baseDir: "/tmp",
    });

    render(
      <MarkdownViewer
        fileId="file-1"
        fileName="README.md"
        revision={0}
        onFileOpened={() => {}}
        onHeadingsChange={() => {}}
        isTocOpen={false}
        onTocToggle={() => {}}
        onRemoveFile={() => {}}
        isWide={false}
      />,
    );

    await screen.findByText("第一页内容");
    await user.click(screen.getByRole("button", { name: "Slides" }));

    const notes = await screen.findByTestId("markdown-slide-notes");
    expect(notes).toHaveTextContent("强调本地优先");
    expect(screen.queryByText("<!-- 强调本地优先 -->")).not.toBeInTheDocument();

    await user.keyboard("n");
    await waitFor(() => {
      expect(screen.queryByTestId("markdown-slide-notes")).not.toBeInTheDocument();
    });

    await user.keyboard("n");
    expect(await screen.findByTestId("markdown-slide-notes")).toHaveTextContent("强调本地优先");

    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => {
      expect(screen.queryByTestId("markdown-slide-notes")).not.toBeInTheDocument();
    });
  });

  it("applies enter transition class when changing slides", async () => {
    const user = userEvent.setup();

    render(
      <MarkdownViewer
        fileId="file-1"
        fileName="README.md"
        revision={0}
        onFileOpened={() => {}}
        onHeadingsChange={() => {}}
        isTocOpen={false}
        onTocToggle={() => {}}
        onRemoveFile={() => {}}
        isWide={false}
      />,
    );

    await screen.findByText("第一页内容");
    await user.click(screen.getByRole("button", { name: "Slides" }));

    const firstPage = await screen.findByTestId("markdown-slide-page");
    expect(firstPage).toHaveAttribute("data-slide-index", "0");
    expect(firstPage.className).toContain("markdown-slide-page--enter");

    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => {
      const nextPage = screen.getByTestId("markdown-slide-page");
      expect(nextPage).toHaveAttribute("data-slide-index", "1");
      expect(nextPage.className).toContain("markdown-slide-page--enter");
      expect(screen.getByText("第二页内容")).toBeInTheDocument();
    });
  });

  it("renders ||| as a two-column slide layout", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchFileContent).mockResolvedValue({
      content: `## 左栏\n\n- A\n\n|||\n\n## 右栏\n\n- B`,
      baseDir: "/tmp",
    });

    render(
      <MarkdownViewer
        fileId="file-1"
        fileName="README.md"
        revision={0}
        onFileOpened={() => {}}
        onHeadingsChange={() => {}}
        isTocOpen={false}
        onTocToggle={() => {}}
        onRemoveFile={() => {}}
        isWide={false}
      />,
    );

    await screen.findByText("左栏");
    await user.click(screen.getByRole("button", { name: "Slides" }));

    const page = await screen.findByTestId("markdown-slide-page");
    expect(page).toHaveAttribute("data-slide-columns", "2");
    expect(page.className).toContain("markdown-slide-page--columns");
    expect(screen.getByTestId("markdown-slide-columns")).toBeInTheDocument();
    expect(screen.getByText("左栏")).toBeInTheDocument();
    expect(screen.getByText("右栏")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("renders three columns with a shared title above the grid", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchFileContent).mockResolvedValue({
      content: `## 三栏也可以\n\n### 写\n\nA\n\n|||\n\n### 展\n\nB\n\n|||\n\n### 存\n\nC`,
      baseDir: "/tmp",
    });

    render(
      <MarkdownViewer
        fileId="file-1"
        fileName="slides.md"
        revision={0}
        onFileOpened={() => {}}
        onHeadingsChange={() => {}}
        isTocOpen={false}
        onTocToggle={() => {}}
        onRemoveFile={() => {}}
        isWide={false}
      />,
    );

    await screen.findByText("三栏也可以");
    await user.click(screen.getByRole("button", { name: "Slides" }));

    const page = await screen.findByTestId("markdown-slide-page");
    expect(page).toHaveAttribute("data-slide-columns", "3");
    expect(screen.getByTestId("markdown-slide-columns-title")).toHaveTextContent("三栏也可以");
    expect(screen.getByTestId("markdown-slide-columns").children).toHaveLength(3);
    expect(screen.queryByText("|||")).not.toBeInTheDocument();
    expect(screen.getByText("写")).toBeInTheDocument();
    expect(screen.getByText("展")).toBeInTheDocument();
    expect(screen.getByText("存")).toBeInTheDocument();
  });

  it("opens a teleprompter popup with P and syncs goto from the channel", async () => {
    const user = userEvent.setup();
    const popup = {
      closed: false,
      close: vi.fn(() => {
        popup.closed = true;
      }),
    };
    const openMock = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);

    type Listener = (event: MessageEvent) => void;
    class MockBroadcastChannel {
      static instances: MockBroadcastChannel[] = [];
      name: string;
      onmessage: Listener | null = null;
      private listeners = new Set<Listener>();
      constructor(name: string) {
        this.name = name;
        MockBroadcastChannel.instances.push(this);
      }
      addEventListener(_type: string, listener: Listener) {
        this.listeners.add(listener);
      }
      removeEventListener(_type: string, listener: Listener) {
        this.listeners.delete(listener);
      }
      postMessage(data: unknown) {
        for (const instance of MockBroadcastChannel.instances) {
          if (instance === this || instance.name !== this.name) continue;
          const event = { data } as MessageEvent;
          instance.onmessage?.(event);
          for (const listener of instance.listeners) listener(event);
        }
      }
      close() {
        MockBroadcastChannel.instances = MockBroadcastChannel.instances.filter((i) => i !== this);
      }
    }
    MockBroadcastChannel.instances = [];
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);

    vi.mocked(fetchFileContent).mockResolvedValue({
      content: `# 封面\n\n<!-- 开场白 -->\n\n---\n\n# 第二页\n\n正文`,
      baseDir: "/tmp",
    });

    render(
      <MarkdownViewer
        fileId="file-1"
        fileName="talk.md"
        revision={0}
        onFileOpened={() => {}}
        onHeadingsChange={() => {}}
        isTocOpen={false}
        onTocToggle={() => {}}
        onRemoveFile={() => {}}
        isWide={false}
      />,
    );

    await screen.findByText("封面");
    await user.click(screen.getByRole("button", { name: "Slides" }));
    await screen.findByTestId("markdown-slide-page");

    await user.keyboard("p");

    expect(openMock).toHaveBeenCalled();
    const openedUrl = String(openMock.mock.calls[0]?.[0] ?? "");
    expect(openedUrl).toContain("presenter=1");
    expect(openedUrl).toContain("session=");

    await waitFor(() => {
      expect(screen.queryByTestId("markdown-slide-notes")).not.toBeInTheDocument();
    });

    const session = new URL(openedUrl, "http://localhost").searchParams.get("session");
    expect(session).toBeTruthy();

    await waitFor(() => expect(MockBroadcastChannel.instances.length).toBeGreaterThanOrEqual(1));
    const tele = new MockBroadcastChannel("markview-slides-presenter");
    tele.postMessage({ type: "goto", sessionId: session, slideIndex: 1 });

    await waitFor(() => {
      expect(screen.getByTestId("markdown-slide-page")).toHaveAttribute("data-slide-index", "1");
    });

    openMock.mockRestore();
    vi.unstubAllGlobals();
  });
});
