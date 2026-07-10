'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getStudentsForTeacher, getAssignmentsForClass, getClassesForTeacher, getGradeForSubmission, getSubmissionsForAssignment } from '@/lib/mock-data';
import { allSubmissionVersions } from '@/lib/mock-data/submissions';
import { ChevronDown } from 'lucide-react';

export default function TeacherPage() {
  const currentTeacherId = '00000000-0000-0000-0000-000000000002'; // Bob (for demo)
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, number>>({});

  const classes = getClassesForTeacher(currentTeacherId);
  const students = getStudentsForTeacher(currentTeacherId);

  const handleFeedbackSave = (studentId: string) => {
    // TODO: Save to backend
    console.log('Saving feedback for student:', studentId, feedback[studentId]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Students</h1>
        <p className="text-muted-foreground">View student submissions and provide grades & feedback</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Roster</CardTitle>
          <CardDescription>Expand each student to view their assignments and grades</CardDescription>
        </CardHeader>
        <CardContent>
          {students.length > 0 ? (
            <div className="space-y-2">
              {students.map((student) => {
                const studentClasses = classes;
                const studentSubmissions = studentClasses
                  .flatMap((c) => getAssignmentsForClass(c.id))
                  .flatMap((a) => getSubmissionsForAssignment(a.id).filter((s) => s.student_id === student.id))
                  .map((s) => {
                    const version = allSubmissionVersions.find((v) => v.submission_id === s.id && v.version_number === 1);
                    const grade = getGradeForSubmission(s.id);
                    return { submission: s, version, grade };
                  });

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
                      {studentSubmissions.length > 0 ? (
                        <>
                          <div>
                            <h4 className="font-semibold mb-3">Submissions</h4>
                            <div className="space-y-2">
                              {studentSubmissions.map(({ submission, version, grade }) => (
                                <div key={submission.id} className="p-3 bg-background border rounded-md space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium">Submission {submission.id.slice(0, 8)}</p>
                                    {grade && <Badge>{grade.grade}/{grade.submission_id.charAt(0) === '4' ? '100' : '100'}</Badge>}
                                  </div>
                                  {version && (
                                    <p className="text-sm text-muted-foreground">{version.content}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="border-t pt-4">
                            <h4 className="font-semibold mb-3">Feedback & Grade</h4>
                            <div className="space-y-3">
                              <Textarea
                                placeholder="Add feedback for this student..."
                                value={feedback[student.id] || ''}
                                onChange={(e) =>
                                  setFeedback({ ...feedback, [student.id]: e.target.value })
                                }
                                className="text-sm"
                              />
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  placeholder="Grade"
                                  min="0"
                                  max="100"
                                  value={grades[student.id] || ''}
                                  onChange={(e) =>
                                    setGrades({ ...grades, [student.id]: parseInt(e.target.value) || 0 })
                                  }
                                  className="max-w-24"
                                />
                                <span className="flex items-center text-muted-foreground">/ 100</span>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleFeedbackSave(student.id)}
                              >
                                Save Feedback & Grade
                              </Button>
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
