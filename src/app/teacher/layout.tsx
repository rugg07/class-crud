import { RoleNav } from '@/components/domain/role-nav';

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <RoleNav role="teacher" />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
