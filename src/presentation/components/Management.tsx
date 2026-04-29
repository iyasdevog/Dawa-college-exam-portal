import React, { useState, useEffect, useCallback } from 'react';
import { StudentRecord, SubjectConfig } from '../../domain/entities/types';
import { SYSTEM_CLASSES as CLASSES } from '../../domain/entities/constants';
import { dataService } from '../../infrastructure/services/dataService';
import { useMobile } from '../hooks/useMobile';
import StudentManagement from './management/StudentManagement';
import SubjectManagement from './management/SubjectManagement';
import SupplementaryManagement from './management/SupplementaryManagement';
import ClassManagement from './management/ClassManagement';
import SettingsManagement from './management/SettingsManagement';
import AttendanceManagement from './management/AttendanceManagement';
import CurriculumManagement from './management/CurriculumManagement';
import { useTerm } from '../viewmodels/TermContext';

const Management: React.FC = () => {
  const { isMobile } = useMobile();
  const { activeTerm, systemTerm, isHistoricalTerm } = useTerm();
  const [activeTab, setActiveTab] = useState('students');
  const [isLoading, setIsLoading] = useState(true);

  // Shared Data State
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
  const [supplementaryExams, setSupplementaryExams] = useState<any[]>([]);
  const [customClasses, setCustomClasses] = useState<string[]>([]);
  const [disabledClasses, setDisabledClasses] = useState<string[]>([]);
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [loadedData, setLoadedData] = useState<Set<string>>(new Set());
  const [isDataActionLoading, setIsDataActionLoading] = useState(false);

  const tabs = [
    { id: 'students', label: 'Students', icon: 'fa-users' },
    { id: 'subjects', label: 'Subjects', icon: 'fa-book' },
    { id: 'curriculum', label: 'Curriculum', icon: 'fa-sitemap' },
    { id: 'supplementary', label: 'Supplementary', icon: 'fa-redo' },
    { id: 'classes', label: 'Classes', icon: 'fa-chalkboard' },
    { id: 'settings', label: 'Settings', icon: 'fa-cog' },
  ];

  const loadTabData = useCallback(async (tabId: string, force = false) => {
    if (loadedData.has(tabId) && !force) return;

    setIsDataActionLoading(true);
    try {
      if (tabId === 'students' || tabId === 'subjects' || tabId === 'supplementary' || tabId === 'classes') {
        const [studentData, subjectData, settings] = await Promise.all([
          dataService.getAllStudents(activeTerm),
          dataService.getAllSubjects(activeTerm),
          dataService.getGlobalSettings()
        ]);
        setStudents(studentData);
        setSubjects(subjectData);
        setCustomClasses(settings.customClasses || []);
        setDisabledClasses(settings.disabledClasses || []);
      }

      if (tabId === 'supplementary') {
        const suppData = await dataService.getAllSupplementaryExams(activeTerm);
        setSupplementaryExams(suppData);
      }

      if (tabId === 'curriculum') {
        const currData = await dataService.getAllCurriculum();
        setCurriculum(currData);
      }

      setLoadedData(prev => new Set(prev).add(tabId));
    } catch (error) {
      console.error(`Error loading data for tab ${tabId}:`, error);
    } finally {
      setIsDataActionLoading(false);
      setIsLoading(false);
    }
  }, [activeTerm, loadedData]);

  useEffect(() => {
    // Reset loaded states when term changes
    setLoadedData(new Set());
    loadTabData(activeTab, true);
  }, [activeTerm]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  useEffect(() => {
    // Initial data load for default tab
    loadTabData(activeTab);
  }, []);

  const handleRefresh = async () => {
    await loadTabData(activeTab, true);
  };

  const handleUpdateCustomClasses = async (classes: string[]) => {
    setCustomClasses(classes);
    try {
      await dataService.updateGlobalSettings({ customClasses: classes });
    } catch (error) {
      console.error('Error updating custom classes:', error);
      alert('Failed to save class changes to database.');
    }
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

      {/* Historical Semester Warning Banner */}
      {isHistoricalTerm && activeTab !== 'supplementary' && (
        <div className="flex items-start gap-4 bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4 shadow-sm">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mt-0.5">
                <i className="fa-solid fa-triangle-exclamation text-amber-600 text-lg"></i>
            </div>
            <div>
                <p className="font-bold text-amber-800 text-sm">Caution: Managing Historical Semester</p>
                <p className="text-amber-700 text-xs mt-1">
                    You are currently modifying configuration for <span className="font-semibold">{activeTerm}</span>, which is a past semester. 
                    Changes made here directly affect historical records. Please proceed with caution.
                </p>
            </div>
        </div>
      )}

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

        <div className="p-4 sm:p-6">
          {activeTab === 'students' && (
            <StudentManagement
              students={students}
              activeTerm={activeTerm}
              onRefresh={handleRefresh}
              isLoading={isDataActionLoading}
            />
          )}

          {activeTab === 'subjects' && (
            <SubjectManagement
              subjects={subjects}
              students={students}
              curriculum={curriculum}
              activeTerm={activeTerm}
              onRefresh={handleRefresh}
              isLoading={isDataActionLoading}
            />
          )}

          {activeTab === 'curriculum' && (
            <CurriculumManagement
              curriculum={curriculum}
              activeTerm={activeTerm}
              onRefresh={handleRefresh}
              isLoading={isDataActionLoading}
            />
          )}

          {activeTab === 'supplementary' && (
            <SupplementaryManagement
              supplementaryExams={supplementaryExams}
              students={students}
              subjects={subjects}
              onRefresh={handleRefresh}
            />
          )}


          {activeTab === 'classes' && (
            <ClassManagement
              customClasses={customClasses}
              disabledClasses={disabledClasses}
              onUpdateCustomClasses={handleUpdateCustomClasses}
              students={students}
              subjects={subjects}
              onRefresh={handleRefresh}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsManagement
              onRefresh={handleRefresh}
              onNavigate={setActiveTab}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Management;