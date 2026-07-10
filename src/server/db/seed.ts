import { env } from '../env';
import { db } from './client';
import { hashPassword } from '../auth/password';

// Test user credentials for all users
const DEFAULT_PASSWORD = 'password123';
const hashedPassword = hashPassword(DEFAULT_PASSWORD);

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    // Clear existing data (idempotent approach with cascading deletes)
    console.log('Clearing existing data...');
    await db.deleteFrom('grades').execute();
    await db.deleteFrom('submission_versions').execute();
    await db.deleteFrom('submissions').execute();
    await db.deleteFrom('assignments').execute();
    await db.deleteFrom('enrollments').execute();
    await db.deleteFrom('classes').execute();
    await db.deleteFrom('teacher_group_members').execute();
    await db.deleteFrom('teacher_groups').execute();
    await db.deleteFrom('users').execute();

    // === CREATE USERS ===
    console.log('Creating users...');

    // 1 Admin
    const [adminUser] = await db
      .insertInto('users')
      .values({
        email: 'admin@example.com',
        password_hash: hashedPassword,
        name: 'Admin User',
        role: 'admin',
      })
      .returning(['id', 'email', 'role'])
      .execute();

    // 2 Teachers
    const teacherResult = await db
      .insertInto('users')
      .values([
        {
          email: 'teacher1@example.com',
          password_hash: hashedPassword,
          name: 'Teacher One',
          role: 'teacher',
        },
        {
          email: 'teacher2@example.com',
          password_hash: hashedPassword,
          name: 'Teacher Two',
          role: 'teacher',
        },
      ])
      .returning(['id', 'email', 'role'])
      .execute();
    const teacher1 = teacherResult[0]!;
    const teacher2 = teacherResult[1]!;

    // 5 Students
    const students = await db
      .insertInto('users')
      .values([
        {
          email: 'student1@example.com',
          password_hash: hashedPassword,
          name: 'Student One',
          role: 'student',
        },
        {
          email: 'student2@example.com',
          password_hash: hashedPassword,
          name: 'Student Two',
          role: 'student',
        },
        {
          email: 'student3@example.com',
          password_hash: hashedPassword,
          name: 'Student Three',
          role: 'student',
        },
        {
          email: 'student4@example.com',
          password_hash: hashedPassword,
          name: 'Student Four',
          role: 'student',
        },
        {
          email: 'student5@example.com',
          password_hash: hashedPassword,
          name: 'Student Five',
          role: 'student',
        },
      ])
      .returning(['id', 'email', 'role'])
      .execute();

    console.log(`✅ Created users: 1 admin, 2 teachers, 5 students`);

    // === CREATE TEACHER GROUPS ===
    console.log('Creating teacher group...');

    const teacherGroupResult = await db
      .insertInto('teacher_groups')
      .values({
        name: 'Math Department',
      })
      .returning(['id', 'name'])
      .execute();
    const teacherGroup = teacherGroupResult[0]!;

    // Add both teachers to the group
    await db
      .insertInto('teacher_group_members')
      .values([
        {
          teacher_group_id: teacherGroup.id,
          teacher_id: teacher1.id,
        },
        {
          teacher_group_id: teacherGroup.id,
          teacher_id: teacher2.id,
        },
      ])
      .execute();

    console.log(`✅ Created 1 teacher group with 2 teachers`);

    // === CREATE CLASSES ===
    console.log('Creating classes...');

    const classResult = await db
      .insertInto('classes')
      .values([
        {
          teacher_id: teacher1.id,
          name: 'Algebra 101',
        },
        {
          teacher_id: teacher2.id,
          name: 'Geometry 201',
        },
      ])
      .returning(['id', 'name', 'teacher_id'])
      .execute();
    const class1 = classResult[0]!;
    const class2 = classResult[1]!;

    console.log(`✅ Created 2 classes`);

    // === CREATE ENROLLMENTS ===
    console.log('Creating student enrollments...');

    // Class 1: students 1, 2, 3 (3 students)
    // Class 2: students 3, 4, 5 (3 students, overlap on student3)
    await db
      .insertInto('enrollments')
      .values([
        { class_id: class1.id, student_id: students[0]!.id },
        { class_id: class1.id, student_id: students[1]!.id },
        { class_id: class1.id, student_id: students[2]!.id },
        { class_id: class2.id, student_id: students[2]!.id },
        { class_id: class2.id, student_id: students[3]!.id },
        { class_id: class2.id, student_id: students[4]!.id },
      ])
      .execute();

    console.log(`✅ Created 6 enrollments (3 per class)`);

    // === CREATE ASSIGNMENTS ===
    console.log('Creating assignments...');

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Class 1: 3 assignments (1 draft, 2 published)
    const class1Assignments = await db
      .insertInto('assignments')
      .values([
        {
          class_id: class1.id,
          title: 'Algebra Basics Quiz',
          description: 'Test your knowledge of basic algebraic concepts',
          due_at: tomorrow.toISOString(),
          published_at: now.toISOString(),
          max_points: 100,
        },
        {
          class_id: class1.id,
          title: 'Linear Equations Practice',
          description: 'Solve 20 linear equations',
          due_at: nextWeek.toISOString(),
          published_at: now.toISOString(),
          max_points: 50,
        },
        {
          class_id: class1.id,
          title: 'Quadratic Equations Project',
          description: 'Create and solve a quadratic equation problem set',
          due_at: null,
          published_at: null, // Draft
          max_points: 75,
        },
      ])
      .returning(['id', 'title', 'published_at'])
      .execute();

    // Class 2: 3 assignments (2 draft, 1 published)
    const class2Assignments = await db
      .insertInto('assignments')
      .values([
        {
          class_id: class2.id,
          title: 'Geometry Fundamentals',
          description: 'Learn the basics of geometry',
          due_at: tomorrow.toISOString(),
          published_at: now.toISOString(),
          max_points: 100,
        },
        {
          class_id: class2.id,
          title: 'Triangle Properties',
          description: 'Explore properties of triangles',
          due_at: null,
          published_at: null, // Draft
          max_points: 60,
        },
        {
          class_id: class2.id,
          title: 'Circle Theorems',
          description: 'Prove and apply circle theorems',
          due_at: null,
          published_at: null, // Draft
          max_points: 80,
        },
      ])
      .returning(['id', 'title', 'published_at'])
      .execute();

    console.log(`✅ Created 6 assignments (3 per class, mix of draft/published)`);

    // === CREATE SUBMISSIONS ===
    console.log('Creating submissions and versions...');

    // For each published assignment, create 2-3 submissions
    // Assignment 1 (published): submissions from students 1, 2, 3
    const sub1_1 = await db
      .insertInto('submissions')
      .values({
        assignment_id: class1Assignments[0]!.id,
        student_id: students[0]!.id,
      })
      .returning('id')
      .executeTakeFirst();

    const sub1_2 = await db
      .insertInto('submissions')
      .values({
        assignment_id: class1Assignments[0]!.id,
        student_id: students[1]!.id,
      })
      .returning('id')
      .executeTakeFirst();

    const sub1_3 = await db
      .insertInto('submissions')
      .values({
        assignment_id: class1Assignments[0]!.id,
        student_id: students[2]!.id,
      })
      .returning('id')
      .executeTakeFirst();

    // Assignment 2 (published): submissions from students 1, 2
    const sub2_1 = await db
      .insertInto('submissions')
      .values({
        assignment_id: class1Assignments[1]!.id,
        student_id: students[0]!.id,
      })
      .returning('id')
      .executeTakeFirst();

    const sub2_2 = await db
      .insertInto('submissions')
      .values({
        assignment_id: class1Assignments[1]!.id,
        student_id: students[1]!.id,
      })
      .returning('id')
      .executeTakeFirst();

    // Assignment 4 (published in class 2): submissions from students 3, 4
    const sub4_1 = await db
      .insertInto('submissions')
      .values({
        assignment_id: class2Assignments[0]!.id,
        student_id: students[2]!.id,
      })
      .returning('id')
      .executeTakeFirst();

    const sub4_2 = await db
      .insertInto('submissions')
      .values({
        assignment_id: class2Assignments[0]!.id,
        student_id: students[3]!.id,
      })
      .returning('id')
      .executeTakeFirst();

    // Create submission versions for each submission
    const submissionVersionData = [
      {
        submission_id: sub1_1!.id,
        version_number: 1,
        content: 'Answers: 1. x=5, 2. y=10, 3. z=3',
        submitted_at: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      },
      {
        submission_id: sub1_2!.id,
        version_number: 1,
        content: 'All problems solved step by step',
        submitted_at: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        submission_id: sub1_3!.id,
        version_number: 1,
        content: 'Quick answers without work shown',
        submitted_at: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      },
      {
        submission_id: sub2_1!.id,
        version_number: 1,
        content: 'Equation 1: 2x + 5 = 15, x = 5',
        submitted_at: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      },
      {
        submission_id: sub2_2!.id,
        version_number: 1,
        content: 'All 20 equations completed',
        submitted_at: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
      },
      {
        submission_id: sub4_1!.id,
        version_number: 1,
        content: 'Basic geometry facts collected',
        submitted_at: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
      },
      {
        submission_id: sub4_2!.id,
        version_number: 1,
        content: 'Comprehensive geometry notes',
        submitted_at: new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString(),
      },
    ];

    await db
      .insertInto('submission_versions')
      .values(submissionVersionData)
      .execute();

    console.log(`✅ Created 7 submissions with versions`);

    // === CREATE GRADES ===
    console.log('Creating grades...');

    // Get the version IDs we just created
    const versions = await db
      .selectFrom('submission_versions')
      .select(['id', 'submission_id'])
      .execute();

    const versionMap = new Map(versions.map((v) => [v.submission_id, v.id]));

    // Grade some submissions
    const gradesToInsert = [
      {
        submission_id: sub1_1!.id,
        graded_version_id: versionMap.get(sub1_1!.id)!,
        grade: 85,
        feedback: 'Good work! Make sure to show all steps next time.',
        graded_by: teacher1.id,
        graded_at: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      },
      {
        submission_id: sub1_2!.id,
        graded_version_id: versionMap.get(sub1_2!.id)!,
        grade: 95,
        feedback: 'Excellent! Clear and thorough work.',
        graded_by: teacher1.id,
        graded_at: new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString(),
      },
      {
        submission_id: sub4_1!.id,
        graded_version_id: versionMap.get(sub4_1!.id)!,
        grade: 70,
        feedback: 'Needs more detail. Review the definitions.',
        graded_by: teacher2.id,
        graded_at: new Date(now.getTime() + 10 * 60 * 60 * 1000).toISOString(),
      },
    ];

    await db
      .insertInto('grades')
      .values(gradesToInsert)
      .execute();

    console.log(`✅ Created 3 grades on submissions`);

    console.log('\n✨ Seed complete!');
    console.log('\nTest credentials (all use password: password123):');
    console.log(`  Admin: admin@example.com`);
    console.log(`  Teacher: teacher1@example.com`);
    console.log(`  Teacher: teacher2@example.com`);
    console.log(`  Student: student1@example.com - student5@example.com`);

    await db.destroy();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    await db.destroy();
    process.exit(1);
  }
}

seed();
