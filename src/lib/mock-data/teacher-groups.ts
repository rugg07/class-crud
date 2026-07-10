// TEMP: Mock teacher group data — replace with real Fastify API calls
import type { TeacherGroup } from '@/server/db/types';

export const allTeacherGroups: TeacherGroup[] = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    name: 'Math Department',
    created_at: new Date('2024-01-01'),
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    name: 'Humanities Department',
    created_at: new Date('2024-01-01'),
  },
];

export const allTeacherGroupMembers: Array<{
  teacher_group_id: string;
  teacher_id: string;
}> = [
  {
    teacher_group_id: '20000000-0000-0000-0000-000000000001',
    teacher_id: '00000000-0000-0000-0000-000000000002', // Bob
  },
  {
    teacher_group_id: '20000000-0000-0000-0000-000000000002',
    teacher_id: '00000000-0000-0000-0000-000000000003', // Carol
  },
];
