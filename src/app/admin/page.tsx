'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { allUsers } from '@/lib/mock-data/users';
import { allTeacherGroups } from '@/lib/mock-data/teacher-groups';
import { useToast } from '@/components/ui/use-toast';

export default function AdminPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [userStatuses, setUserStatuses] = useState<Record<string, 'active' | 'suspended'>>({});
  const { toast } = useToast();

  const teachers = allUsers.filter((u) => u.role === 'teacher');
  const students = allUsers.filter((u) => u.role === 'student');

  const filteredTeachers = teachers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStudents = students.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUserStatus = (userId: string) => {
    const currentStatus = userStatuses[userId];
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    setUserStatuses({ ...userStatuses, [userId]: newStatus });
    toast({
      title: 'Status updated',
      description: `User ${newStatus === 'active' ? 'activated' : 'suspended'}`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Administration</h1>
        <p className="text-muted-foreground">Manage users, groups, and permissions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teacher Groups</CardTitle>
          <CardDescription>Organize teachers into groups</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allTeacherGroups.map((group) => (
              <div key={group.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{group.name}</p>
                  <p className="text-sm text-muted-foreground">Created {new Date(group.created_at).toLocaleDateString()}</p>
                </div>
                <Button variant="outline" size="sm">Edit</Button>
              </div>
            ))}
          </div>
          <Button className="w-full mt-4">+ New Group</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Manage teachers and students</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <Tabs defaultValue="teachers" className="mt-4">
            <TabsList>
              <TabsTrigger value="teachers">Teachers ({filteredTeachers.length})</TabsTrigger>
              <TabsTrigger value="students">Students ({filteredStudents.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="teachers" className="mt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeachers.map((teacher) => {
                      const status = userStatuses[teacher.id] || teacher.status;
                      return (
                        <TableRow key={teacher.id}>
                          <TableCell className="font-medium">{teacher.name}</TableCell>
                          <TableCell>{teacher.email}</TableCell>
                          <TableCell>
                            <Badge variant={status === 'active' ? 'default' : 'destructive'}>
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleUserStatus(teacher.id)}
                            >
                              {status === 'active' ? 'Suspend' : 'Activate'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="students" className="mt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => {
                      const status = userStatuses[student.id] || student.status;
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>{student.email}</TableCell>
                          <TableCell>
                            <Badge variant={status === 'active' ? 'default' : 'destructive'}>
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleUserStatus(student.id)}
                            >
                              {status === 'active' ? 'Suspend' : 'Activate'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
