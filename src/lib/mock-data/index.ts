// TEMP: Mock data for frontend-only increment
// Replace with Fastify API calls per PLAN.md when backend is ready

import * as users from './users';
import * as classes from './classes';
import * as enrollments from './enrollments';
import * as teacherGroups from './teacher-groups';
import * as assignments from './assignments';
import * as submissions from './submissions';
import * as grades from './grades';

export { users, classes, enrollments, teacherGroups, assignments, submissions, grades };

// Helper functions that mimic eventual service layer signatures
export function getStudentsForTeacher(teacherId: string) {
  const teacherEnrollments = enrollments.allEnrollments.filter((e) => {
    const classData = classes.allClasses.find((c) => c.id === e.class_id);
    return classData?.teacher_id === teacherId;
  });

  return teacherEnrollments
    .map((e) => users.allUsers.find((u) => u.id === e.student_id))
    .filter(Boolean) as typeof users.allUsers;
}

export function getAssignmentsForClass(classId: string) {
  return assignments.allAssignments.filter((a) => a.class_id === classId);
}

export function getClassesForTeacher(teacherId: string) {
  return classes.allClasses.filter((c) => c.teacher_id === teacherId);
}

export function getEnrolledClasses(studentId: string) {
  const studentEnrollments = enrollments.allEnrollments.filter(
    (e) => e.student_id === studentId
  );
  return studentEnrollments
    .map((e) => classes.allClasses.find((c) => c.id === e.class_id))
    .filter(Boolean) as typeof classes.allClasses;
}

export function getSubmissionsForAssignment(assignmentId: string) {
  return submissions.allSubmissions.filter((s) => s.assignment_id === assignmentId);
}

export function getGradeForSubmission(submissionId: string) {
  return grades.allGrades.find((g) => g.submission_id === submissionId);
}

export function getTeacherName(teacherId: string) {
  return users.allUsers.find((u) => u.id === teacherId)?.name || 'Unknown';
}

export function getStudentName(studentId: string) {
  return users.allUsers.find((u) => u.id === studentId)?.name || 'Unknown';
}
