import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlidesToggle } from "./SlidesToggle";

describe("SlidesToggle", () => {
    it("shows 'Show slides' title when closed", () => {
        render(<SlidesToggle isSlidesOpen={false} onToggle={() => { }} />);
        expect(screen.getByTitle("Show slides")).toBeInTheDocument();
    });

    it("shows 'Exit slides' title when open", () => {
        render(<SlidesToggle isSlidesOpen={true} onToggle={() => { }} />);
        expect(screen.getByTitle("Exit slides")).toBeInTheDocument();
    });

    it("has aria-pressed false when closed", () => {
        render(<SlidesToggle isSlidesOpen={false} onToggle={() => { }} />);
        const button = screen.getByRole("button", { name: "Slides" });
        expect(button).toHaveAttribute("aria-pressed", "false");
    });

    it("has aria-pressed true when open", () => {
        render(<SlidesToggle isSlidesOpen={true} onToggle={() => { }} />);
        const button = screen.getByRole("button", { name: "Slides" });
        expect(button).toHaveAttribute("aria-pressed", "true");
    });

    it("calls onToggle when clicked", async () => {
        const user = userEvent.setup();
        const onToggle = vi.fn();
        render(<SlidesToggle isSlidesOpen={false} onToggle={onToggle} />);

        await user.click(screen.getByRole("button"));
        expect(onToggle).toHaveBeenCalledOnce();
    });
});
