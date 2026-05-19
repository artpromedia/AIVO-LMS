// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayfulCalmProvider } from "./playful-calm-provider";

describe("PlayfulCalmProvider", () => {
  it("renders children without the floating display preferences panel", () => {
    render(
      <PlayfulCalmProvider>
        <div>Child content</div>
      </PlayfulCalmProvider>,
    );

    expect(screen.getByText("Child content")).toBeTruthy();
    expect(screen.queryByText(/Display preferences/i)).toBeNull();
  });
});
