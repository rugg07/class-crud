import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/client';
import {
  createSubmission,
  getLatestVersion,
  getSubmission,
  getSubmissionVersions,
} from './submissions.service';

describe('submissions.service', () => {
  let assignmentId: string;
  let studentId: string;

  beforeEach(async () => {
    await db.deleteFrom('grades').execute();
    await db.deleteFrom('submission_versions').execute();
    await db.deleteFrom('submissions').execute();
    await db.deleteFrom('assignments').execute();
    await db.deleteFrom('classes').execute();
    await db.deleteFrom('users').execute();

    const user = await db
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

    studentId = user.id;

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

    const classRow = await db
      .insertInto('classes')
      .values({
        teacher_id: teacher.id,
        name: 'Test Class',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const assignment = await db
      .insertInto('assignments')
      .values({
        class_id: classRow.id,
        title: 'Test Assignment',
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow();

    assignmentId = assignment.id;
  });

  it('should create submission on first call', async () => {
    const submission = await createSubmission(
      assignmentId,
      studentId,
      'First submission'
    );

    expect(submission.id).toBeDefined();
    expect(submission.assignment_id).toBe(assignmentId);
    expect(submission.student_id).toBe(studentId);
    expect(submission.latestVersion.version_number).toBe(1);
    expect(submission.latestVersion.content).toBe('First submission');
  });

  it('should create version on resubmit', async () => {
    await createSubmission(
      assignmentId,
      studentId,
      'First submission'
    );

    const resubmission = await createSubmission(
      assignmentId,
      studentId,
      'Second submission'
    );

    expect(resubmission.latestVersion.version_number).toBe(2);
    expect(resubmission.latestVersion.content).toBe('Second submission');
  });

  it('should increment version_number on each resubmit', async () => {
    const sub1 = await createSubmission(
      assignmentId,
      studentId,
      'v1'
    );
    expect(sub1.latestVersion.version_number).toBe(1);

    const sub2 = await createSubmission(
      assignmentId,
      studentId,
      'v2'
    );
    expect(sub2.latestVersion.version_number).toBe(2);

    const sub3 = await createSubmission(
      assignmentId,
      studentId,
      'v3'
    );
    expect(sub3.latestVersion.version_number).toBe(3);
  });

  it('should fetch submission with latest version', async () => {
    const created = await createSubmission(
      assignmentId,
      studentId,
      'v1'
    );

    await createSubmission(
      assignmentId,
      studentId,
      'v2'
    );

    const fetched = await getSubmission(created.id);

    expect(fetched).not.toBeNull();
    expect(fetched?.latestVersion?.version_number).toBe(2);
    expect(fetched?.latestVersion?.content).toBe('v2');
  });

  it('should fetch all versions ordered by version_number DESC', async () => {
    const submission = await createSubmission(
      assignmentId,
      studentId,
      'v1'
    );

    await createSubmission(
      assignmentId,
      studentId,
      'v2'
    );

    await createSubmission(
      assignmentId,
      studentId,
      'v3'
    );

    const versions = await getSubmissionVersions(submission.id);

    expect(versions).toHaveLength(3);
    expect(versions[0]?.version_number).toBe(3);
    expect(versions[1]?.version_number).toBe(2);
    expect(versions[2]?.version_number).toBe(1);
  });

  it('should fetch latest version', async () => {
    const submission = await createSubmission(
      assignmentId,
      studentId,
      'v1'
    );

    await createSubmission(
      assignmentId,
      studentId,
      'v2'
    );

    const latest = await getLatestVersion(submission.id);

    expect(latest).not.toBeNull();
    expect(latest!.version_number).toBe(2);
  });
});
