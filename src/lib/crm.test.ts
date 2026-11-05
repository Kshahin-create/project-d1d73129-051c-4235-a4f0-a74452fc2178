import { describe, expect, it } from "vitest";
import { canMoveStage, isOverdue, NO_ANSWER_AUTO_CLOSE_ATTEMPTS } from "./crm";

describe("canMoveStage", () => {
  it("allows forward moves along the pipeline", () => {
    expect(canMoveStage("new", "contacted")).toBe(true);
    expect(canMoveStage("qualified", "booking_request")).toBe(true);
    expect(canMoveStage("on_hold", "pending_contract")).toBe(true);
  });

  it("rejects backward moves between open stages", () => {
    expect(canMoveStage("qualified", "new")).toBe(false);
    expect(canMoveStage("pending_contract", "offer_sent")).toBe(false);
    expect(canMoveStage("contacted", "contacted")).toBe(false);
  });

  it("allows parking from any open stage and reopening only to qualified", () => {
    expect(canMoveStage("new", "postponed")).toBe(true);
    expect(canMoveStage("offer_sent", "waitlist")).toBe(true);
    expect(canMoveStage("postponed", "qualified")).toBe(true);
    expect(canMoveStage("waitlist", "qualified")).toBe(true);
    expect(canMoveStage("postponed", "offer_sent")).toBe(false);
  });

  it("allows won only from pending_contract and never from won", () => {
    expect(canMoveStage("pending_contract", "won")).toBe(true);
    expect(canMoveStage("qualified", "won")).toBe(false);
    expect(canMoveStage("won", "qualified")).toBe(false);
  });
});

describe("isOverdue", () => {
  it("treats a missing next action as an alert", () => {
    expect(isOverdue(null)).toBe(true);
  });
  it("flags past dates and not future ones", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(isOverdue("2026-11-05T11:00:00Z", now)).toBe(true);
    expect(isOverdue("2026-11-06T11:00:00Z", now)).toBe(false);
  });
});

describe("no-answer policy", () => {
  it("auto-closes after exactly 10 unanswered attempts", () => {
    expect(NO_ANSWER_AUTO_CLOSE_ATTEMPTS).toBe(10);
  });
});
