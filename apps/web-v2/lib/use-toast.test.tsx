// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { _resetToasts, dismissToast, toast, useToastQueue } from "./use-toast";

afterEach(() => {
  act(() => _resetToasts());
});

describe("toast store", () => {
  it("queues toasts with defaults and exposes them to subscribers", () => {
    const { result } = renderHook(() => useToastQueue());
    act(() => {
      toast({ title: "Saved" });
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].variant).toBe("default");
    expect(result.current[0].durationMs).toBeGreaterThan(0);
  });

  it("caps the visible queue at three, dropping the oldest", () => {
    const { result } = renderHook(() => useToastQueue());
    act(() => {
      toast({ title: "one" });
      toast({ title: "two" });
      toast({ title: "three" });
      toast({ title: "four" });
    });
    expect(result.current.map((t) => t.title)).toEqual(["two", "three", "four"]);
  });

  it("dismiss removes by id", () => {
    const { result } = renderHook(() => useToastQueue());
    let id = "";
    act(() => {
      id = toast({ title: "bye", variant: "danger" });
    });
    act(() => dismissToast(id));
    expect(result.current).toHaveLength(0);
  });
});
