import { describe, expect, it } from "vitest";
import { hoursLabel, jobOpen, nextRaise, notEligible, requirementText, workBusy, type GameJob } from "./jobs";
import { CAMPUS_STAFF, bossFor, staffOnDuty } from "./staff";
import { BOSS_SPOTS, WORK_SPOTS, spotFor } from "./interiors";

const job = (over: Partial<GameJob> = {}): GameJob => ({
  slug: "club_bartender",
  name: "Club bartender",
  description: "",
  location_kind: "clubhouse",
  boss_name: "Big Tunde",
  boss_title: "Club Manager",
  pay_kobo: 2_000_000,
  shift_minutes: 120,
  energy_cost: 25,
  happiness_delta: -2,
  open_hour: 18,
  close_hour: 2,
  min_level: 1,
  min_cgpa: null,
  min_age: 18,
  ...over,
});

describe("jobs", () => {
  it("knows working hours, including night shifts past midnight", () => {
    expect(jobOpen(8, 18, 8)).toBe(true);
    expect(jobOpen(8, 18, 18)).toBe(false);
    expect(jobOpen(18, 2, 23)).toBe(true);
    expect(jobOpen(18, 2, 1.5)).toBe(true);
    expect(jobOpen(18, 2, 12)).toBe(false);
    expect(hoursLabel(18, 2)).toBe("6pm – 2am");
    expect(hoursLabel(0, 0)).toBe("Open all day");
  });

  it("reads work shifts from the busy state", () => {
    expect(workBusy("work:pos_agent")).toBe("pos_agent");
    expect(workBusy("lecture:CSC111")).toBeNull();
  });

  it("explains requirements and who qualifies", () => {
    expect(requirementText(job())).toBe("18+");
    expect(notEligible(job(), { level: 1, cgpa: null, age: 17 })).toBe("Only for 18+");
    expect(notEligible(job(), { level: 1, cgpa: null, age: 20 })).toBeNull();
    const tutor = job({ min_cgpa: 3.5, min_age: 16 });
    expect(notEligible(tutor, { level: 3, cgpa: 3.2, age: 20 })).toMatch(/CGPA/);
    expect(notEligible(tutor, { level: 3, cgpa: 3.6, age: 20 })).toBeNull();
  });

  it("shows the next raise", () => {
    expect(nextRaise(3)?.at).toBe(10);
    expect(nextRaise(12)?.at).toBe(30);
    expect(nextRaise(30)).toBeNull();
  });
});

describe("campus staff", () => {
  it("are on duty only during their hours", () => {
    const noon = staffOnDuty(12, []).map((s) => s.id);
    const midnight = staffOnDuty(0, []).map((s) => s.id);
    expect(noon).toContain("gate-day-1");
    expect(noon).not.toContain("gate-night");
    expect(midnight).toContain("gate-night");
    expect(midnight).not.toContain("faculty-patrol");
  });

  it("there is always security at the gate", () => {
    for (let h = 0; h < 24; h++) {
      expect(staffOnDuty(h, []).some((s) => s.kind === "market" && s.uniform === "security")).toBe(true);
    }
  });

  it("stay few in number at any hour, however many players there are", () => {
    for (let h = 0; h < 24; h++) expect(staffOnDuty(h, [job()]).length).toBeLessThanOrEqual(12);
  });

  it("bosses work inside their room, or by the door for outdoor places", () => {
    expect(bossFor(job()).indoors).toBe(true);
    expect(BOSS_SPOTS.clubhouse).toBeDefined();
    expect(bossFor(job({ location_kind: "market" })).indoors).toBe(false);
    expect(bossFor(job({ location_kind: "hostel" })).indoors).toBe(false);
    expect(staffOnDuty(12, [job()]).some((s) => s.jobSlug === "club_bartender")).toBe(false);
    expect(staffOnDuty(20, [job()]).some((s) => s.jobSlug === "club_bartender")).toBe(true);
  });

  it("each staff member has a stable look and unique id", () => {
    const ids = CAMPUS_STAFF.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(bossFor(job()).avatar).toEqual(bossFor(job()).avatar);
  });

  it("you stand at your post while working", () => {
    expect(spotFor("work:club_bartender", "busy", "clubhouse")).toBe(WORK_SPOTS.clubhouse);
    expect(spotFor("work:pos_agent", "busy", null).pose).toBe("busy");
  });
});
