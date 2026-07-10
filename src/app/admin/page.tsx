'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import type { User, TeacherGroup } from '@/server/db/types';
import { apiClient } from '@/lib/api/client';

export default function AdminPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [userStatuses, setUserStatuses] = useState<Record<string, 'active' | 'suspended'>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [teacherGroups, setTeacherGroups] = useState<TeacherGroup[]>([]);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TeacherGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [averageGrade, setAverageGrade] = useState<number | null>(null);
  const [classStats, setClassStats] = useState<
    { id: string; name: string; teacher_id: string; student_count: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [usersResponse, groupsResponse, averageResponse, classesResponse] = await Promise.all([
          apiClient.getUsers(),
          apiClient.getTeacherGroups(),
          apiClient.getStatsAverageGrades(),
          apiClient.getStatsClasses(),
        ]);
        setUsers(usersResponse.users);
        setTeacherGroups(groupsResponse);
        setAverageGrade(averageResponse.average);
        setClassStats(classesResponse.classes);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load data';
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [toast]);

  const teachers = users.filter((u) => u.role === 'teacher');
  const students = users.filter((u) => u.role === 'student');

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

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupDialogOpen(true);
  };

  const openEditGroup = (group: TeacherGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDialogOpen(true);
  };

  const handleSaveGroup = async () => {
    try {
      if (editingGroup) {
        await apiClient.updateTeacherGroup(editingGroup.id, groupName);
      } else {
        await apiClient.createTeacherGroup(groupName);
      }

      const groupsData = await apiClient.getTeacherGroups();
      setTeacherGroups(groupsData);
      setGroupDialogOpen(false);
      toast({
        title: 'Success',
        description: editingGroup ? 'Group updated' : 'Group created',
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save group';
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  const toggleUserStatus = async (userId: string) => {
    try {
      const user = users.find((u) => u.id === userId);
      if (!user) return;

      const currentStatus = userStatuses[userId] || user.status;
      const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';

      await apiClient.updateUser(userId, { status: newStatus });
      setUserStatuses({ ...userStatuses, [userId]: newStatus });
      toast({
        title: 'Status updated',
        description: `User ${newStatus === 'active' ? 'activated' : 'suspended'}`,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update user';
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Administration</h1>
        <p className="text-muted-foreground">Manage users, groups, and permissions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>System-wide statistics</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Average Grade</p>
                <p className="text-2xl font-bold">
                  {averageGrade != null ? averageGrade.toFixed(1) : 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Teachers</p>
                <p className="text-2xl font-bold">{teachers.length}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Students</p>
                <p className="text-2xl font-bold">{students.length}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Classes</p>
                <p className="text-2xl font-bold">{classStats.length}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teacher Groups</CardTitle>
          <CardDescription>Organize teachers into groups</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : (
            <>
              <div className="space-y-4">
                {teacherGroups.map((group) => (
                  <div key={group.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{group.name}</p>
                      <p className="text-sm text-muted-foreground">Created {new Date(group.created_at).toLocaleDateString()}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openEditGroup(group)}>
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-4" onClick={openCreateGroup}>
                + New Group
              </Button>
            </>
          )}
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

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Teacher Group' : 'New Teacher Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGroup}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
