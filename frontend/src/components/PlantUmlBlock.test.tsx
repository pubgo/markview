import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PlantUmlBlock } from "./MarkdownViewer";

describe("PlantUmlBlock", () => {
    const createObjectURL = vi.fn(() => "blob:plantuml-diagram");
    const revokeObjectURL = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(URL, "createObjectURL", {
            value: createObjectURL,
            writable: true,
            configurable: true,
        });
        Object.defineProperty(URL, "revokeObjectURL", {
            value: revokeObjectURL,
            writable: true,
            configurable: true,
        });
    });

    it("renders svg when PlantUML conversion succeeds", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: vi.fn().mockResolvedValue('<svg viewBox="0 0 100 60"><text>ok</text></svg>'),
            }),
        );

        render(
            <PlantUmlBlock
                code={[
                    "@startuml",
                    "Alice -> Bob: Hello",
                    "@enduml",
                ].join("\n")}
            />,
        );

        await waitFor(() => {
            const img = screen.getByRole("img", { name: "PlantUML diagram" }) as HTMLImageElement;
            expect(img).toBeTruthy();
            expect(img.src).toContain("blob:plantuml-diagram");
            expect(createObjectURL).toHaveBeenCalledTimes(1);
            expect(screen.getByTitle("Copy code")).toBeInTheDocument();
        });
    });

    it("falls back to preformatted code when PlantUML conversion fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                text: vi.fn().mockResolvedValue("render error"),
            }),
        );

        render(<PlantUmlBlock code="@startuml\nA -> B\n@enduml" />);

        await waitFor(() => {
            expect(screen.getByText("图表渲染失败：渲染服务异常，请稍后重试（PlantUML render failed with status 500）。已回退为代码块显示。")).toBeInTheDocument();
            expect(screen.getByText(/@startuml/)).toBeInTheDocument();
            expect(screen.getByText(/@enduml/)).toBeInTheDocument();
            expect(screen.queryByRole("img", { name: "PlantUML diagram" })).not.toBeInTheDocument();
            expect(screen.getByTitle("Copy code")).toBeInTheDocument();
        });
    });

    it("retries rendering when clicking retry button after failure", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 503,
                text: vi.fn().mockResolvedValue("service unavailable"),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: vi.fn().mockResolvedValue('<svg viewBox="0 0 100 60"><text>ok</text></svg>'),
            });
        vi.stubGlobal("fetch", fetchMock);

        render(<PlantUmlBlock code="@startuml\nA -> B\n@enduml" />);

        await waitFor(() => {
            expect(screen.getByText("图表渲染失败：渲染服务异常，请稍后重试（PlantUML render failed with status 503）。已回退为代码块显示。")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "重试渲染" })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: "重试渲染" }));

        await waitFor(() => {
            expect(screen.getByRole("img", { name: "PlantUML diagram" })).toBeInTheDocument();
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("calls requestFullscreen on fullscreen button click", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: vi.fn().mockResolvedValue('<svg viewBox="0 0 100 60"><text>ok</text></svg>'),
            }),
        );

        const requestFullscreenMock = vi.fn().mockResolvedValue(undefined);
        const originalRequestFullscreen = HTMLElement.prototype.requestFullscreen;
        Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
            value: requestFullscreenMock,
            configurable: true,
            writable: true,
        });

        render(<PlantUmlBlock code="@startuml\nA -> B\n@enduml" />);

        await waitFor(() => {
            expect(screen.getByRole("img", { name: "PlantUML diagram" })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTitle("Fullscreen"));

        await waitFor(() => {
            expect(requestFullscreenMock).toHaveBeenCalledTimes(1);
        });

        Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
            value: originalRequestFullscreen,
            configurable: true,
            writable: true,
        });
    });

    it("injects default PlantUML theme preset when no custom style exists", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue('<svg viewBox="0 0 100 60"><text>ok</text></svg>'),
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<PlantUmlBlock code="@startuml\nAlice -> Bob: Hello\n@enduml" />);

        await waitFor(() => {
            expect(screen.getByRole("img", { name: "PlantUML diagram" })).toBeInTheDocument();
        });

        const body = String(fetchMock.mock.calls[0]?.[1]?.body ?? "");
        expect(body).toContain("skinparam shadowing false");
        expect(body).toContain("skinparam defaultFontName");
        expect(body).toContain("skinparam sequence {");
        expect(body).toContain("ParticipantFontColor");
        expect(body).toContain("LifeLineBorderColor");
    });

    it("injects dark sequence participant colors that contrast with box fills", async () => {
        document.documentElement.setAttribute("data-theme", "dark");
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue('<svg viewBox="0 0 100 60"><text>ok</text></svg>'),
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<PlantUmlBlock code={"@startuml\nactor User\nparticipant markview\nUser -> markview: hi\n@enduml"} />);

        await waitFor(() => {
            expect(screen.getByRole("img", { name: "PlantUML diagram" })).toBeInTheDocument();
        });

        const body = String(fetchMock.mock.calls[0]?.[1]?.body ?? "");
        expect(body).toContain("ParticipantBackgroundColor #161b22");
        expect(body).toContain("ParticipantFontColor #e6edf3");
        expect(body).toContain("LifeLineBorderColor #6e7681");
        expect(body).toContain("ActorFontColor #e6edf3");

        document.documentElement.removeAttribute("data-theme");
    });

    it("keeps user custom skinparam without injecting preset", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: vi.fn().mockResolvedValue('<svg viewBox="0 0 100 60"><text>ok</text></svg>'),
        });
        vi.stubGlobal("fetch", fetchMock);

        render(
            <PlantUmlBlock
                code={[
                    "@startuml",
                    "skinparam ArrowColor #ff0000",
                    "Alice -> Bob: custom",
                    "@enduml",
                ].join("\n")}
            />,
        );

        await waitFor(() => {
            expect(screen.getByRole("img", { name: "PlantUML diagram" })).toBeInTheDocument();
        });

        const body = String(fetchMock.mock.calls[0]?.[1]?.body ?? "");
        expect(body).toContain("skinparam ArrowColor #ff0000");
        expect(body).not.toContain("skinparam defaultFontName");
    });
});
