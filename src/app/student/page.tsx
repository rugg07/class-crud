'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import type { Class, Assignment } from '@/server/db/types';
import { apiClient } from '@/lib/api/client';

export default function StudentPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [classAssignments, setClassAssignments] = useState<Record<string, Assignment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get enrolled classes
        const classesData = await apiClient.getClasses();
        setClasses(classesData);

        // Get assignments for each class
        const assignmentsMap: Record<string, Assignment[]> = {};
        for (const classItem of classesData) {
          const assignments = await apiClient.getAssignments(classItem.id);
          assignmentsMap[classItem.id] = assignments;
        }
        setClassAssignments(assignmentsMap);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load data';
        setError(errorMsg);
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

  const enrolledClasses = classes;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Classes</h1>
        <p className="text-muted-foreground">View your enrolled classes and assignments</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <p className="text-muted-foreground">Loading your classes...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrolledClasses.map((classItem) => {
              const assignments = classAssignments[classItem.id] || [];
              return (
                <Card key={classItem.id}>
                  <CardHeader>
                    <CardTitle>{classItem.name}</CardTitle>
                    <CardDescription>
                      {assignments.length} assignment{assignments.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {assignments.length > 0 ? (
                      <div className="space-y-2">
                        {assignments.map((assignment) => (
                          <div key={assignment.id} className="p-3 bg-muted rounded-md">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm">{assignment.title}</p>
                                {assignment.due_at && (
                                  <p className="text-xs text-muted-foreground">
                                    Due: {new Date(assignment.due_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <Badge variant={assignment.published_at ? 'default' : 'secondary'}>
                                {assignment.published_at ? 'Published' : 'Draft'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No assignments yet</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {enrolledClasses.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No classes enrolled</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
