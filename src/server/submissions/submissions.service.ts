import { db } from '../db/client';
import type { Submission, SubmissionVersion } from '../db/types';

// Fetch submission + latest version by ID.
export async function getSubmission(
  submissionId: string
): Promise<(Submission & { latestVersion: SubmissionVersion | undefined }) | null> {
  const submission = await db
    .selectFrom('submissions')
    .where('id', '=', submissionId)
    .selectAll()
    .executeTakeFirst();

  if (!submission) {
    return null;
  }

  const latestVersion = await db
    .selectFrom('submission_versions')
    .where('submission_id', '=', submissionId)
    .orderBy('version_number', 'desc')
    .selectAll()
    .executeTakeFirst();

  return { ...submission, latestVersion };
}

// Fetch all versions for a submission, ordered by version_number DESC.
export async function getSubmissionVersions(
  submissionId: string
): Promise<SubmissionVersion[]> {
  return db
    .selectFrom('submission_versions')
    .where('submission_id', '=', submissionId)
    .orderBy('version_number', 'desc')
    .selectAll()
    .execute();
}

// Fetch all submissions for an assignment (teacher view).
export async function listSubmissionsByAssignment(
  assignmentId: string
): Promise<Submission[]> {
  return db
    .selectFrom('submissions')
    .where('assignment_id', '=', assignmentId)
    .selectAll()
    .execute();
}

// Fetch all submissions by a student.
export async function listSubmissionsByStudent(
  studentId: string
): Promise<Submission[]> {
  return db
    .selectFrom('submissions')
    .where('student_id', '=', studentId)
    .selectAll()
    .execute();
}

// Create submission (first call) or version (resubmit), return submission with latest version.
export async function createSubmission(
  assignmentId: string,
  studentId: string,
  content: string
): Promise<Submission & { latestVersion: SubmissionVersion }> {
  let submission = await db
    .selectFrom('submissions')
    .where('assignment_id', '=', assignmentId)
    .where('student_id', '=', studentId)
    .selectAll()
    .executeTakeFirst();

  if (!submission) {
    submission = await db
      .insertInto('submissions')
      .values({
        assignment_id: assignmentId,
        student_id: studentId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  const maxVersion = await db
    .selectFrom('submission_versions')
    .where('submission_id', '=', submission.id)
    .select(
      db.fn.max('version_number').as('max_version')
    )
    .executeTakeFirst();

  const nextVersion = (maxVersion?.max_version ?? 0) + 1;

  const latestVersion = await db
    .insertInto('submission_versions')
    .values({
      submission_id: submission.id,
      version_number: nextVersion,
      content,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { ...submission, latestVersion };
}

// Fetch the most recent version for a submission.
export async function getLatestVersion(
  submissionId: string
): Promise<SubmissionVersion | undefined> {
  return db
    .selectFrom('submission_versions')
    .where('submission_id', '=', submissionId)
    .orderBy('version_number', 'desc')
    .selectAll()
    .executeTakeFirst();
}
