// TEMP: Mock enrollment data — replace with real Fastify API calls
import type { Enrollment } from '@/server/db/types';

export const allEnrollments: Enrollment[] = [
  // Math 101 enrollments
  {
    class_id: '10000000-0000-0000-0000-000000000001',
    student_id: '00000000-0000-0000-0000-000000000004', // David
    enrolled_at: new Date('2024-01-16'),
  },
  {
    class_id: '10000000-0000-0000-0000-000000000001',
    student_id: '00000000-0000-0000-0000-000000000005', // Emma
    enrolled_at: new Date('2024-01-16'),
  },
  {
    class_id: '10000000-0000-0000-0000-000000000001',
    student_id: '00000000-0000-0000-0000-000000000006', // Frank
    enrolled_at: new Date('2024-01-16'),
  },
  // Advanced Calculus enrollments
  {
    class_id: '10000000-0000-0000-0000-000000000002',
    student_id: '00000000-0000-0000-0000-000000000005', // Emma
    enrolled_at: new Date('2024-01-22'),
  },
  {
    class_id: '10000000-0000-0000-0000-000000000002',
    student_id: '00000000-0000-0000-0000-000000000006', // Frank
    enrolled_at: new Date('2024-01-22'),
  },
  // English Literature enrollments
  {
    class_id: '10000000-0000-0000-0000-000000000003',
    student_id: '00000000-0000-0000-0000-000000000004', // David
    enrolled_at: new Date('2024-01-19'),
  },
  {
    class_id: '10000000-0000-0000-0000-000000000003',
    student_id: '00000000-0000-0000-0000-000000000007', // Grace (suspended)
    enrolled_at: new Date('2024-01-19'),
  },
];
