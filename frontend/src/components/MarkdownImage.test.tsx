import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MarkdownViewer } from "./MarkdownViewer";
import { fetchFileContent } from "../hooks/useApi";

vi.mock("../hooks/useApi", () => ({
  fetchFileContent: vi.fn(),
  openRelativeFile: vi.fn(),
}));

vi.mock("./TocToggle", () => ({ TocToggle: () => null }));
vi.mock("./RawToggle", () => ({ RawToggle: () => null }));
vi.mock("./CopyButton", () => ({ CopyButton: () => null }));
vi.mock("./PdfExportButton", () => ({ PdfExportButton: () => null }));
vi.mock("./RemoveButton", () => ({ RemoveButton: () => null }));
vi.mock("./BacklinksPanel", () => ({ BacklinksPanel: () => null }));
vi.mock("./SlidesToggle", () => ({ SlidesToggle: () => null }));

function renderViewer(content: string) {
  vi.mocked(fetchFileContent).mockResolvedValue({ content, baseDir: "/tmp" });
  return render(
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
}

describe("MarkdownImage remote failure placeholder", () => {
  beforeEach(() => {
    vi.mocked(fetchFileContent).mockReset();
  });

  it("shows a retryable placeholder when a remote image fails", async () => {
    renderViewer("![remote pic](https://example.com/pic.png)");

    const img = await screen.findByAltText("remote pic");
    fireEvent.error(img);

    expect(screen.getByText(/图片加载失败/)).toBeInTheDocument();
    expect(screen.getByText(/remote pic/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(screen.queryByText(/图片加载失败/)).not.toBeInTheDocument();
    expect(screen.getByAltText("remote pic")).toBeInTheDocument();
  });

  it("shows the placeholder for failed local images too", async () => {
    renderViewer("![local pic](./pic.png)");

    const img = await screen.findByAltText("local pic");
    fireEvent.error(img);

    expect(screen.getByText(/图片加载失败/)).toBeInTheDocument();
    expect(screen.getByText(/local pic/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(screen.getByAltText("local pic")).toBeInTheDocument();
  });
});
