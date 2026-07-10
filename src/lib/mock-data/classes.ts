// TEMP: Mock class data — replace with real Fastify API calls
import type { Class } from '@/server/db/types';

export const allClasses: Class[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    teacher_id: '00000000-0000-0000-0000-000000000002', // Bob Teacher
    name: 'Mathematics 101',
    created_at: new Date('2024-01-15'),
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    teacher_id: '00000000-0000-0000-0000-000000000002', // Bob Teacher
    name: 'Advanced Calculus',
    created_at: new Date('2024-01-20'),
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    teacher_id: '00000000-0000-0000-0000-000000000003', // Carol Teacher
    name: 'English Literature',
    created_at: new Date('2024-01-18'),
  },
];
