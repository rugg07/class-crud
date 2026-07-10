import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../db/client';
import {
  recordGrade,
  getGradeForSubmission,
  getAllGradesForSubmission,
} from '../../../grades/grades.service';
import {
  createSubmission,
} from '../../../submissions/submissions.service';

describe('grades.service', () => {
  let assignmentId: string;
  let studentId: string;
  let submissionId: string;
  let teacherId: string;

  beforeEach(async () => {
    await db.deleteFrom('grades').execute();
    await db.deleteFrom('submission_versions').execute();
    await db.deleteFrom('submissions').execute();
    await db.deleteFrom('assignments').execute();
    await db.deleteFrom('classes').execute();
    await db.deleteFrom('users').execute();

    const student = await db
      .insertInto('users')
      .values({
        email: `student-${Date.now()}@test.com`,
        password_hash: null,
        name: 'Test Student',
        role: 'student',
        oauth_provider: null,
        oauth_id: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    studentId = student.id;

    const teacher = await db
      .insertInto('users')
      .values({
        email: `teacher-${Date.now()}@test.com`,
        password_hash: null,
        name: 'Test Teacher',
        role: 'teacher',
        oauth_provider: null,
        oauth_id: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    teacherId = teacher.id;

    const classRow = await db
      .insertInto('classes')
      .values({
        teacher_id: teacherId,
        name: 'Test Class',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const assignment = await db
      .insertInto('assignments')
      .values({
        class_id: classRow.id,
        title: 'Test Assignment',
        description: null,
        due_at: null,
        published_at: null,
        max_points: 100,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    assignmentId = assignment.id;

    const submission = await createSubmission(
      assignmentId,
      studentId,
      'Initial submission'
    );

    submissionId = submission.id;
  });

  it('should record grade with valid data', async () => {
    const version = await db
      .selectFrom('submission_versions')
      .where('submission_id', '=', submissionId)
      .selectAll()
      .executeTakeFirstOrThrow();

    const grade = await recordGrade(
      submissionId,
      version.id,
      85,
      'Good work',
      teacherId
    );

    expect(grade.id).toBeDefined();
    expect(grade.submission_id).toBe(submissionId);
    expect(grade.graded_version_id).toBe(version.id);
    expect(parseFloat(String(grade.grade))).toBe(85);
    expect(grade.feedback).toBe('Good work');
    expect(grade.graded_by).toBe(teacherId);
  });

  it('should reject grade outside 0-100 range', async () => {
    const version = await db
      .selectFrom('submission_versions')
      .where('submission_id', '=', submissionId)
      .selectAll()
      .executeTakeFirstOrThrow();

    await expect(
      recordGrade(submissionId, version.id, 101, '', teacherId)
    ).rejects.toThrow();

    await expect(
      recordGrade(submissionId, version.id, -1, '', teacherId)
    ).rejects.toThrow();
  });

  it('should create new grade row on regrade (append-only)', async () => {
    const version = await db
      .selectFrom('submission_versions')
      .where('submission_id', '=', submissionId)
      .selectAll()
      .executeTakeFirstOrThrow();

    const grade1 = await recordGrade(
      submissionId,
      version.id,
      75,
      'First grade',
      teacherId
    );

    const grade2 = await recordGrade(
      submissionId,
      version.id,
      85,
      'Second grade',
      teacherId
    );

    expect(grade1.id).not.toBe(grade2.id);

    const allGrades = await getAllGradesForSubmission(submissionId);
    expect(allGrades).toHaveLength(2);
  });

  it('should return most recent grade only', async () => {
    const version = await db
      .selectFrom('submission_versions')
      .where('submission_id', '=', submissionId)
      .selectAll()
      .executeTakeFirstOrThrow();

    await recordGrade(
      submissionId,
      version.id,
      75,
      'First',
      teacherId
    );

    await recordGrade(
      submissionId,
      version.id,
      85,
      'Second',
      teacherId
    );

    const latest = await getGradeForSubmission(submissionId);

    expect(latest).not.toBeNull();
    expect(parseFloat(String(latest!.grade))).toBe(85);
    expect(latest!.feedback).toBe('Second');
  });

  it('should return null when no grade exists', async () => {
    const grade = await getGradeForSubmission(submissionId);
    expect(grade).toBeNull();
  });

  it('should fetch grade history ordered by graded_at DESC', async () => {
    const version = await db
      .selectFrom('submission_versions')
      .where('submission_id', '=', submissionId)
      .selectAll()
      .executeTakeFirstOrThrow();

    const grade1 = await recordGrade(
      submissionId,
      version.id,
      70,
      'v1',
      teacherId
    );

    const grade2 = await recordGrade(
      submissionId,
      version.id,
      80,
      'v2',
      teacherId
    );

    const grade3 = await recordGrade(
      submissionId,
      version.id,
      90,
      'v3',
      teacherId
    );

    const allGrades = await getAllGradesForSubmission(submissionId);

    expect(allGrades).toHaveLength(3);
    expect(allGrades[0]?.id).toBe(grade3.id);
    expect(allGrades[1]?.id).toBe(grade2.id);
    expect(allGrades[2]?.id).toBe(grade1.id);
  });
});
