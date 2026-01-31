import React, { useState, useEffect } from 'react';
import { StudentRecord, SubjectConfig, SupplementaryExam } from '../types';
import { CLASSES } from '../constants';
import { dataService } from '../services/dataService';

const Management: React.FC = () => {
  const [activeTab, setActiveTab] = useState('students');
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOperating, setIsOperating] = useState(false);

  // Student form state
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [studentForm, setStudentForm] = useState({
    adNo: '',
    name: '',
    className: 'S1',
    semester: 'Odd' as 'Odd' | 'Even'
  });

  // Subject form state
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectConfig | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    arabicName: '',
    maxTA: 50, // Most common TA value
    maxCE: 30, // Most common CE value  
    passingTotal: 35, // 40% of 50 (20) + 50% of 30 (15) = 35
    facultyName: '',
    targetClasses: [] as string[],
    subjectType: 'general' as 'general' | 'elective',
    enrolledStudents: [] as string[]
  });

  // Student enrollment state for elective subjects
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [selectedSubjectForEnrollment, setSelectedSubjectForEnrollment] = useState<SubjectConfig | null>(null);
  const [availableStudentsForEnrollment, setAvailableStudentsForEnrollment] = useState<StudentRecord[]>([]);

  // Supplementary exam state
  const [showSupplementaryForm, setShowSupplementaryForm] = useState(false);
  const [supplementaryForm, setSupplementaryForm] = useState({
    studentId: '',
    subjectId: '',
    originalSemester: 'Odd' as 'Odd' | 'Even',
    originalYear: new Date().getFullYear() - 1,
    supplementaryYear: new Date().getFullYear()
  });
  const [supplementaryExams, setSupplementaryExams] = useState<any[]>([]);

  // Class management state
  const [showClassForm, setShowClassForm] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [customClasses, setCustomClasses] = useState<string[]>([]);
  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [csvData, setCsvData] = useState('');
  const [importResults, setImportResults] = useState<{ success: number; errors: string[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Excel export/import state
  const [isExporting, setIsExporting] = useState(false);
  const [showImportResults, setShowImportResults] = useState(false);
  const [marksImportResults, setMarksImportResults] = useState<{ success: number; errors: string[] } | null>(null);

  const tabs = [
    { id: 'students', label: 'Students', icon: 'fa-users' },
    { id: 'subjects', label: 'Subjects', icon: 'fa-book' },
    { id: 'supplementary', label: 'Supplementary', icon: 'fa-redo' },
    { id: 'classes', label: 'Classes', icon: 'fa-chalkboard' },
    { id: 'settings', label: 'Settings', icon: 'fa-cog' },
  ];

  // Load data on component mount
  useEffect(() => {
    loadData();
    // Load custom classes from localStorage
    const savedClasses = localStorage.getItem('customClasses');
    if (savedClasses) {
      setCustomClasses(JSON.parse(savedClasses));
    }
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [studentsData, subjectsData] = await Promise.all([
        dataService.getAllStudents(),
        dataService.getAllSubjects()
      ]);
      setStudents(studentsData);
      setSubjects(subjectsData);

      // Load supplementary exams after students and subjects are loaded
      if (studentsData.length > 0 && subjectsData.length > 0) {
        await loadSupplementaryExams();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Student operations
  const handleAddStudent = () => {
    setEditingStudent(null);
    setStudentForm({
      adNo: '',
      name: '',
      className: 'S1',
      semester: 'Odd'
    });
    setShowStudentForm(true);
  };

  const handleEditStudent = (student: StudentRecord) => {
    setEditingStudent(student);
    setStudentForm({
      adNo: student.adNo,
      name: student.name,
      className: student.className,
      semester: student.semester
    });
    setShowStudentForm(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.adNo.trim() || !studentForm.name.trim()) return;

    try {
      setIsOperating(true);

      if (editingStudent) {
        // Update existing student
        await dataService.updateStudent(editingStudent.id, {
          adNo: studentForm.adNo.trim(),
          name: studentForm.name.trim(),
          className: studentForm.className,
          semester: studentForm.semester
        });
      } else {
        // Add new student
        const newStudent: Omit<StudentRecord, 'id'> = {
          adNo: studentForm.adNo.trim(),
          name: studentForm.name.trim(),
          className: studentForm.className,
          semester: studentForm.semester,
          marks: {},
          grandTotal: 0,
          average: 0,
          rank: 0,
          performanceLevel: 'Needs Improvement'
        };
        await dataService.addStudent(newStudent);
      }

      // Reload data and close form
      await loadData();
      setShowStudentForm(false);
      setEditingStudent(null);

    } catch (error) {
      console.error('Error saving student:', error);
      alert('Error saving student. Please try again.');
    } finally {
      setIsOperating(false);
    }
  };

  const handleDeleteStudent = async (student: StudentRecord) => {
    console.log('Delete button clicked for student:', student.name, 'ID:', student.id);
    console.log('Full student object:', student);

    if (!student.id) {
      console.error('Student ID is missing!');
      alert('Error: Student ID is missing. Cannot delete student.');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${student.name}?`)) {
      console.log('Delete cancelled by user');
      return;
    }

    try {
      console.log('Starting delete operation...');
      setIsOperating(true);

      await dataService.deleteStudent(student.id);
      console.log('Delete operation completed, reloading data...');

      await loadData();
      console.log('Data reloaded successfully');

      alert(`${student.name} has been deleted successfully!`);
    } catch (error) {
      console.error('Error deleting student:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error deleting student: ${errorMessage}`);
    } finally {
      setIsOperating(false);
    }
  };

  // Subject operations
  const handleAddSubject = () => {
    setEditingSubject(null);
    setSubjectForm({
      name: '',
      arabicName: '',
      maxTA: 50, // Most common TA value
      maxCE: 30, // Most common CE value
      passingTotal: 35, // 40% of 50 (20) + 50% of 30 (15) = 35
      facultyName: '',
      targetClasses: [],
      subjectType: 'general',
      enrolledStudents: []
    });
    setShowSubjectForm(true);
  };

  const handleEditSubject = (subject: SubjectConfig) => {
    setEditingSubject(subject);
    setSubjectForm({
      name: subject.name,
      arabicName: subject.arabicName || '',
      maxTA: subject.maxTA,
      maxCE: subject.maxCE,
      passingTotal: subject.passingTotal,
      facultyName: subject.facultyName || '',
      targetClasses: subject.targetClasses,
      subjectType: subject.subjectType || 'general',
      enrolledStudents: subject.enrolledStudents || []
    });
    setShowSubjectForm(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name.trim()) return;

    try {
      setIsOperating(true);

      if (editingSubject) {
        // Update existing subject
        await dataService.updateSubject(editingSubject.id, {
          name: subjectForm.name.trim(),
          arabicName: subjectForm.arabicName.trim(),
          maxTA: subjectForm.maxTA,
          maxCE: subjectForm.maxCE,
          passingTotal: subjectForm.passingTotal,
          facultyName: subjectForm.facultyName.trim(),
          targetClasses: subjectForm.targetClasses,
          subjectType: subjectForm.subjectType,
          enrolledStudents: subjectForm.enrolledStudents
        });
      } else {
        // Add new subject
        const newSubject: Omit<SubjectConfig, 'id'> = {
          name: subjectForm.name.trim(),
          arabicName: subjectForm.arabicName.trim(),
          maxTA: subjectForm.maxTA,
          maxCE: subjectForm.maxCE,
          passingTotal: subjectForm.passingTotal,
          facultyName: subjectForm.facultyName.trim(),
          targetClasses: subjectForm.targetClasses,
          subjectType: subjectForm.subjectType,
          enrolledStudents: subjectForm.enrolledStudents
        };
        await dataService.addSubject(newSubject);
      }

      // Reload data and close form
      await loadData();
      setShowSubjectForm(false);
      setEditingSubject(null);

    } catch (error) {
      console.error('Error saving subject:', error);
      alert('Error saving subject. Please try again.');
    } finally {
      setIsOperating(false);
    }
  };

  const handleDeleteSubject = async (subject: SubjectConfig) => {
    console.log('Delete button clicked for subject:', subject.name, 'ID:', subject.id);
    console.log('Full subject object:', subject);

    if (!subject.id) {
      console.error('Subject ID is missing!');
      alert('Error: Subject ID is missing. Cannot delete subject.');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${subject.name}?`)) {
      console.log('Delete cancelled by user');
      return;
    }

    try {
      console.log('Starting delete operation...');
      setIsOperating(true);

      await dataService.deleteSubject(subject.id);
      console.log('Delete operation completed, reloading data...');

      await loadData();
      console.log('Data reloaded successfully');

      alert(`${subject.name} has been deleted successfully!`);
    } catch (error) {
      console.error('Error deleting subject:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error deleting subject: ${errorMessage}`);
    } finally {
      setIsOperating(false);
    }
  };

  // Student enrollment functions for elective subjects
  const handleManageEnrollment = async (subject: SubjectConfig) => {
    if (subject.subjectType !== 'elective') {
      alert('Only elective subjects support enrollment management');
      return;
    }

    setSelectedSubjectForEnrollment(subject);

    // Get all students from target classes
    const allStudents: StudentRecord[] = [];
    for (const className of subject.targetClasses) {
      const classStudents = students.filter(s => s.className === className);
      allStudents.push(...classStudents);
    }

    setAvailableStudentsForEnrollment(allStudents);
    setShowEnrollmentModal(true);
  };

  const handleToggleStudentEnrollment = async (studentId: string, isEnrolled: boolean) => {
    if (!selectedSubjectForEnrollment) return;

    try {
      setIsOperating(true);

      if (isEnrolled) {
        await dataService.unenrollStudentFromSubject(selectedSubjectForEnrollment.id, studentId);
      } else {
        await dataService.enrollStudentInSubject(selectedSubjectForEnrollment.id, studentId);
      }

      // Update local state
      const updatedEnrolledStudents = isEnrolled
        ? (selectedSubjectForEnrollment.enrolledStudents || []).filter(id => id !== studentId)
        : [...(selectedSubjectForEnrollment.enrolledStudents || []), studentId];

      setSelectedSubjectForEnrollment({
        ...selectedSubjectForEnrollment,
        enrolledStudents: updatedEnrolledStudents
      });

      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error toggling student enrollment:', error);
      alert('Error updating enrollment. Please try again.');
    } finally {
      setIsOperating(false);
    }
  };

  // Supplementary exam functions
  const loadSupplementaryExams = async () => {
    try {
      // Get all supplementary exams for current year
      const currentYear = new Date().getFullYear();
      const allSupplementaryExams = [];

      for (const subject of subjects) {
        const subjectSupplementaryExams = await dataService.getSupplementaryExamsBySubject(subject.id, currentYear);
        for (const suppExam of subjectSupplementaryExams) {
          const studentDoc = students.find(s => s.id === suppExam.studentId);
          if (studentDoc) {
            allSupplementaryExams.push({
              ...suppExam,
              studentName: studentDoc.name,
              studentAdNo: studentDoc.adNo,
              subjectName: subject.name
            });
          }
        }
      }

      setSupplementaryExams(allSupplementaryExams);
    } catch (error) {
      console.error('Error loading supplementary exams:', error);
    }
  };

  const handleAddSupplementaryExam = () => {
    setSupplementaryForm({
      studentId: '',
      subjectId: '',
      originalSemester: 'Odd',
      originalYear: new Date().getFullYear() - 1,
      supplementaryYear: new Date().getFullYear()
    });
    setShowSupplementaryForm(true);
  };

  const handleSaveSupplementaryExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplementaryForm.studentId || !supplementaryForm.subjectId) return;

    try {
      setIsOperating(true);

      const newSupplementaryExam: Omit<SupplementaryExam, 'id'> = {
        studentId: supplementaryForm.studentId,
        subjectId: supplementaryForm.subjectId,
        originalSemester: supplementaryForm.originalSemester,
        originalYear: supplementaryForm.originalYear,
        supplementaryYear: supplementaryForm.supplementaryYear,
        status: 'Pending'
      };

      await dataService.addSupplementaryExam(newSupplementaryExam);
      await loadSupplementaryExams();
      setShowSupplementaryForm(false);
      alert('Supplementary exam added successfully!');
    } catch (error) {
      console.error('Error saving supplementary exam:', error);
      alert('Error saving supplementary exam. Please try again.');
    } finally {
      setIsOperating(false);
    }
  };

  const handleDeleteSupplementaryExam = async (supplementaryExamId: string) => {
    if (!confirm('Are you sure you want to delete this supplementary exam?')) return;

    try {
      setIsOperating(true);
      await dataService.deleteSupplementaryExam(supplementaryExamId);
      await loadSupplementaryExams();
      alert('Supplementary exam deleted successfully!');
    } catch (error) {
      console.error('Error deleting supplementary exam:', error);
      alert('Error deleting supplementary exam. Please try again.');
    } finally {
      setIsOperating(false);
    }
  };

  // Class management functions
  const handleAddClass = () => {
    if (!newClassName.trim()) {
      alert('Please enter a class name');
      return;
    }

    const allClasses = [...CLASSES, ...customClasses];
    if (allClasses.includes(newClassName.trim())) {
      alert('Class already exists');
      return;
    }

    const updatedCustomClasses = [...customClasses, newClassName.trim()];
    setCustomClasses(updatedCustomClasses);
    localStorage.setItem('customClasses', JSON.stringify(updatedCustomClasses));
    setNewClassName('');
    setShowClassForm(false);
  };

  const handleDeleteClass = (className: string) => {
    if (CLASSES.includes(className)) {
      alert('Cannot delete default classes');
      return;
    }

    if (!confirm(`Are you sure you want to delete class ${className}?`)) return;

    const updatedCustomClasses = customClasses.filter(c => c !== className);
    setCustomClasses(updatedCustomClasses);
    localStorage.setItem('customClasses', JSON.stringify(updatedCustomClasses));
  };

  const getAllClasses = () => [...CLASSES, ...customClasses];

  const handleClassChange = (className: string, checked: boolean) => {
    if (checked) {
      setSubjectForm(prev => ({
        ...prev,
        targetClasses: [...prev.targetClasses, className]
      }));
    } else {
      setSubjectForm(prev => ({
        ...prev,
        targetClasses: prev.targetClasses.filter(c => c !== className)
      }));
    }
  };

  // Bulk import handlers
  const handleBulkImport = async () => {
    if (!csvData.trim()) {
      alert('Please enter CSV data');
      return;
    }

    try {
      setIsImporting(true);
      setImportResults(null);

      // Parse CSV data
      const { students, errors: parseErrors } = dataService.parseStudentCSV(csvData);

      if (parseErrors.length > 0) {
        setImportResults({ success: 0, errors: parseErrors });
        return;
      }

      if (students.length === 0) {
        setImportResults({ success: 0, errors: ['No valid student data found'] });
        return;
      }

      // Import students
      const results = await dataService.bulkImportStudents(students);
      setImportResults(results);

      // Reload data if any students were imported
      if (results.success > 0) {
        await loadData();
      }

    } catch (error) {
      console.error('Error during bulk import:', error);
      setImportResults({
        success: 0,
        errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvData(text);
    };
    reader.readAsText(file);
  };

  // Excel export/import handlers
  const handleExportMarks = async () => {
    try {
      setIsExporting(true);
      setIsOperating(true);

      await dataService.exportMarksToExcel();
      alert('Marks exported successfully! Check your downloads folder.');
    } catch (error) {
      console.error('Error exporting marks:', error);
      alert(`Error exporting marks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setIsOperating(false);
    }
  };

  const handleImportMarks = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Please select an Excel file (.xlsx or .xls)');
      return;
    }

    if (!confirm('This will import marks from the Excel file and may overwrite existing marks. Are you sure you want to continue?')) {
      // Reset the input
      event.target.value = '';
      return;
    }

    try {
      setIsOperating(true);

      const results = await dataService.importMarksFromExcel(file);
      setMarksImportResults(results);
      setShowImportResults(true);

      // Reload data to reflect changes
      await loadData();

      if (results.errors.length === 0) {
        alert(`Import completed successfully! ${results.success} records imported.`);
      } else {
        alert(`Import completed with ${results.success} successful records and ${results.errors.length} errors. Check the results for details.`);
      }
    } catch (error) {
      console.error('Error importing marks:', error);
      alert(`Error importing marks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsOperating(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = [
      ['adNo', 'name', 'className', 'semester'],
      ['001', 'Ahmed Ali', 'S1', 'Odd'],
      ['002', 'Fatima Hassan', 'S1', 'Odd'],
      ['003', 'Omar Khalid', 'D1', 'Even']
    ];

    const csvContent = sampleData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_import_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="loader-ring mb-4"></div>
          <p className="text-slate-600">Loading management data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Management</h1>
        <p className="text-slate-600 mt-2">Manage students, subjects, classes, and system settings</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
        <div className="border-b border-slate-200">
          <nav className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-6 py-4 font-bold transition-all ${activeTab === tab.id
                  ? 'bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
              >
                <i className={`fa-solid ${tab.icon}`}></i>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Students Tab */}
          {activeTab === 'students' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Student Management</h2>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowBulkImport(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
                  >
                    <i className="fa-solid fa-upload"></i>
                    Bulk Import
                  </button>
                  <button
                    onClick={handleAddStudent}
                    disabled={isOperating}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <i className="fa-solid fa-plus"></i>
                    Add Student
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                {students.length > 0 ? (
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-4 font-bold text-slate-700">Adm No</th>
                        <th className="text-left p-4 font-bold text-slate-700">Name</th>
                        <th className="text-left p-4 font-bold text-slate-700">Class</th>
                        <th className="text-left p-4 font-bold text-slate-700">Semester</th>
                        <th className="text-center p-4 font-bold text-slate-700">Total</th>
                        <th className="text-center p-4 font-bold text-slate-700">Rank</th>
                        <th className="text-center p-4 font-bold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, index) => (
                        <tr key={student.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-4 font-medium text-slate-900">{student.adNo}</td>
                          <td className="p-4 font-medium text-slate-900">{student.name}</td>
                          <td className="p-4 text-slate-600">{student.className}</td>
                          <td className="p-4 text-slate-600">{student.semester}</td>
                          <td className="p-4 text-center font-bold text-slate-900">{student.grandTotal}</td>
                          <td className="p-4 text-center">
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-bold">
                              #{student.rank}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditStudent(student)}
                                disabled={isOperating}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-all disabled:opacity-50"
                              >
                                <i className="fa-solid fa-edit"></i>
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(student)}
                                disabled={isOperating}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all disabled:opacity-50"
                              >
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-12">
                    <i className="fa-solid fa-users text-4xl text-slate-300 mb-4"></i>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No Students Found</h3>
                    <p className="text-slate-600 mb-6">The system is empty. Add students manually or use bulk import to get started.</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={handleAddStudent}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
                      >
                        <i className="fa-solid fa-plus"></i>
                        Add First Student
                      </button>
                      <button
                        onClick={() => setShowBulkImport(true)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
                      >
                        <i className="fa-solid fa-upload"></i>
                        Bulk Import
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Subjects Tab */}
          {activeTab === 'subjects' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Subject Management</h2>
                <button
                  onClick={handleAddSubject}
                  disabled={isOperating}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <i className="fa-solid fa-plus"></i>
                  Add Subject
                </button>
              </div>

              <div className="overflow-x-auto">
                {subjects.length > 0 ? (
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-4 font-bold text-slate-700">Name</th>
                        <th className="text-left p-4 font-bold text-slate-700">Arabic Name</th>
                        <th className="text-center p-4 font-bold text-slate-700">Type</th>
                        <th className="text-center p-4 font-bold text-slate-700">Max TA</th>
                        <th className="text-center p-4 font-bold text-slate-700">Max CE</th>
                        <th className="text-left p-4 font-bold text-slate-700">Faculty</th>
                        <th className="text-left p-4 font-bold text-slate-700">Classes</th>
                        <th className="text-center p-4 font-bold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map((subject, index) => (
                        <tr key={subject.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-4 font-medium text-slate-900">{subject.name}</td>
                          <td className="p-4 text-slate-600 arabic-text">{subject.arabicName}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${(subject.subjectType || 'general') === 'general'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                              }`}>
                              {(subject.subjectType || 'general').charAt(0).toUpperCase() + (subject.subjectType || 'general').slice(1)}
                            </span>
                            {(subject.subjectType || 'general') === 'elective' && (
                              <div className="text-xs text-slate-500 mt-1">
                                {(subject.enrolledStudents || []).length} enrolled
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-center text-slate-600">{subject.maxTA}</td>
                          <td className="p-4 text-center text-slate-600">{subject.maxCE}</td>
                          <td className="p-4 text-slate-600">{subject.facultyName}</td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {subject.targetClasses.map(cls => (
                                <span key={cls} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
                                  {cls}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {(subject.subjectType || 'general') === 'elective' && (
                                <button
                                  onClick={() => handleManageEnrollment(subject)}
                                  disabled={isOperating}
                                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-all disabled:opacity-50"
                                  title="Manage Student Enrollment"
                                >
                                  <i className="fa-solid fa-users"></i>
                                </button>
                              )}
                              <button
                                onClick={() => handleEditSubject(subject)}
                                disabled={isOperating}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-all disabled:opacity-50"
                              >
                                <i className="fa-solid fa-edit"></i>
                              </button>
                              <button
                                onClick={() => handleDeleteSubject(subject)}
                                disabled={isOperating}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all disabled:opacity-50"
                              >
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-12">
                    <i className="fa-solid fa-book text-4xl text-slate-300 mb-4"></i>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No Subjects Found</h3>
                    <p className="text-slate-600 mb-6">The system is empty. Add subjects to enable marks entry and result generation.</p>
                    <button
                      onClick={handleAddSubject}
                      className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 mx-auto"
                    >
                      <i className="fa-solid fa-plus"></i>
                      Add First Subject
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Supplementary Tab */}
          {activeTab === 'supplementary' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Supplementary Exams</h2>
                <button
                  onClick={handleAddSupplementaryExam}
                  disabled={isOperating}
                  className="px-4 py-2 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <i className="fa-solid fa-plus"></i>
                  Add Supplementary Exam
                </button>
              </div>

              <div className="overflow-x-auto">
                {supplementaryExams.length > 0 ? (
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-4 font-bold text-slate-700">Student</th>
                        <th className="text-left p-4 font-bold text-slate-700">Adm No</th>
                        <th className="text-left p-4 font-bold text-slate-700">Subject</th>
                        <th className="text-center p-4 font-bold text-slate-700">Original</th>
                        <th className="text-center p-4 font-bold text-slate-700">Supplementary</th>
                        <th className="text-center p-4 font-bold text-slate-700">Status</th>
                        <th className="text-center p-4 font-bold text-slate-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplementaryExams.map((suppExam, index) => (
                        <tr key={suppExam.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-4 font-medium text-slate-900">{suppExam.studentName}</td>
                          <td className="p-4 text-slate-600">{suppExam.studentAdNo}</td>
                          <td className="p-4 text-slate-600">{suppExam.subjectName}</td>
                          <td className="p-4 text-center text-slate-600">
                            {suppExam.originalSemester} {suppExam.originalYear}
                          </td>
                          <td className="p-4 text-center text-slate-600">
                            {suppExam.supplementaryYear}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${suppExam.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-orange-100 text-orange-700'
                              }`}>
                              {suppExam.status}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleDeleteSupplementaryExam(suppExam.id)}
                              disabled={isOperating}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all disabled:opacity-50"
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-12">
                    <i className="fa-solid fa-redo text-4xl text-slate-300 mb-4"></i>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No Supplementary Exams</h3>
                    <p className="text-slate-600 mb-6">No supplementary exams have been registered for this academic year.</p>
                    <button
                      onClick={handleAddSupplementaryExam}
                      className="px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all flex items-center gap-2 mx-auto"
                    >
                      <i className="fa-solid fa-plus"></i>
                      Add First Supplementary Exam
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Classes Tab */}
          {activeTab === 'classes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Class Management</h2>
                <button
                  onClick={() => setShowClassForm(true)}
                  disabled={isOperating}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <i className="fa-solid fa-plus"></i>
                  Add Class
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {getAllClasses().map((className) => {
                  const classStudents = students.filter(s => s.className === className);
                  const classSubjects = subjects.filter(s => s.targetClasses.includes(className));
                  const isCustomClass = customClasses.includes(className);

                  return (
                    <div key={className} className="bg-slate-50 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-black text-slate-900">{className}</h3>
                        <div className="flex gap-2">
                          <button className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all">
                            <i className="fa-solid fa-chart-bar text-sm"></i>
                          </button>
                          {isCustomClass && (
                            <button
                              onClick={() => handleDeleteClass(className)}
                              className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all"
                            >
                              <i className="fa-solid fa-trash text-sm"></i>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 text-sm text-slate-600">
                        <p><strong>Students:</strong> {classStudents.length}</p>
                        <p><strong>Subjects:</strong> {classSubjects.length}</p>
                        <p><strong>Type:</strong>
                          <span className={`ml-1 font-medium ${isCustomClass ? 'text-blue-600' : 'text-emerald-600'}`}>
                            {isCustomClass ? 'Custom' : 'Default'}
                          </span>
                        </p>
                        <p><strong>Status:</strong> <span className="text-emerald-600 font-medium">Active</span></p>
                        {classStudents.length > 0 && (
                          <p><strong>Avg Score:</strong> {
                            Math.round(classStudents.reduce((sum, s) => sum + s.average, 0) / classStudents.length)
                          }%</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-slate-900">System Settings</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Database Statistics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total Students</span>
                      <span className="font-bold text-slate-900">{students.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total Subjects</span>
                      <span className="font-bold text-slate-900">{subjects.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Active Classes</span>
                      <span className="font-bold text-slate-900">{CLASSES.length}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Marks Backup & Restore</h3>
                  <div className="space-y-3">
                    <button
                      onClick={handleExportMarks}
                      disabled={isOperating || students.length === 0}
                      className="w-full p-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isExporting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Exporting...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-download"></i>
                          Export Marks to Excel
                        </>
                      )}
                    </button>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleImportMarks}
                        disabled={isOperating}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        id="marks-import"
                      />
                      <label
                        htmlFor="marks-import"
                        className={`w-full p-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer ${isOperating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <i className="fa-solid fa-upload"></i>
                        Import Marks from Excel
                      </label>
                    </div>
                    <div className="text-xs text-slate-600 bg-blue-50 p-3 rounded-lg">
                      <strong>Backup Info:</strong> Export creates a complete backup of all marks, students, and subjects. Import restores marks from a previously exported file.
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Database Statistics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total Students</span>
                      <span className="font-bold text-slate-900">{students.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total Subjects</span>
                      <span className="font-bold text-slate-900">{subjects.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Active Classes</span>
                      <span className="font-bold text-slate-900">{CLASSES.length}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-6">
                  <h3 className="font-bold text-slate-900 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={loadData}
                      disabled={isOperating}
                      className="w-full p-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-refresh"></i>
                      Refresh Data
                    </button>
                    <button
                      onClick={async () => {
                        const isConnected = await dataService.testConnection();
                        alert(isConnected ? 'Firebase connection successful!' : 'Firebase connection failed!');
                      }}
                      disabled={isOperating}
                      className="w-full p-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-wifi"></i>
                      Test Connection
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm('Are you sure you want to delete ALL student data? This cannot be undone!')) {
                          try {
                            setIsOperating(true);
                            await dataService.clearAllData();
                            await loadData();
                            alert('All student data cleared successfully!');
                          } catch (error) {
                            console.error('Error clearing data:', error);
                            alert('Error clearing data. Please try again.');
                          } finally {
                            setIsOperating(false);
                          }
                        }
                      }}
                      disabled={isOperating}
                      className="w-full p-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-trash"></i>
                      Clear All Students
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm('Are you sure you want to delete ALL subject data? This cannot be undone!')) {
                          try {
                            setIsOperating(true);
                            await dataService.clearAllSubjects();
                            await loadData();
                            alert('All subject data cleared successfully!');
                          } catch (error) {
                            console.error('Error clearing subjects:', error);
                            alert('Error clearing subjects. Please try again.');
                          } finally {
                            setIsOperating(false);
                          }
                        }
                      }}
                      disabled={isOperating}
                      className="w-full p-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-book"></i>
                      Clear All Subjects
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Student Form Modal */}
      {showStudentForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-black text-slate-900 mb-4">
              {editingStudent ? 'Edit Student' : 'Add New Student'}
            </h3>

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Admission Number</label>
                <input
                  type="text"
                  value={studentForm.adNo}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, adNo: e.target.value }))}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                  disabled={isOperating}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Student Name</label>
                <input
                  type="text"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                  disabled={isOperating}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Class</label>
                <select
                  value={studentForm.className}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, className: e.target.value }))}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  disabled={isOperating}
                >
                  {getAllClasses().map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Semester</label>
                <select
                  value={studentForm.semester}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, semester: e.target.value as 'Odd' | 'Even' }))}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  disabled={isOperating}
                >
                  <option value="Odd">Odd</option>
                  <option value="Even">Even</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowStudentForm(false)}
                  disabled={isOperating}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOperating || !studentForm.adNo.trim() || !studentForm.name.trim()}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isOperating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-save"></i>
                      Save
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subject Form Modal */}
      {showSubjectForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-slate-900 mb-4">
              {editingSubject ? 'Edit Subject' : 'Add New Subject'}
            </h3>

            <form onSubmit={handleSaveSubject} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Subject Name</label>
                <input
                  type="text"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                  disabled={isOperating}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Arabic Name</label>
                <input
                  type="text"
                  value={subjectForm.arabicName}
                  onChange={(e) => setSubjectForm(prev => ({ ...prev, arabicName: e.target.value }))}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 arabic-text"
                  disabled={isOperating}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Subject Type</label>
                <select
                  value={subjectForm.subjectType}
                  onChange={(e) => setSubjectForm(prev => ({ ...prev, subjectType: e.target.value as 'general' | 'elective' }))}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  disabled={isOperating}
                >
                  <option value="general">General (All students enrolled automatically)</option>
                  <option value="elective">Elective (Manual student enrollment)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Max TA</label>
                  <select
                    value={subjectForm.maxTA}
                    onChange={(e) => {
                      const maxTA = parseInt(e.target.value);
                      const minPassingTA = Math.ceil(maxTA * 0.4); // 40% of Max TA
                      setSubjectForm(prev => ({
                        ...prev,
                        maxTA,
                        // Update passing total to reflect new TA requirement
                        passingTotal: minPassingTA + Math.ceil(prev.maxCE * 0.5)
                      }));
                    }}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    disabled={isOperating}
                  >
                    <option value={100}>100 (Passing: 40)</option>
                    <option value={70}>70 (Passing: 28)</option>
                    <option value={50}>50 (Passing: 20)</option>
                    <option value={35}>35 (Passing: 14)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Max CE</label>
                  <select
                    value={subjectForm.maxCE}
                    onChange={(e) => {
                      const maxCE = parseInt(e.target.value);
                      const minPassingCE = Math.ceil(maxCE * 0.5); // 50% of Max CE
                      setSubjectForm(prev => ({
                        ...prev,
                        maxCE,
                        // Update passing total to reflect new CE requirement
                        passingTotal: Math.ceil(prev.maxTA * 0.4) + minPassingCE
                      }));
                    }}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    disabled={isOperating}
                  >
                    <option value={50}>50 (Passing: 25)</option>
                    <option value={30}>30 (Passing: 15)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Passing Requirements</label>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="text-sm text-blue-800 space-y-1">
                    <p><strong>TA Requirement:</strong> {Math.ceil(subjectForm.maxTA * 0.4)} marks (40% of {subjectForm.maxTA})</p>
                    <p><strong>CE Requirement:</strong> {Math.ceil(subjectForm.maxCE * 0.5)} marks (50% of {subjectForm.maxCE})</p>
                    <p><strong>Both requirements must be met to pass</strong></p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Faculty Name</label>
                <input
                  type="text"
                  value={subjectForm.facultyName}
                  onChange={(e) => setSubjectForm(prev => ({ ...prev, facultyName: e.target.value }))}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  disabled={isOperating}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Target Classes</label>
                <div className="grid grid-cols-4 gap-2">
                  {getAllClasses().map(className => (
                    <label key={className} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={subjectForm.targetClasses.includes(className)}
                        onChange={(e) => handleClassChange(className, e.target.checked)}
                        className="text-emerald-600 focus:ring-emerald-500"
                        disabled={isOperating}
                      />
                      <span className="text-sm font-medium">{className}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSubjectForm(false)}
                  disabled={isOperating}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOperating || !subjectForm.name.trim()}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isOperating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-save"></i>
                      Save
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900">Bulk Import Students</h3>
              <button
                onClick={() => {
                  setShowBulkImport(false);
                  setCsvData('');
                  setImportResults(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <i className="fa-solid fa-times text-xl"></i>
              </button>
            </div>

            {/* Format Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
              <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <i className="fa-solid fa-info-circle"></i>
                CSV Format Requirements
              </h4>
              <div className="space-y-3 text-sm text-blue-800">
                <p><strong>Required Columns (in exact order):</strong></p>
                <div className="bg-white rounded-lg p-3 font-mono text-xs border">
                  adNo,name,className,semester
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p><strong>Column Descriptions:</strong></p>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li><strong>adNo:</strong> Admission number (unique)</li>
                      <li><strong>name:</strong> Full student name</li>
                      <li><strong>className:</strong> Class (S1, S2, S3, D1, D2, D3, PG1, PG2)</li>
                      <li><strong>semester:</strong> Either "Odd" or "Even"</li>
                    </ul>
                  </div>
                  <div>
                    <p><strong>Example Data:</strong></p>
                    <div className="bg-white rounded-lg p-3 font-mono text-xs border mt-2">
                      adNo,name,className,semester<br />
                      001,Ahmed Ali,S1,Odd<br />
                      002,Fatima Hassan,S1,Odd<br />
                      003,Omar Khalid,D1,Even
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={downloadSampleCSV}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all flex items-center gap-2 text-sm"
                  >
                    <i className="fa-solid fa-download"></i>
                    Download Sample CSV
                  </button>
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Upload CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isImporting}
              />
            </div>

            {/* Manual CSV Input */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Or Paste CSV Data</label>
              <textarea
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                className="w-full h-40 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="adNo,name,className,semester&#10;001,Ahmed Ali,S1,Odd&#10;002,Fatima Hassan,S1,Odd"
                disabled={isImporting}
              />
            </div>

            {/* Import Results */}
            {importResults && (
              <div className="mb-6">
                <div className={`p-4 rounded-xl border ${importResults.success > 0 && importResults.errors.length === 0
                  ? 'bg-emerald-50 border-emerald-200'
                  : importResults.success > 0
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
                  }`}>
                  <div className="flex items-center gap-2 mb-3">
                    <i className={`fa-solid ${importResults.success > 0 && importResults.errors.length === 0
                      ? 'fa-check-circle text-emerald-600'
                      : importResults.success > 0
                        ? 'fa-exclamation-triangle text-amber-600'
                        : 'fa-times-circle text-red-600'
                      }`}></i>
                    <span className="font-bold">Import Results</span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <p><strong>Successfully imported:</strong> {importResults.success} students</p>

                    {importResults.errors.length > 0 && (
                      <div>
                        <p className="font-medium text-red-700 mb-2">Errors ({importResults.errors.length}):</p>
                        <div className="max-h-32 overflow-y-auto bg-white rounded-lg p-3 border">
                          {importResults.errors.map((error, index) => (
                            <div key={index} className="text-red-600 text-xs mb-1">
                              {error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setShowBulkImport(false);
                  setCsvData('');
                  setImportResults(null);
                }}
                disabled={isImporting}
                className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkImport}
                disabled={isImporting || !csvData.trim()}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isImporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-upload"></i>
                    Import Students
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Class Form Modal */}
      {showClassForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-black text-slate-900 mb-4">Add New Class</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Class Name</label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., P3, Advanced, etc."
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowClassForm(false);
                    setNewClassName('');
                  }}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddClass}
                  disabled={!newClassName.trim()}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-plus"></i>
                  Add Class
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supplementary Exam Form Modal */}
      {showSupplementaryForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-black text-slate-900 mb-4">Add Supplementary Exam</h3>

            <form onSubmit={handleSaveSupplementaryExam} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Student</label>
                <select
                  value={supplementaryForm.studentId}
                  onChange={(e) => setSupplementaryForm(prev => ({ ...prev, studentId: e.target.value }))}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                  disabled={isOperating}
                >
                  <option value="">Select Student</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.adNo} - {student.name} ({student.className})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Subject</label>
                <select
                  value={supplementaryForm.subjectId}
                  onChange={(e) => setSupplementaryForm(prev => ({ ...prev, subjectId: e.target.value }))}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                  disabled={isOperating}
                >
                  <option value="">Select Subject</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Original Semester</label>
                  <select
                    value={supplementaryForm.originalSemester}
                    onChange={(e) => setSupplementaryForm(prev => ({ ...prev, originalSemester: e.target.value as 'Odd' | 'Even' }))}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    disabled={isOperating}
                  >
                    <option value="Odd">Odd</option>
                    <option value="Even">Even</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Original Year</label>
                  <input
                    type="number"
                    value={supplementaryForm.originalYear}
                    onChange={(e) => setSupplementaryForm(prev => ({ ...prev, originalYear: parseInt(e.target.value) || new Date().getFullYear() - 1 }))}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    min="2020"
                    max={new Date().getFullYear()}
                    disabled={isOperating}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Supplementary Year</label>
                <input
                  type="number"
                  value={supplementaryForm.supplementaryYear}
                  onChange={(e) => setSupplementaryForm(prev => ({ ...prev, supplementaryYear: parseInt(e.target.value) || new Date().getFullYear() }))}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  min="2020"
                  max={new Date().getFullYear() + 1}
                  disabled={isOperating}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSupplementaryForm(false)}
                  disabled={isOperating}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOperating || !supplementaryForm.studentId || !supplementaryForm.subjectId}
                  className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isOperating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-save"></i>
                      Save
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Enrollment Modal for Elective Subjects */}
      {showEnrollmentModal && selectedSubjectForEnrollment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900">
                Manage Student Enrollment - {selectedSubjectForEnrollment.name}
              </h3>
              <button
                onClick={() => {
                  setShowEnrollmentModal(false);
                  setSelectedSubjectForEnrollment(null);
                  setAvailableStudentsForEnrollment([]);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <i className="fa-solid fa-times text-xl"></i>
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <i className="fa-solid fa-info-circle text-purple-600"></i>
                  <span className="font-bold text-purple-900">Elective Subject Enrollment</span>
                </div>
                <p className="text-sm text-purple-800">
                  Select which students from the target classes should be enrolled in this elective subject.
                  Only enrolled students will appear in the marks entry system for this subject.
                </p>
                <div className="mt-2 text-sm text-purple-700">
                  <strong>Target Classes:</strong> {selectedSubjectForEnrollment.targetClasses.join(', ')}
                </div>
              </div>
            </div>

            {availableStudentsForEnrollment.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-4 font-bold text-slate-700">Enrolled</th>
                      <th className="text-left p-4 font-bold text-slate-700">Adm No</th>
                      <th className="text-left p-4 font-bold text-slate-700">Student Name</th>
                      <th className="text-left p-4 font-bold text-slate-700">Class</th>
                      <th className="text-left p-4 font-bold text-slate-700">Semester</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableStudentsForEnrollment.map((student, index) => {
                      const isEnrolled = (selectedSubjectForEnrollment.enrolledStudents || []).includes(student.id);
                      return (
                        <tr key={student.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-4">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={isEnrolled}
                                onChange={(e) => handleToggleStudentEnrollment(student.id, !e.target.checked)}
                                className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
                                disabled={isOperating}
                              />
                              <span className="ml-2 text-sm font-medium text-slate-700">
                                {isEnrolled ? 'Enrolled' : 'Not Enrolled'}
                              </span>
                            </label>
                          </td>
                          <td className="p-4 font-medium text-slate-900">{student.adNo}</td>
                          <td className="p-4 font-medium text-slate-900">{student.name}</td>
                          <td className="p-4 text-slate-600">{student.className}</td>
                          <td className="p-4 text-slate-600">{student.semester}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <i className="fa-solid fa-users text-4xl text-slate-300 mb-4"></i>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No Students Available</h3>
                <p className="text-slate-600">
                  No students found in the target classes for this subject.
                </p>
              </div>
            )}

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
              <div className="text-sm text-slate-600">
                {(selectedSubjectForEnrollment.enrolledStudents || []).length} of {availableStudentsForEnrollment.length} students enrolled
              </div>
              <button
                onClick={() => {
                  setShowEnrollmentModal(false);
                  setSelectedSubjectForEnrollment(null);
                  setAvailableStudentsForEnrollment([]);
                }}
                className="px-6 py-3 bg-slate-600 text-white rounded-xl font-bold hover:bg-slate-700 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Marks Import Results Modal */}
      {showImportResults && marksImportResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-slate-900">Marks Import Results</h3>
              <button
                onClick={() => setShowImportResults(false)}
                className="text-slate-400 hover:text-slate-600 text-xl"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <i className="fa-solid fa-check-circle"></i>
                  <span className="font-bold">Successfully Imported: {marksImportResults.success} records</span>
                </div>
              </div>

              {marksImportResults.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-700 mb-3">
                    <i className="fa-solid fa-exclamation-triangle"></i>
                    <span className="font-bold">Errors: {marksImportResults.errors.length}</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {marksImportResults.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-600 bg-red-100 p-2 rounded">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setShowImportResults(false)}
                  className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Management;