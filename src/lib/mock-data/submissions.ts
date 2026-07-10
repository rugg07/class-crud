// TEMP: Mock submission data — replace with real Fastify API calls
import type { Submission, SubmissionVersion } from '@/server/db/types';

export const allSubmissions: Submission[] = [
  {
    id: '40000000-0000-0000-0000-000000000001',
    assignment_id: '30000000-0000-0000-0000-000000000001', // Algebra Basics
    student_id: '00000000-0000-0000-0000-000000000004', // David
    created_at: new Date('2024-02-05'),
  },
  {
    id: '40000000-0000-0000-0000-000000000002',
    assignment_id: '30000000-0000-0000-0000-000000000001', // Algebra Basics
    student_id: '00000000-0000-0000-0000-000000000005', // Emma
    created_at: new Date('2024-02-06'),
  },
  {
    id: '40000000-0000-0000-0000-000000000003',
    assignment_id: '30000000-0000-0000-0000-000000000001', // Algebra Basics
    student_id: '00000000-0000-0000-0000-000000000006', // Frank
    created_at: new Date('2024-02-07'),
  },
  {
    id: '40000000-0000-0000-0000-000000000004',
    assignment_id: '30000000-0000-0000-0000-000000000003', // Derivatives Problem Set
    student_id: '00000000-0000-0000-0000-000000000005', // Emma
    created_at: new Date('2024-02-12'),
  },
  {
    id: '40000000-0000-0000-0000-000000000005',
    assignment_id: '30000000-0000-0000-0000-000000000004', // Essay
    student_id: '00000000-0000-0000-0000-000000000004', // David
    created_at: new Date('2024-02-15'),
  },
];

export const allSubmissionVersions: SubmissionVersion[] = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    submission_id: '40000000-0000-0000-0000-000000000001',
    version_number: 1,
    content: 'Completed exercises 1-20. All answers attached.',
    submitted_at: new Date('2024-02-05'),
    file_url: null,
    file_name: null,
    mime_type: null,
    file_size: null,
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    submission_id: '40000000-0000-0000-0000-000000000002',
    version_number: 1,
    content: 'Initial submission of algebra homework.',
    submitted_at: new Date('2024-02-06'),
    file_url: 's3://submissions/emma-algebra.pdf',
    file_name: 'algebra-homework.pdf',
    mime_type: 'application/pdf',
    file_size: 245000,
  },
  {
    id: '50000000-0000-0000-0000-000000000003',
    submission_id: '40000000-0000-0000-0000-000000000003',
    version_number: 1,
    content: 'Completed all exercises as requested.',
    submitted_at: new Date('2024-02-07'),
    file_url: null,
    file_name: null,
    mime_type: null,
    file_size: null,
  },
  {
    id: '50000000-0000-0000-0000-000000000004',
    submission_id: '40000000-0000-0000-0000-000000000004',
    version_number: 1,
    content: 'Derivatives problem set solutions.',
    submitted_at: new Date('2024-02-12'),
    file_url: 's3://submissions/emma-derivatives.pdf',
    file_name: 'derivatives-solutions.pdf',
    mime_type: 'application/pdf',
    file_size: 320000,
  },
  {
    id: '50000000-0000-0000-0000-000000000005',
    submission_id: '40000000-0000-0000-0000-000000000005',
    version_number: 1,
    content: 'Essay on Hamlet themes and analysis.',
    submitted_at: new Date('2024-02-15'),
    file_url: 's3://submissions/david-hamlet-essay.docx',
    file_name: 'hamlet-essay.docx',
    mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    file_size: 125000,
  },
];
