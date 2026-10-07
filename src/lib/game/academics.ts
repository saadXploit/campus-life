import { formatClock } from "./time";

/** What get_academics returns. */
export type AcademicModule = {
  code: string;
  title: string;
  units: number;
  /** Two weekly lectures: [ISO weekday 1=Mon..7=Sun, hour 0-23] in Lagos time. */
  slots: [number, number][];
  attended: number;
  held: number;
  study_points: number;
  exam_written: boolean;
  live_lecture: string | null;
  attended_live: boolean;
};

export type AcademicResult = {
  semester_idx: number;
  semester_no: number;
  level_year: number;
  gpa: number | null;
  units: number | null;
  modules: { code: string; title: string; units: number; ca: number; exam: number; score: number; grade: string }[] | null;
};

export type Academics = {
  calendar: {
    semester_idx: number;
    session: string;
    semester_no: number;
    phase: "lectures" | "exams" | "holiday";
    week: number | null;
    lectures_end: string;
    exams_end: string;
    holiday_end: string;
  };
  strike: string | null;
  level_year: number | null;
  status: string | null;
  cgpa: number | null;
  total_units: number;
  course: string | null;
  uni_type: "federal" | "state" | "private" | null;
  registered: boolean;
  modules: AcademicModule[];
  results: AcademicResult[];
  server_time: string;
};

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function slotLabel([dow, hour]: [number, number]): string {
  return `${WEEKDAY_SHORT[dow - 1]} ${formatClock(hour)}`;
}

const LAGOS = 60 * 60 * 1000;
const WINDOW = 2 * 60 * 60 * 1000;

/** The start of the next lecture of these slots that has not finished yet (ms), in Lagos time. */
export function nextLectureStart(slots: [number, number][], nowMs: number): number | null {
  const lagos = new Date(nowMs + LAGOS);
  const isoToday = lagos.getUTCDay() === 0 ? 7 : lagos.getUTCDay();
  let best: number | null = null;
  for (const [dow, hour] of slots) {
    for (let add = 0; add <= 7; add++) {
      const day = ((isoToday - 1 + add) % 7) + 1;
      if (day !== dow) continue;
      const start =
        Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() + add, hour) - LAGOS;
      if (start + WINDOW > nowMs && (best === null || start < best)) best = start;
    }
  }
  return best;
}

export function semesterName(n: number): string {
  return n === 1 ? "1st Semester" : "2nd Semester";
}

export function gradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "#34d399";
    case "B":
      return "#a3e635";
    case "C":
      return "#fbbf24";
    case "D":
    case "E":
      return "#fb923c";
    default:
      return "#f87171";
  }
}

/** A short description of where the semester is. */
export function phaseLabel(a: Academics): string {
  const c = a.calendar;
  if (a.strike) return "On strike";
  if (c.phase === "lectures") return `Week ${c.week ?? 1} of lectures`;
  if (c.phase === "exams") return "Exam week";
  return "Holiday";
}

/** Busy states created by academics ("lecture:CSC111", "study:CSC111", "exam:CSC111"). */
export function academicBusy(slug: string): { kind: "lecture" | "study" | "exam"; code: string } | null {
  const m = /^(lecture|study|exam):([A-Z]{3}[0-9]{3})$/.exec(slug);
  return m ? { kind: m[1] as "lecture" | "study" | "exam", code: m[2] } : null;
}
