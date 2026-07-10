'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import type { Class, Assignment, Submission, Grade } from '@/server/db/types';
import { apiClient } from '@/lib/api/client';

export default function StudentPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [classAssignments, setClassAssignments] = useState<Record<string, Assignment[]>>({});
  const [assignmentStatus, setAssignmentStatus] = useState<
    Record<string, { submission: Submission; grade: Grade | null }>
  >({});
  const [submissionContent, setSubmissionContent] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

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

      // Get my submissions + grades, keyed by assignment
      const mySubmissions = await apiClient.getMySubmissions();
      const statusMap: Record<string, { submission: Submission; grade: Grade | null }> = {};
      for (const submission of mySubmissions) {
        try {
          const grade = await apiClient.getGrade(submission.id);
          statusMap[submission.assignment_id] = { submission, grade };
        } catch {
          statusMap[submission.assignment_id] = { submission, grade: null };
        }
      }
      setAssignmentStatus(statusMap);
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
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (assignmentId: string) => {
    const content = submissionContent[assignmentId] ?? '';
    if (!content.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your submission content',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(assignmentId);
      await apiClient.submitAssignment(assignmentId, content);
      setSubmissionContent({ ...submissionContent, [assignmentId]: '' });
      toast({
        title: 'Success',
        description: 'Assignment submitted',
      });
      await loadData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to submit assignment';
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(null);
    }
  };

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
                        {assignments.map((assignment) => {
                          const status = assignmentStatus[assignment.id];
                          return (
                            <div key={assignment.id} className="p-3 bg-muted rounded-md space-y-2">
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

                              {status ? (
                                <div className="text-xs space-y-1 border-t pt-2">
                                  <p className="text-muted-foreground">
                                    Submitted: {new Date(status.submission.created_at).toLocaleString()}
                                  </p>
                                  {status.grade ? (
                                    <>
                                      <Badge variant="default">{status.grade.grade}/100</Badge>
                                      {status.grade.feedback && (
                                        <p className="text-muted-foreground">{status.grade.feedback}</p>
                                      )}
                                    </>
                                  ) : (
                                    <p className="text-muted-foreground">Not graded yet</p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground border-t pt-2">Not submitted yet</p>
                              )}

                              {assignment.published_at && (
                                <div className="space-y-2 border-t pt-2">
                                  <Textarea
                                    placeholder={status ? 'Resubmit your work...' : 'Enter your submission...'}
                                    value={submissionContent[assignment.id] ?? ''}
                                    onChange={(e) =>
                                      setSubmissionContent({
                                        ...submissionContent,
                                        [assignment.id]: e.target.value,
                                      })
                                    }
                                    className="text-sm"
                                  />
                                  <Button
                                    size="sm"
                                    disabled={submitting === assignment.id}
                                    onClick={() => handleSubmit(assignment.id)}
                                  >
                                    {status ? 'Resubmit' : 'Submit'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
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
