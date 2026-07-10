// TEMP: Mock grade data — replace with real Fastify API calls
import type { Grade } from '@/server/db/types';

export const allGrades: Grade[] = [
  {
    id: '60000000-0000-0000-0000-000000000001',
    submission_id: '40000000-0000-0000-0000-000000000001',
    graded_version_id: '50000000-0000-0000-0000-000000000001',
    grade: 85,
    feedback: 'Good work! Some minor errors in problems 15-17. Review those concepts.',
    graded_by: '00000000-0000-0000-0000-000000000002', // Bob
    graded_at: new Date('2024-02-10'),
  },
  {
    id: '60000000-0000-0000-0000-000000000002',
    submission_id: '40000000-0000-0000-0000-000000000002',
    graded_version_id: '50000000-0000-0000-0000-000000000002',
    grade: 92,
    feedback: 'Excellent submission! Clear explanations and accurate solutions.',
    graded_by: '00000000-0000-0000-0000-000000000002', // Bob
    graded_at: new Date('2024-02-11'),
  },
  {
    id: '60000000-0000-0000-0000-000000000003',
    submission_id: '40000000-0000-0000-0000-000000000004',
    graded_version_id: '50000000-0000-0000-0000-000000000004',
    grade: 88,
    feedback: 'Strong work on derivatives. Study integration for the next unit.',
    graded_by: '00000000-0000-0000-0000-000000000002', // Bob
    graded_at: new Date('2024-02-14'),
  },
  {
    id: '60000000-0000-0000-0000-000000000004',
    submission_id: '40000000-0000-0000-0000-000000000005',
    graded_version_id: '50000000-0000-0000-0000-000000000005',
    grade: 78,
    feedback: 'Good analysis, but needs more evidence from the text. See comments in document.',
    graded_by: '00000000-0000-0000-0000-000000000003', // Carol
    graded_at: new Date('2024-02-20'),
  },
];
