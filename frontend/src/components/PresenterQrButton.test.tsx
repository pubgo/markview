import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PresenterQrButton } from "./PresenterQrButton";

const lanHint = { ip: "192.168.1.15", port: "6275" };

describe("PresenterQrButton", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/_/api/lan-hint")) {
          return Promise.resolve(new Response(JSON.stringify(lanHint), { status: 200 }));
        }
        if (url.includes("/_/api/presenter/qr")) {
          return Promise.resolve(
            new Response(new Blob([new Uint8Array([0x89, 0x50])]), {
              status: 200,
              headers: { "Content-Type": "image/png" },
            }),
          );
        }
        return Promise.reject(new Error("unexpected url " + url));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a session and shows the QR with the LAN remote url", async () => {
    const onEnsureSession = vi.fn(() => {});
    const { rerender } = render(
      <PresenterQrButton sessionId={null} onEnsureSession={onEnsureSession} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "手机遥控" }));
    expect(onEnsureSession).toHaveBeenCalledTimes(1);

    // Parent flips sessionId; the popover resolves the LAN hint and renders.
    rerender(<PresenterQrButton sessionId="sess-qr" onEnsureSession={onEnsureSession} />);
    await waitFor(() => {
      expect(screen.getByTestId("presenter-qr-image")).toBeInTheDocument();
    });
    const img = screen.getByTestId("presenter-qr-image") as HTMLImageElement;
    expect(img.src).toContain(
      `/_/api/presenter/qr?text=${encodeURIComponent(
        "http://192.168.1.15:6275/?presenter=1&session=sess-qr&remote=1",
      )}`,
    );
    expect(screen.getByText(/手机连同一 Wi-Fi/)).toBeInTheDocument();
  });

  it("toggles closed on second click", async () => {
    const { rerender } = render(
      <PresenterQrButton sessionId="sess-open" onEnsureSession={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "手机遥控" }));
    await waitFor(() => expect(screen.getByTestId("presenter-qr-popover")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "手机遥控" }));
    expect(screen.queryByTestId("presenter-qr-popover")).not.toBeInTheDocument();
    void rerender;
  });

  it("reports unavailable when the LAN hint has no address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))),
    );
    render(<PresenterQrButton sessionId="sess-x" onEnsureSession={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "手机遥控" }));
    await waitFor(() => {
      expect(screen.getByText(/未找到局域网地址/)).toBeInTheDocument();
    });
  });
});
