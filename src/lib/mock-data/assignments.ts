// TEMP: Mock assignment data — replace with real Fastify API calls
import type { Assignment } from '@/server/db/types';

export const allAssignments: Assignment[] = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    class_id: '10000000-0000-0000-0000-000000000001', // Math 101
    title: 'Algebra Basics',
    description: 'Complete exercises 1-20 from chapter 2',
    due_at: new Date('2024-02-15'),
    published_at: new Date('2024-02-01'),
    created_at: new Date('2024-02-01'),
    max_points: 100,
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    class_id: '10000000-0000-0000-0000-000000000001', // Math 101
    title: 'Midterm Exam',
    description: null,
    due_at: new Date('2024-03-15'),
    published_at: null, // Not yet published
    created_at: new Date('2024-02-10'),
    max_points: 100,
  },
  {
    id: '30000000-0000-0000-0000-000000000003',
    class_id: '10000000-0000-0000-0000-000000000002', // Advanced Calculus
    title: 'Derivatives Problem Set',
    description: 'Complete all odd-numbered problems',
    due_at: new Date('2024-02-20'),
    published_at: new Date('2024-02-05'),
    created_at: new Date('2024-02-05'),
    max_points: 100,
  },
  {
    id: '30000000-0000-0000-0000-000000000004',
    class_id: '10000000-0000-0000-0000-000000000003', // English Literature
    title: 'Essay: Themes in Shakespeare',
    description: 'Write a 2000-word essay analyzing themes in Hamlet',
    due_at: new Date('2024-02-25'),
    published_at: new Date('2024-02-08'),
    created_at: new Date('2024-02-08'),
    max_points: 100,
  },
];
