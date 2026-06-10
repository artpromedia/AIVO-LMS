import { describe, expect, it, vi, afterEach } from "vitest";
import { greetingName, greetingSlot, buildGreeting } from "@/lib/utils/greeting";

describe("greetingName", () => {
  it("returns the first word for a plain name", () => {
    expect(greetingName("Jordan Lee")).toBe("Jordan");
  });

  it("strips Ms. honorific", () => {
    expect(greetingName("Ms. Vega")).toBe("Vega");
    expect(greetingName("Ms Vega")).toBe("Vega");
  });

  it("strips Mr. honorific", () => {
    expect(greetingName("Mr. Smith")).toBe("Smith");
    expect(greetingName("Mr Smith")).toBe("Smith");
  });

  it("strips Mrs. honorific", () => {
    expect(greetingName("Mrs. Patel")).toBe("Patel");
  });

  it("strips Mx. honorific", () => {
    expect(greetingName("Mx. Rivera")).toBe("Rivera");
  });

  it("strips Dr. honorific", () => {
    expect(greetingName("Dr. Okonkwo")).toBe("Okonkwo");
    expect(greetingName("Dr Okonkwo")).toBe("Okonkwo");
  });

  it("strips Prof. honorific", () => {
    expect(greetingName("Prof. Kim")).toBe("Kim");
    expect(greetingName("Prof Kim")).toBe("Kim");
  });

  it("returns single-word name unchanged", () => {
    expect(greetingName("Alex")).toBe("Alex");
  });

  it("handles extra whitespace", () => {
    expect(greetingName("  Dr.  Chen  ")).toBe("Chen");
  });
});

describe("greetingSlot", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function setHour(hour: number) {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    vi.setSystemTime(d);
  }

  it('returns "morning" for midnight (hour 0)', () => {
    vi.useFakeTimers();
    setHour(0);
    expect(greetingSlot()).toBe("morning");
  });

  it('returns "morning" for hour 7', () => {
    vi.useFakeTimers();
    setHour(7);
    expect(greetingSlot()).toBe("morning");
  });

  it('returns "morning" for hour 11', () => {
    vi.useFakeTimers();
    setHour(11);
    expect(greetingSlot()).toBe("morning");
  });

  it('returns "afternoon" for hour 12', () => {
    vi.useFakeTimers();
    setHour(12);
    expect(greetingSlot()).toBe("afternoon");
  });

  it('returns "afternoon" for hour 15', () => {
    vi.useFakeTimers();
    setHour(15);
    expect(greetingSlot()).toBe("afternoon");
  });

  it('returns "afternoon" for hour 17', () => {
    vi.useFakeTimers();
    setHour(17);
    expect(greetingSlot()).toBe("afternoon");
  });

  it('returns "evening" for hour 18', () => {
    vi.useFakeTimers();
    setHour(18);
    expect(greetingSlot()).toBe("evening");
  });

  it('returns "evening" for hour 23', () => {
    vi.useFakeTimers();
    setHour(23);
    expect(greetingSlot()).toBe("evening");
  });
});

describe("buildGreeting", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds a "Good morning" greeting in the morning', () => {
    vi.useFakeTimers();
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    vi.setSystemTime(d);
    expect(buildGreeting("Dr. Chen")).toBe("Good morning, Chen.");
  });

  it('builds a "Good afternoon" greeting in the afternoon', () => {
    vi.useFakeTimers();
    const d = new Date();
    d.setHours(14, 0, 0, 0);
    vi.setSystemTime(d);
    expect(buildGreeting("Jordan")).toBe("Good afternoon, Jordan.");
  });

  it('builds a "Good evening" greeting in the evening', () => {
    vi.useFakeTimers();
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    vi.setSystemTime(d);
    expect(buildGreeting("Ms. Vega")).toBe("Good evening, Vega.");
  });
});
