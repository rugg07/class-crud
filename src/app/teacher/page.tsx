'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/components/ui/use-toast';
import type { Class, User, Submission, Grade } from '@/server/db/types';
import { apiClient } from '@/lib/api/client';
import { ChevronDown } from 'lucide-react';

export default function TeacherPage() {
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [classes, setClasses] = useState<Class[]>([]);
  const [classAverages, setClassAverages] = useState<Record<string, number | null>>({});
  const [students, setStudents] = useState<User[]>([]);
  const [studentSubmissions, setStudentSubmissions] = useState<
    Record<
      string,
      Array<{
        submission: Submission;
        grade: Grade | null;
      }>
    >
  >({});
  const [submissionContent, setSubmissionContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Get classes for current teacher
        const classesData = await apiClient.getClasses();
        setClasses(classesData);

        // Get average grade per class
        const averagesMap: Record<string, number | null> = {};
        await Promise.all(
          classesData.map(async (classItem) => {
            const { average } = await apiClient.getStatsAverageGradesByClass(classItem.id);
            averagesMap[classItem.id] = average;
          })
        );
        setClassAverages(averagesMap);

        // Get all students from classes
        const allStudents = new Set<string>();
        const submissionsMap: Record<
          string,
          Array<{
            submission: Submission;
            grade: Grade | null;
          }>
        > = {};

        const contentMap: Record<string, string> = {};

        for (const classItem of classesData) {
          const classStudents = await apiClient.getClassStudents(classItem.id);
          classStudents.forEach((s) => allStudents.add(JSON.stringify(s)));

          // Get submissions for all assignments in this class
          const assignments = await apiClient.getAssignments(classItem.id);
          for (const assignment of assignments) {
            const submissions = await apiClient.getSubmissions(assignment.id);
            for (const submission of submissions) {
              const studentId = submission.student_id;
              if (!submissionsMap[studentId]) {
                submissionsMap[studentId] = [];
              }
              try {
                const grade = await apiClient.getGrade(submission.id);
                submissionsMap[studentId]!.push({
                  submission,
                  grade,
                });
              } catch {
                submissionsMap[studentId]!.push({
                  submission,
                  grade: null,
                });
              }

              const fullSubmission = await apiClient.getSubmission(submission.id);
              contentMap[submission.id] = fullSubmission.latestVersion?.content ?? '';
            }
          }
        }

        const uniqueStudents = Array.from(allStudents).map((s) => JSON.parse(s));
        setStudents(uniqueStudents);
        setStudentSubmissions(submissionsMap);
        setSubmissionContent(contentMap);
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

  const handleFeedbackSave = async (studentId: string, submissionId: string) => {
    try {
      const gradeValue = grades[`${studentId}-${submissionId}`];
      const feedbackValue = feedback[`${studentId}-${submissionId}`];

      if (gradeValue === undefined || gradeValue === null) {
        toast({
          title: 'Error',
          description: 'Please enter a grade',
          variant: 'destructive',
        });
        return;
      }

      await apiClient.gradeSubmission(submissionId, gradeValue, feedbackValue);

      toast({
        title: 'Success',
        description: 'Grade and feedback saved',
      });

      // Reload student submissions
      const classesData = await apiClient.getClasses();
      const submissionsMap: Record<
        string,
        Array<{
          submission: Submission;
          grade: Grade | null;
        }>
      > = {};
      const contentMap: Record<string, string> = {};

      for (const classItem of classesData) {
        const assignments = await apiClient.getAssignments(classItem.id);
        for (const assignment of assignments) {
          const submissions = await apiClient.getSubmissions(assignment.id);
          for (const submission of submissions) {
            const studentId = submission.student_id;
            if (!submissionsMap[studentId]) {
              submissionsMap[studentId] = [];
            }
            try {
              const grade = await apiClient.getGrade(submission.id);
              submissionsMap[studentId]!.push({
                submission,
                grade,
              });
            } catch {
              submissionsMap[studentId]!.push({
                submission,
                grade: null,
              });
            }

            const fullSubmission = await apiClient.getSubmission(submission.id);
            contentMap[submission.id] = fullSubmission.latestVersion?.content ?? '';
          }
        }
      }

      setStudentSubmissions(submissionsMap);
      setSubmissionContent(contentMap);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save feedback';
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
        <h1 className="text-3xl font-bold mb-2">My Students</h1>
        <p className="text-muted-foreground">View student submissions and provide grades & feedback</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class Averages</CardTitle>
          <CardDescription>Average grade across all submissions in each class</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : classes.length > 0 ? (
            <div className="space-y-2">
              {classes.map((classItem) => {
                const average = classAverages[classItem.id];
                return (
                  <div key={classItem.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <p className="font-medium">{classItem.name}</p>
                    <Badge variant="default">
                      {average != null ? `${average.toFixed(1)}/100` : 'N/A'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No classes yet</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Student Roster</CardTitle>
          <CardDescription>Expand each student to view their assignments and grades</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : students.length > 0 ? (
            <div className="space-y-2">
              {students.map((student) => {
                const submissions = studentSubmissions[student.id] || [];

                return (
                  <Collapsible
                    key={student.id}
                    open={expandedStudent === student.id}
                    onOpenChange={(open) => setExpandedStudent(open ? student.id : null)}
                    className="border rounded-lg overflow-hidden"
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between h-auto p-4 hover:bg-muted">
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <p className="font-medium">{student.name}</p>
                            <p className="text-sm text-muted-foreground">{student.email}</p>
                          </div>
                        </div>
                        <ChevronDown className="h-4 w-4 transition-transform" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-4 bg-muted/30 border-t space-y-4">
                      {submissions.length > 0 ? (
                        <>
                          <div>
                            <h4 className="font-semibold mb-3">Submissions</h4>
                            <div className="space-y-2">
                              {submissions.map(({ submission, grade }) => (
                                <div key={submission.id} className="p-3 bg-background border rounded-md space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium">Submission {submission.id.slice(0, 8)}</p>
                                    {grade && <Badge>{grade.grade}/100</Badge>}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Submitted: {new Date(submission.created_at).toLocaleString()}
                                  </p>
                                  <p className="text-sm whitespace-pre-wrap border-t pt-2">
                                    {submissionContent[submission.id] || 'No content'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="border-t pt-4">
                            <h4 className="font-semibold mb-3">Feedback & Grade</h4>
                            <div className="space-y-3">
                              {submissions.map(({ submission, grade }) => (
                                <div key={submission.id} className="space-y-2">
                                  <p className="text-xs text-muted-foreground">Submission {submission.id.slice(0, 8)}</p>
                                  <Textarea
                                    placeholder="Add feedback for this submission..."
                                    value={
                                      feedback[`${student.id}-${submission.id}`] ??
                                      grade?.feedback ??
                                      ''
                                    }
                                    onChange={(e) =>
                                      setFeedback({
                                        ...feedback,
                                        [`${student.id}-${submission.id}`]: e.target.value,
                                      })
                                    }
                                    className="text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <Input
                                      type="number"
                                      placeholder="Grade"
                                      min="0"
                                      max="100"
                                      value={
                                        grades[`${student.id}-${submission.id}`] ??
                                        grade?.grade ??
                                        ''
                                      }
                                      onChange={(e) =>
                                        setGrades({
                                          ...grades,
                                          [`${student.id}-${submission.id}`]: parseInt(e.target.value) || 0,
                                        })
                                      }
                                      className="max-w-24"
                                    />
                                    <span className="flex items-center text-muted-foreground">/ 100</span>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => handleFeedbackSave(student.id, submission.id)}
                                  >
                                    Save Feedback & Grade
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">No submissions yet</p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No students enrolled in your classes</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
