import { describe, expect, it } from "vitest";
import { academicBusy, lecturerFor, nextLectureStart, slotLabel } from "./academics";

// Thursday 8 Oct 2026, 10:30 AM in Lagos = 09:30 UTC.
const THU_1030 = Date.UTC(2026, 9, 8, 9, 30);

describe("timetable", () => {
  it("labels a slot in Lagos time", () => {
    expect(slotLabel([1, 10])).toBe("Mon 10:00 AM");
    expect(slotLabel([6, 19])).toBe("Sat 7:00 PM");
  });

  it("treats a lecture that started within 2 hours as still on", () => {
    // Thursday 9 AM lecture is still within its 2-hour window at 10:30.
    expect(nextLectureStart([[4, 9]], THU_1030)).toBe(Date.UTC(2026, 9, 8, 8, 0));
  });

  it("finds the next one later in the week", () => {
    // Monday 10 AM -> next Monday 12 Oct, 09:00 UTC.
    expect(nextLectureStart([[1, 10]], THU_1030)).toBe(Date.UTC(2026, 9, 12, 9, 0));
  });

  it("picks the earliest of the two weekly lectures", () => {
    expect(nextLectureStart([[1, 10], [5, 8]], THU_1030)).toBe(Date.UTC(2026, 9, 9, 7, 0));
  });

  it("reads academic busy states", () => {
    expect(academicBusy("lecture:CSC111")).toEqual({ kind: "lecture", code: "CSC111" });
    expect(academicBusy("cafeteria_meal")).toBeNull();
  });
});

describe("lecturers", () => {
  it("always gives the same lecturer for a course", () => {
    expect(lecturerFor("CSC111")).toEqual(lecturerFor("CSC111"));
    expect(lecturerFor("CSC111").name).toMatch(/^(Dr\.|Prof\.) [A-Z][a-z]+$/);
  });
});
