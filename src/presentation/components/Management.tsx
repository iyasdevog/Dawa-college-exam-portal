import React, { useState, useEffect, useCallback } from 'react';
import { StudentRecord, SubjectConfig } from '../../domain/entities/types';
import { CLASSES } from '../../domain/entities/constants';
import { dataService } from '../../infrastructure/services/dataService';
import { useMobile } from '../hooks/useMobile';
import StudentManagement from './management/StudentManagement';
import SubjectManagement from './management/SubjectManagement';
import SupplementaryManagement from './management/SupplementaryManagement';
import ClassManagement from './management/ClassManagement';
import SettingsManagement from './management/SettingsManagement';

const Management: React.FC = () => {
  const { isMobile } = useMobile();
  const [activeTab, setActiveTab] = useState('students');
  const [isLoading, setIsLoading] = useState(true);

  // Shared Data State
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
  const [supplementaryExams, setSupplementaryExams] = useState<any[]>([]);
  const [customClasses, setCustomClasses] = useState<string[]>([]);

  const tabs = [
    { id: 'students', label: 'Students', icon: 'fa-users' },
    { id: 'subjects', label: 'Subjects', icon: 'fa-book' },
    { id: 'supplementary', label: 'Supplementary', icon: 'fa-redo' },
    { id: 'classes', label: 'Classes', icon: 'fa-chalkboard' },
    { id: 'settings', label: 'Settings', icon: 'fa-cog' },
  ];

  const loadData = useCallback(async () => {
    try {
      const [studentsData, subjectsData] = await Promise.all([
        dataService.getAllStudents(),
        dataService.getAllSubjects()
      ]);

      setStudents(studentsData);
      setSubjects(subjectsData);

      // Load supplementary if we have students/subjects
      if (studentsData.length > 0 && subjectsData.length > 0) {
        const currentYear = new Date().getFullYear();
        const allSupplementaryExams = [];

        for (const subject of subjectsData) {
          const subjectSupplementaryExams = await dataService.getSupplementaryExamsBySubject(subject.id, currentYear);
          for (const suppExam of subjectSupplementaryExams) {
            const studentDoc = studentsData.find(s => s.id === suppExam.studentId);
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
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const savedClasses = localStorage.getItem('customClasses');
    if (savedClasses) {
      setCustomClasses(JSON.parse(savedClasses));
    }
  }, [loadData]);

  const handleUpdateCustomClasses = (classes: string[]) => {
    setCustomClasses(classes);
    localStorage.setItem('customClasses', JSON.stringify(classes));
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
      <div className={isMobile ? 'text-center' : ''}>
        <h1 className={`font-black text-slate-900 tracking-tight ${isMobile ? 'text-2xl' : 'text-3xl'}`}>System Management</h1>
        <p className={`text-slate-600 mt-2 ${isMobile ? 'text-sm' : ''}`}>Manage students, subjects, classes, and system settings</p>
      </div>

      {/* Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
        <div className="border-b border-slate-200">
          {isMobile ? (
            <div className="p-4">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                {tabs.map(tab => (
                  <option key={tab.id} value={tab.id}>{tab.label}</option>
                ))}
              </select>
            </div>
          ) : (
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
          )}
        </div>

        <div className="p-6">
          {activeTab === 'students' && (
            <StudentManagement
              students={students}
              onRefresh={loadData}
              isLoading={isLoading}
            />
          )}

          {activeTab === 'subjects' && (
            <SubjectManagement
              subjects={subjects}
              students={students}
              onRefresh={loadData}
              isLoading={isLoading}
            />
          )}

          {activeTab === 'supplementary' && (
            <SupplementaryManagement
              supplementaryExams={supplementaryExams}
              students={students}
              subjects={subjects}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'classes' && (
            <ClassManagement
              customClasses={customClasses}
              onUpdateCustomClasses={handleUpdateCustomClasses}
              students={students}
              subjects={subjects}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsManagement
              onRefresh={loadData}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Management;