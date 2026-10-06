import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getMyOpenApplication } from "@/lib/game/applications";
import { finishExam, getExam, hasPassed, startOrResumeExam } from "@/lib/game/exam";
import ExamRunner from "./ExamRunner";

export default async function ExamPage() {
  const user = await requireUser();

  const app = await getMyOpenApplication();
  if (!app) redirect("/apply");
  if (app.status === "awaiting_result" || app.status === "decided") redirect("/apply/status");
  if (!hasPassed(app.exam_opens_at)) redirect("/apply/status");

  const attemptId = await startOrResumeExam(user.id);
  if (!attemptId) redirect("/apply/status");

  const exam = await getExam(user.id, attemptId);
  if (!exam) redirect("/apply/status");

  // Time already ran out (for example, the player closed the tab).
  if (exam.submitted || hasPassed(exam.expires_at)) {
    await finishExam(user.id, attemptId);
    redirect("/apply/status");
  }

  return (
    <ExamRunner
      attemptId={attemptId}
      expiresAt={exam.expires_at}
      questions={exam.questions}
    />
  );
}