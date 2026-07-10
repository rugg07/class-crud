import { db } from '../db/client';
import type { Grade } from '../db/types';

// Insert grade row; verify grade 0-100, submission + version exist, graded_by is teacher.
export async function recordGrade(
  submissionId: string,
  submissionVersionId: string,
  grade: number,
  feedback: string,
  gradedBy: string
): Promise<Grade> {
  if (grade < 0 || grade > 100) {
    throw new Error('Grade must be between 0 and 100');
  }

  const submission = await db
    .selectFrom('submissions')
    .where('id', '=', submissionId)
    .selectAll()
    .executeTakeFirst();

  if (!submission) {
    throw new Error('Submission not found');
  }

  const version = await db
    .selectFrom('submission_versions')
    .where('id', '=', submissionVersionId)
    .where('submission_id', '=', submissionId)
    .selectAll()
    .executeTakeFirst();

  if (!version) {
    throw new Error('Submission version not found');
  }

  const grader = await db
    .selectFrom('users')
    .where('id', '=', gradedBy)
    .selectAll()
    .executeTakeFirst();

  if (!grader || grader.role !== 'teacher') {
    throw new Error('Grader must be a teacher');
  }

  const result = await db
    .insertInto('grades')
    .values({
      submission_id: submissionId,
      graded_version_id: submissionVersionId,
      grade,
      feedback: feedback || null,
      graded_by: gradedBy,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return result;
}

// Fetch most recent grade (ORDER BY graded_at DESC LIMIT 1).
export async function getGradeForSubmission(
  submissionId: string
): Promise<Grade | null> {
  const grade = await db
    .selectFrom('grades')
    .where('submission_id', '=', submissionId)
    .orderBy('graded_at', 'desc')
    .selectAll()
    .executeTakeFirst();
  return grade ?? null;
}

// Fetch all grades for submission, ordered by graded_at DESC.
export async function getAllGradesForSubmission(
  submissionId: string
): Promise<Grade[]> {
  return db
    .selectFrom('grades')
    .where('submission_id', '=', submissionId)
    .orderBy('graded_at', 'desc')
    .selectAll()
    .execute();
}

// Fetch all grades for assignment (all submissions in assignment).
export async function getAllGradesForAssignment(
  assignmentId: string
): Promise<Grade[]> {
  return db
    .selectFrom('grades')
    .innerJoin('submissions', 'grades.submission_id', 'submissions.id')
    .where('submissions.assignment_id', '=', assignmentId)
    .selectAll()
    .orderBy('grades.graded_at', 'desc')
    .execute();
}
