import { RoleNav } from '@/components/domain/role-nav';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <RoleNav role="student" />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
