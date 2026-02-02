import React, { useState, useEffect, useRef } from 'react';
import { StudentRecord, SubjectConfig } from '../../domain/entities/types';
import { CLASSES } from '../../domain/entities/constants';
import { dataService } from '../../infrastructure/services/dataService';
import { useMobile, useTouchInteraction } from '../hooks/useMobile';
import { debounce, throttle, mobileStorage } from '../../infrastructure/services/mobileUtils';
import * as XLSX from 'xlsx';

interface DashboardProps {
    onNavigateToManagement: () => void;
}

interface StatCard {
    id: string;
    title: string;
    value: string | number;
    icon: string;
    color: string;
    bgColor: string;
    description?: string;
}

interface SwipeState {
    startX: number;
    currentX: number;
    isDragging: boolean;
    cardIndex: number;
}

interface LoadingState {
    isLoading: boolean;
    stage: 'initializing' | 'loading-students' | 'loading-subjects' | 'calculating-stats' | 'preparing-charts';
    progress: number;
    message?: string;
}

interface TouchFeedbackState {
    isVisible: boolean;
    action: 'refreshing' | 'navigating' | 'loading-data' | 'syncing' | 'exporting';
    message?: string;
}

interface MobileLayoutState {
    currentLayout: 'cards' | 'list' | 'grid';
    isLayoutSwitching: boolean;
    viewPreferences: {
        compactMode: boolean;
        showDescriptions: boolean;
        animationsEnabled: boolean;
    };
}

interface ExportState {
    isExporting: boolean;
    exportType: 'pdf' | 'excel' | null;
    progress: number;
    stage: 'preparing' | 'generating' | 'downloading' | 'complete';
}

interface MobileDataManipulation {
    selectedCards: string[];
    isSelectionMode: boolean;
    sortBy: 'value' | 'title' | 'custom';
    sortOrder: 'asc' | 'desc';
    filterBy: string;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigateToManagement }) => {
    const [students, setStudents] = useState<StudentRecord[]>([]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [loadingState, setLoadingState] = useState<LoadingState>({
        isLoading: true,
        stage: 'initializing',
        progress: 0
    });
    const [touchFeedback, setTouchFeedback] = useState<TouchFeedbackState>({
        isVisible: false,
        action: 'refreshing'
    });
    const [selectedClass, setSelectedClass] = useState('All');
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [swipeState, setSwipeState] = useState<SwipeState>({
        startX: 0,
        currentX: 0,
        isDragging: false,
        cardIndex: 0
    });
    const [mobileLayout, setMobileLayout] = useState<MobileLayoutState>({
        currentLayout: 'cards',
        isLayoutSwitching: false,
        viewPreferences: {
            compactMode: false,
            showDescriptions: true,
            animationsEnabled: true
        }
    });
    const [exportState, setExportState] = useState<ExportState>({
        isExporting: false,
        exportType: null,
        progress: 0,
        stage: 'preparing'
    });
    const [mobileDataManipulation, setMobileDataManipulation] = useState<MobileDataManipulation>({
        selectedCards: [],
        isSelectionMode: false,
        sortBy: 'value',
        sortOrder: 'desc',
        filterBy: ''
    });

    // Mobile detection and responsive hooks
    const { isMobile, isTablet, screenWidth, orientation } = useMobile();
    const { getTouchProps } = useTouchInteraction();

    // Simple style helpers to replace removed functions
    const getTypographyStyle = (variant: string) => {
        switch (variant) {
            case 'body-large': return { fontSize: '1.125rem', lineHeight: '1.75rem' };
            case 'body-medium': return { fontSize: '1rem', lineHeight: '1.5rem' };
            case 'body-small': return { fontSize: '0.875rem', lineHeight: '1.25rem' };
            case 'caption': return { fontSize: '0.75rem', lineHeight: '1rem' };
            default: return {};
        }
    };

    const getSpacing = (size: string) => {
        switch (size) {
            case 'xs': return '0.25rem';
            case 'sm': return '0.5rem';
            case 'md': return '1rem';
            case 'lg': return '1.5rem';
            case 'xl': return '2rem';
            default: return '1rem';
        }
    };

    const getTouchTargetStyle = (size: 'min' | 'comfortable' | 'large') => {
        switch (size) {
            case 'min': return { minHeight: '32px', minWidth: '32px' };
            case 'comfortable': return { minHeight: '48px', minWidth: '48px' };
            case 'large': return { minHeight: '56px', minWidth: '56px' };
            default: return {};
        }
    };

    // Refs for swipe functionality
    const cardContainerRef = useRef<HTMLDivElement>(null);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        loadData();

        // Load mobile preferences from storage
        if (isMobile) {
            const savedLayout = mobileStorage.get<'cards' | 'list' | 'grid'>('dashboard-layout-preference');
            const savedViewPreferences = mobileStorage.get<MobileLayoutState['viewPreferences']>('dashboard-view-preferences');

            if (savedLayout) {
                setMobileLayout(prev => ({
                    ...prev,
                    currentLayout: savedLayout
                }));
            }

            if (savedViewPreferences) {
                setMobileLayout(prev => ({
                    ...prev,
                    viewPreferences: savedViewPreferences
                }));
            }
        }
    }, [isMobile]);

    const loadData = async () => {
        try {
            // Stage 1: Initializing
            setLoadingState({
                isLoading: true,
                stage: 'initializing',
                progress: 0,
                message: 'Setting up dashboard components...'
            });

            // Initialize database connection
            await dataService.initializeDatabase();

            // Stage 2: Loading students
            setLoadingState(prev => ({
                ...prev,
                stage: 'loading-students',
                progress: 25,
                message: 'Fetching student records from database...'
            }));

            const studentsData = await dataService.getAllStudents();

            // Stage 3: Loading subjects
            setLoadingState(prev => ({
                ...prev,
                stage: 'loading-subjects',
                progress: 50,
                message: 'Retrieving subject configurations...'
            }));

            const subjectsData = await dataService.getAllSubjects();

            // Stage 4: Calculating statistics
            setLoadingState(prev => ({
                ...prev,
                stage: 'calculating-stats',
                progress: 75,
                message: 'Computing performance metrics and rankings...'
            }));

            // Simulate calculation time for better UX
            await new Promise(resolve => setTimeout(resolve, 500));

            setStudents(studentsData);
            setSubjects(subjectsData);

            // Stage 5: Preparing charts
            setLoadingState(prev => ({
                ...prev,
                stage: 'preparing-charts',
                progress: 90,
                message: 'Generating charts and visualizations...'
            }));

            // Final stage completion
            await new Promise(resolve => setTimeout(resolve, 300));

            setLoadingState(prev => ({
                ...prev,
                progress: 100,
                message: 'Dashboard ready!'
            }));

            // Complete loading
            setTimeout(() => {
                setLoadingState(prev => ({
                    ...prev,
                    isLoading: false
                }));
            }, 200);

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            setLoadingState(prev => ({
                ...prev,
                isLoading: false,
                message: 'Error loading dashboard data'
            }));
        }
    };

    // Filter students by selected class
    const filteredStudents = selectedClass === 'All'
        ? students
        : students.filter(s => s.className === selectedClass);

    // Calculate statistics
    const totalStudents = students.length;
    const totalSubjects = subjects.length;
    const averagePercentage = students.length > 0
        ? Math.round(students.reduce((sum, s) => sum + s.average, 0) / students.length)
        : 0;

    // Create mobile-optimized statistics cards
    const statisticsCards: StatCard[] = [
        {
            id: 'total-students',
            title: 'Total Students',
            value: totalStudents,
            icon: 'fa-solid fa-users',
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
            description: `${totalStudents} students enrolled across all classes`
        },
        {
            id: 'total-subjects',
            title: 'Total Subjects',
            value: totalSubjects,
            icon: 'fa-solid fa-book',
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-100',
            description: `${totalSubjects} subjects offered in the curriculum`
        },
        {
            id: 'average-percentage',
            title: 'Average Percentage',
            value: `${averagePercentage}%`,
            icon: 'fa-solid fa-chart-line',
            color: 'text-amber-600',
            bgColor: 'bg-amber-100',
            description: `Overall academic performance across all students`
        },
        {
            id: 'active-classes',
            title: 'Active Classes',
            value: CLASSES.length,
            icon: 'fa-solid fa-chalkboard',
            color: 'text-purple-600',
            bgColor: 'bg-purple-100',
            description: `${CLASSES.length} classes currently active in the system`
        }
    ];

    // Mobile swipe handlers for statistics cards
    const handleTouchStart = (e: React.TouchEvent) => {
        if (!isMobile) return;

        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };

        setSwipeState(prev => ({
            ...prev,
            startX: touch.clientX,
            currentX: touch.clientX,
            isDragging: true,
            cardIndex: currentCardIndex
        }));
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isMobile || !touchStartRef.current || !swipeState.isDragging) return;

        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

        // Only handle horizontal swipes
        if (deltaY > deltaX) return;

        e.preventDefault();

        setSwipeState(prev => ({
            ...prev,
            currentX: touch.clientX
        }));
    };

    const handleTouchEnd = () => {
        if (!isMobile || !touchStartRef.current || !swipeState.isDragging) return;

        const deltaX = swipeState.currentX - swipeState.startX;
        const threshold = screenWidth * 0.2; // 20% of screen width

        if (Math.abs(deltaX) > threshold) {
            if (deltaX > 0 && currentCardIndex > 0) {
                // Swipe right - previous card
                setCurrentCardIndex(prev => prev - 1);
            } else if (deltaX < 0 && currentCardIndex < statisticsCards.length - 1) {
                // Swipe left - next card
                setCurrentCardIndex(prev => prev + 1);
            }
        }

        setSwipeState(prev => ({
            ...prev,
            isDragging: false,
            startX: 0,
            currentX: 0
        }));

        touchStartRef.current = null;
    };

    // Navigate to specific card (for pagination dots)
    const navigateToCard = (index: number) => {
        setCurrentCardIndex(index);
    };

    // Enhanced refresh data with touch feedback
    const handleRefreshData = async () => {
        if (isMobile) {
            setTouchFeedback({
                isVisible: true,
                action: 'refreshing',
                message: 'Refreshing dashboard data...'
            });
        }

        try {
            await loadData();
        } finally {
            if (isMobile) {
                setTimeout(() => {
                    setTouchFeedback(prev => ({ ...prev, isVisible: false }));
                }, 500);
            }
        }
    };

    // Enhanced navigation with touch feedback
    const handleNavigateToManagement = () => {
        if (isMobile) {
            setTouchFeedback({
                isVisible: true,
                action: 'navigating',
                message: 'Opening management interface...'
            });

            setTimeout(() => {
                onNavigateToManagement();
                setTouchFeedback(prev => ({ ...prev, isVisible: false }));
            }, 300);
        } else {
            onNavigateToManagement();
        }
    };

    // Enhanced print with touch feedback
    const handlePrint = () => {
        if (isMobile) {
            setTouchFeedback({
                isVisible: true,
                action: 'loading-data',
                message: 'Preparing print layout...'
            });

            setTimeout(() => {
                window.print();
                setTouchFeedback(prev => ({ ...prev, isVisible: false }));
            }, 500);
        } else {
            window.print();
        }
    };

    // Enhanced export with touch feedback
    const handleExport = () => {
        if (isMobile) {
            setTouchFeedback({
                isVisible: true,
                action: 'syncing',
                message: 'Preparing data export...'
            });
        }

        try {
            const data = `Dashboard exported at ${new Date().toLocaleString()}`;
            const blob = new Blob([data], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dashboard-export.txt';
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            if (isMobile) {
                setTimeout(() => {
                    setTouchFeedback(prev => ({ ...prev, isVisible: false }));
                }, 800);
            }
        }
    };

    // Enhanced mobile-optimized export functionality with comprehensive progress tracking
    const handleMobileExportPDF = async () => {
        if (!isMobile) return;

        setExportState({
            isExporting: true,
            exportType: 'pdf',
            progress: 0,
            stage: 'preparing'
        });

        setTouchFeedback({
            isVisible: true,
            action: 'exporting',
            message: 'Preparing PDF report...'
        });

        try {
            // Stage 1: Preparing data
            setExportState(prev => ({ ...prev, progress: 10, stage: 'preparing' }));
            await new Promise(resolve => setTimeout(resolve, 200));

            // Stage 2: Generating report content
            setExportState(prev => ({ ...prev, progress: 30, stage: 'generating' }));
            setTouchFeedback(prev => ({ ...prev, message: 'Generating report content...' }));

            // Create a comprehensive dashboard report with mobile-optimized formatting
            const reportData = {
                generatedAt: new Date().toISOString(),
                totalStudents: students.length,
                totalSubjects: subjects.length,
                averagePercentage,
                classStats,
                topPerformers: topPerformers.slice(0, 10),
                gradeDistribution: gradeStats,
                selectedLayout: mobileLayout.currentLayout,
                exportedFrom: 'Mobile Dashboard'
            };

            setExportState(prev => ({ ...prev, progress: 60 }));
            await new Promise(resolve => setTimeout(resolve, 300));

            // Stage 3: Formatting for mobile viewing
            setTouchFeedback(prev => ({ ...prev, message: 'Optimizing for mobile viewing...' }));

            const reportContent = `
AIC DA'WA COLLEGE - COMPREHENSIVE DASHBOARD REPORT
Generated: ${new Date().toLocaleString()}
Exported from: ${reportData.exportedFrom}
Layout Used: ${reportData.selectedLayout.toUpperCase()}

═══════════════════════════════════════════════════════════════

EXECUTIVE SUMMARY:
- Total Students: ${reportData.totalStudents}
- Total Subjects: ${reportData.totalSubjects}  
- Overall Average: ${reportData.averagePercentage}%
- Report Generated: ${new Date().toLocaleDateString()}

═══════════════════════════════════════════════════════════════

CLASS PERFORMANCE ANALYSIS:
${classStats.map(stat =>
                `${stat.className}:
  • Students: ${stat.studentCount}
  • Class Average: ${stat.average}%
  • Top Student: ${stat.topStudent ? `${stat.topStudent.name} (${stat.topStudent.grandTotal} marks)` : 'N/A'}`
            ).join('\n\n')}

═══════════════════════════════════════════════════════════════

TOP PERFORMERS (Top 10):
${topPerformers.slice(0, 10).map((student, index) =>
                `${index + 1}. ${student.name}
   Class: ${student.className} | Adm: ${student.adNo}
   Total: ${student.grandTotal} marks | Average: ${student.average.toFixed(1)}%`
            ).join('\n\n')}

═══════════════════════════════════════════════════════════════

GRADE DISTRIBUTION:
${Object.entries(gradeStats).map(([grade, count]) => {
                const percentage = students.length > 0 ? ((count / students.length) * 100).toFixed(1) : '0';
                return `${grade}: ${count} students (${percentage}%)`;
            }).join('\n')}

═══════════════════════════════════════════════════════════════

DETAILED CLASS STATISTICS:
${classStats.map(stat => {
                const classStudents = students.filter(s => s.className === stat.className);
                const passedStudents = classStudents.filter(s => s.performanceLevel !== 'Failed').length;
                const passRate = classStudents.length > 0 ? ((passedStudents / classStudents.length) * 100).toFixed(1) : '0';

                return `${stat.className} Class Analysis:
  • Total Students: ${stat.studentCount}
  • Pass Rate: ${passRate}%
  • Class Average: ${stat.average}%
  • Highest Score: ${classStudents.length > 0 ? Math.max(...classStudents.map(s => s.grandTotal)) : 'N/A'}
  • Lowest Score: ${classStudents.length > 0 ? Math.min(...classStudents.map(s => s.grandTotal)) : 'N/A'}`;
            }).join('\n\n')}

═══════════════════════════════════════════════════════════════

REPORT METADATA:
- Generated By: AIC Da'wa College Examination System
- Export Format: Mobile-Optimized Text Report
- File Size: Optimized for mobile viewing
- Timestamp: ${new Date().toISOString()}
- Layout: ${reportData.selectedLayout}
- Device: Mobile Dashboard

═══════════════════════════════════════════════════════════════

For verification and queries:
Email: examinations@aicdawacollege.edu.in
Phone: +91-483-2734567

This report contains confidential academic information.
            `.trim();

            setExportState(prev => ({ ...prev, progress: 80, stage: 'downloading' }));
            setTouchFeedback(prev => ({ ...prev, message: 'Preparing download...' }));

            // Stage 4: Creating and downloading file
            const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AIC-Dashboard-Report-${new Date().toISOString().split('T')[0]}.txt`;

            // Mobile-friendly download trigger
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setExportState(prev => ({ ...prev, progress: 100, stage: 'complete' }));
            setTouchFeedback(prev => ({ ...prev, message: 'Report downloaded successfully!' }));

        } catch (error) {
            console.error('PDF Export failed:', error);
            setTouchFeedback(prev => ({
                ...prev,
                action: 'loading-data',
                message: 'Export failed. Please try again.'
            }));
        } finally {
            setTimeout(() => {
                setExportState({
                    isExporting: false,
                    exportType: null,
                    progress: 0,
                    stage: 'preparing'
                });
                setTouchFeedback(prev => ({ ...prev, isVisible: false }));
            }, 1500);
        }
    };

    // Enhanced mobile-optimized Excel export with comprehensive data and progress tracking
    const handleMobileExportExcel = async () => {
        if (!isMobile) return;

        setExportState({
            isExporting: true,
            exportType: 'excel',
            progress: 0,
            stage: 'preparing'
        });

        setTouchFeedback({
            isVisible: true,
            action: 'exporting',
            message: 'Preparing Excel workbook...'
        });

        try {
            // Create workbook with multiple sheets optimized for mobile viewing
            const wb = XLSX.utils.book_new();

            // Stage 1: Summary sheet
            setExportState(prev => ({ ...prev, progress: 15, stage: 'generating' }));
            setTouchFeedback(prev => ({ ...prev, message: 'Creating summary sheet...' }));

            const summaryData = [
                ['AIC DA\'WA COLLEGE - COMPREHENSIVE DASHBOARD EXPORT'],
                ['Generated', new Date().toLocaleString()],
                ['Exported From', 'Mobile Dashboard'],
                ['Layout Used', mobileLayout.currentLayout.toUpperCase()],
                [''],
                ['EXECUTIVE SUMMARY', ''],
                ['Total Students', students.length],
                ['Total Subjects', subjects.length],
                ['Overall Average', `${averagePercentage}%`],
                ['Active Classes', CLASSES.length],
                [''],
                ['CLASS BREAKDOWN', 'DETAILS'],
                ...classStats.map(stat => [
                    stat.className,
                    `${stat.studentCount} students | ${stat.average}% avg | Top: ${stat.topStudent?.name || 'N/A'}`
                ]),
                [''],
                ['GRADE DISTRIBUTION', 'COUNT', 'PERCENTAGE'],
                ...Object.entries(gradeStats).map(([grade, count]) => [
                    grade,
                    count,
                    students.length > 0 ? `${((count / students.length) * 100).toFixed(1)}%` : '0%'
                ])
            ];

            const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);

            // Set column widths for mobile-friendly viewing
            summaryWs['!cols'] = [
                { wch: 25 }, // Column A
                { wch: 30 }, // Column B
                { wch: 15 }  // Column C
            ];

            XLSX.utils.book_append_sheet(wb, summaryWs, 'Dashboard Summary');

            // Stage 2: Top performers sheet
            setExportState(prev => ({ ...prev, progress: 35 }));
            setTouchFeedback(prev => ({ ...prev, message: 'Adding top performers data...' }));

            const topPerformersData = [
                ['TOP PERFORMERS - DETAILED ANALYSIS'],
                ['Generated', new Date().toLocaleString()],
                [''],
                ['RANK', 'NAME', 'CLASS', 'ADM NO', 'TOTAL MARKS', 'AVERAGE %', 'PERFORMANCE LEVEL'],
                ...topPerformers.slice(0, 25).map((student, index) => [
                    index + 1,
                    student.name,
                    student.className,
                    student.adNo,
                    student.grandTotal,
                    student.average.toFixed(1),
                    student.performanceLevel
                ])
            ];

            const topPerformersWs = XLSX.utils.aoa_to_sheet(topPerformersData);
            topPerformersWs['!cols'] = [
                { wch: 6 },  // Rank
                { wch: 20 }, // Name
                { wch: 8 },  // Class
                { wch: 10 }, // Adm No
                { wch: 12 }, // Total
                { wch: 10 }, // Average
                { wch: 18 }  // Performance Level
            ];

            XLSX.utils.book_append_sheet(wb, topPerformersWs, 'Top Performers');

            // Stage 3: Class-wise analysis
            setExportState(prev => ({ ...prev, progress: 55 }));
            setTouchFeedback(prev => ({ ...prev, message: 'Analyzing class performance...' }));

            const classAnalysisData = [
                ['CLASS-WISE PERFORMANCE ANALYSIS'],
                ['Generated', new Date().toLocaleString()],
                [''],
                ['CLASS', 'TOTAL STUDENTS', 'AVERAGE %', 'PASS RATE %', 'HIGHEST SCORE', 'LOWEST SCORE', 'TOP STUDENT']
            ];

            classStats.forEach(stat => {
                const classStudents = students.filter(s => s.className === stat.className);
                const passedStudents = classStudents.filter(s => s.performanceLevel !== 'Failed').length;
                const passRate = classStudents.length > 0 ? ((passedStudents / classStudents.length) * 100).toFixed(1) : '0';
                const highestScore = classStudents.length > 0 ? Math.max(...classStudents.map(s => s.grandTotal)) : 'N/A';
                const lowestScore = classStudents.length > 0 ? Math.min(...classStudents.map(s => s.grandTotal)) : 'N/A';

                classAnalysisData.push([
                    stat.className,
                    String(stat.studentCount),
                    `${stat.average}%`,
                    `${passRate}%`,
                    String(highestScore),
                    String(lowestScore),
                    stat.topStudent?.name || 'N/A'
                ]);
            });

            const classAnalysisWs = XLSX.utils.aoa_to_sheet(classAnalysisData);
            classAnalysisWs['!cols'] = [
                { wch: 8 },  // Class
                { wch: 15 }, // Total Students
                { wch: 12 }, // Average
                { wch: 12 }, // Pass Rate
                { wch: 15 }, // Highest
                { wch: 15 }, // Lowest
                { wch: 20 }  // Top Student
            ];

            XLSX.utils.book_append_sheet(wb, classAnalysisWs, 'Class Analysis');

            // Stage 4: Grade distribution details
            setExportState(prev => ({ ...prev, progress: 75 }));
            setTouchFeedback(prev => ({ ...prev, message: 'Compiling grade distribution...' }));

            const gradeDistData = [
                ['GRADE DISTRIBUTION ANALYSIS'],
                ['Generated', new Date().toLocaleString()],
                ['Total Students Analyzed', students.length],
                [''],
                ['PERFORMANCE LEVEL', 'STUDENT COUNT', 'PERCENTAGE', 'BENCHMARK'],
                ...Object.entries(gradeStats).map(([grade, count]) => {
                    const percentage = students.length > 0 ? ((count / students.length) * 100).toFixed(1) : '0';
                    const benchmark = grade === 'Excellent' ? '90%+ marks' :
                        grade === 'Good' ? '75-89% marks' :
                            grade === 'Average' ? '60-74% marks' :
                                grade === 'Needs Improvement' ? '40-59% marks' :
                                    'Below 40% marks';

                    return [grade, count, `${percentage}%`, benchmark];
                })
            ];

            const gradeDistWs = XLSX.utils.aoa_to_sheet(gradeDistData);
            gradeDistWs['!cols'] = [
                { wch: 20 }, // Performance Level
                { wch: 15 }, // Count
                { wch: 12 }, // Percentage
                { wch: 20 }  // Benchmark
            ];

            XLSX.utils.book_append_sheet(wb, gradeDistWs, 'Grade Distribution');

            // Stage 5: Mobile metadata sheet
            setExportState(prev => ({ ...prev, progress: 90, stage: 'downloading' }));
            setTouchFeedback(prev => ({ ...prev, message: 'Finalizing export...' }));

            const metadataData = [
                ['EXPORT METADATA'],
                [''],
                ['Export Details', 'Value'],
                ['Generated On', new Date().toLocaleString()],
                ['Generated By', 'AIC Da\'wa College Examination System'],
                ['Export Source', 'Mobile Dashboard'],
                ['Layout Used', mobileLayout.currentLayout],
                ['File Format', 'Excel Workbook (.xlsx)'],
                ['Total Sheets', '5'],
                ['Optimization', 'Mobile-Friendly'],
                [''],
                ['Data Summary', ''],
                ['Students Included', students.length],
                ['Subjects Analyzed', subjects.length],
                ['Classes Covered', CLASSES.length],
                ['Performance Levels', Object.keys(gradeStats).length],
                [''],
                ['Contact Information', ''],
                ['Institution', 'AIC Da\'wa College'],
                ['Email', 'examinations@aicdawacollege.edu.in'],
                ['Phone', '+91-483-2734567'],
                [''],
                ['File Information', ''],
                ['Recommended Viewer', 'Excel Mobile App'],
                ['Compatibility', 'Excel 2016+ / Google Sheets'],
                ['File Size', 'Optimized for mobile'],
                ['Last Modified', new Date().toISOString()]
            ];

            const metadataWs = XLSX.utils.aoa_to_sheet(metadataData);
            metadataWs['!cols'] = [
                { wch: 25 }, // Label
                { wch: 35 }  // Value
            ];

            XLSX.utils.book_append_sheet(wb, metadataWs, 'Export Info');

            // Generate and download with mobile-optimized settings
            setExportState(prev => ({ ...prev, progress: 100, stage: 'complete' }));
            setTouchFeedback(prev => ({ ...prev, message: 'Downloading Excel file...' }));

            const excelBuffer = XLSX.write(wb, {
                bookType: 'xlsx',
                type: 'array',
                compression: true // Enable compression for smaller file size on mobile
            });

            const blob = new Blob([excelBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AIC-Dashboard-Comprehensive-${new Date().toISOString().split('T')[0]}.xlsx`;

            // Mobile-friendly download
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setTouchFeedback(prev => ({ ...prev, message: 'Excel file downloaded successfully!' }));

        } catch (error) {
            console.error('Excel export failed:', error);
            setTouchFeedback(prev => ({
                ...prev,
                action: 'loading-data',
                message: 'Excel export failed. Please try again.'
            }));
        } finally {
            setTimeout(() => {
                setExportState({
                    isExporting: false,
                    exportType: null,
                    progress: 0,
                    stage: 'preparing'
                });
                setTouchFeedback(prev => ({ ...prev, isVisible: false }));
            }, 2000);
        }
    };

    // Mobile layout switching functionality with preferences persistence
    const handleLayoutSwitch = (newLayout: 'cards' | 'list' | 'grid') => {
        if (!isMobile || mobileLayout.currentLayout === newLayout) return;

        setMobileLayout(prev => ({
            ...prev,
            currentLayout: newLayout,
            isLayoutSwitching: true
        }));

        // Persist layout preference
        mobileStorage.set('dashboard-layout-preference', newLayout);

        // Add smooth transition
        setTimeout(() => {
            setMobileLayout(prev => ({
                ...prev,
                isLayoutSwitching: false
            }));
        }, 300);
    };

    // Enhanced mobile data manipulation controls
    const handleToggleSelectionMode = () => {
        setMobileDataManipulation(prev => ({
            ...prev,
            isSelectionMode: !prev.isSelectionMode,
            selectedCards: []
        }));
    };

    const handleCardSelection = (cardId: string) => {
        setMobileDataManipulation(prev => ({
            ...prev,
            selectedCards: prev.selectedCards.includes(cardId)
                ? prev.selectedCards.filter(id => id !== cardId)
                : [...prev.selectedCards, cardId]
        }));
    };

    const handleSortChange = (sortBy: 'value' | 'title' | 'custom', sortOrder: 'asc' | 'desc') => {
        setMobileDataManipulation(prev => ({
            ...prev,
            sortBy,
            sortOrder
        }));
    };

    const handleToggleViewPreference = (preference: keyof MobileLayoutState['viewPreferences']) => {
        setMobileLayout(prev => ({
            ...prev,
            viewPreferences: {
                ...prev.viewPreferences,
                [preference]: !prev.viewPreferences[preference]
            }
        }));

        // Persist view preferences
        mobileStorage.set('dashboard-view-preferences', {
            ...mobileLayout.viewPreferences,
            [preference]: !mobileLayout.viewPreferences[preference]
        });
    };

    // Grade distribution
    const gradeStats = {
        Excellent: students.filter(s => s.performanceLevel === 'Excellent').length,
        Good: students.filter(s => s.performanceLevel === 'Good').length,
        Average: students.filter(s => s.performanceLevel === 'Average').length,
        'Needs Improvement': students.filter(s => s.performanceLevel === 'Needs Improvement').length,
        Failed: students.filter(s => s.performanceLevel === 'Failed').length,
    };

    // Class-wise statistics
    const classStats = CLASSES.map(className => {
        const classStudents = students.filter(s => s.className === className);
        const classAverage = classStudents.length > 0
            ? Math.round(classStudents.reduce((sum, s) => sum + s.average, 0) / classStudents.length)
            : 0;

        return {
            className,
            studentCount: classStudents.length,
            average: classAverage,
            topStudent: classStudents.find(s => s.rank === 1)
        };
    });

    // Top performers
    const topPerformers = [...students]
        .sort((a, b) => b.grandTotal - a.grandTotal)
        .slice(0, 5);

    if (loadingState.isLoading) {
        // Show progressive loading for mobile, complete skeleton for desktop
        if (isMobile && loadingState.progress < 100) {
            return (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="loader-ring mb-4"></div>
                        <p className="text-slate-600">Loading dashboard data... {loadingState.progress}%</p>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="loader-ring mb-4"></div>
                        <p className="text-slate-600">Loading dashboard data...</p>
                    </div>
                </div>
            );
        }
    }

    return (
        <div className={`space-y-8 ${isMobile ? 'space-y-6' : ''}`}>
            {/* Enhanced Official Print Header - Visible only on Print */}
            <div className="hidden print:block text-center print:mb-6 print:break-inside-avoid print:keep-with-next">
                <div className="border-b-4 border-black print:pb-4 print:mb-4 print:a4-content">
                    {/* College Logo/Emblem Area */}
                    <div className="print:mb-3">
                        <img src="/logo-black.png" alt="AIC Logo" className="h-16 w-auto mx-auto object-contain print:mb-2" />
                    </div>

                    {/* Official College Header */}
                    <h1 className="print:text-2xl font-black text-black print:mb-2 print:leading-tight tracking-wider">
                        AIC DA'WA COLLEGE
                    </h1>
                    <div className="print:text-xs text-black print:mb-3 print:leading-tight">
                        Virippadam, Akkod, Vazhakkad, Kerala 673640
                    </div>

                    {/* Document Title */}
                    <h2 className="print:text-lg font-bold text-black print:mb-2 print:leading-tight uppercase tracking-widest">
                        ACADEMIC DASHBOARD REPORT
                    </h2>

                    {/* Academic Session and Generation Info */}
                    <div className="grid grid-cols-3 gap-4 print:text-xs text-black print:leading-tight">
                        <div className="text-left">
                            <div className="font-bold">Academic Session:</div>
                            <div>2026-27</div>
                        </div>
                        <div className="text-center">
                            <div className="font-bold">Report Type:</div>
                            <div>Dashboard Summary</div>
                        </div>
                        <div className="text-right">
                            <div className="font-bold">Generated:</div>
                            <div>{new Date().toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                            })}</div>
                            <div>{new Date().toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`flex items-center justify-between ${isMobile ? 'flex-col gap-4' : ''
                }`}>
                <div className={isMobile ? 'text-center' : ''}>
                    <h1
                        className="text-slate-900 tracking-tight font-black"
                        style={getTypographyStyle(isMobile ? 'display-medium' : 'display-large')}
                    >
                        Academic Dashboard
                    </h1>
                    <p
                        className="text-slate-600 mt-2"
                        style={getTypographyStyle(isMobile ? 'body-large' : 'body-medium')}
                    >
                        Overview of academic performance and statistics
                    </p>
                </div>

                {/* Enhanced Mobile Layout Controls with Data Manipulation */}
                {isMobile ? (
                    <div className="w-full space-y-4">
                        {/* Layout Switcher with View Preferences */}
                        <div className="bg-slate-50 rounded-2xl p-4 space-y-4">
                            <div className="flex items-center justify-center gap-2 bg-white rounded-xl p-1 shadow-sm">
                                {(['cards', 'list', 'grid'] as const).map((layout) => (
                                    <button
                                        key={layout}
                                        onClick={() => handleLayoutSwitch(layout)}
                                        disabled={mobileLayout.isLayoutSwitching}
                                        className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all ${mobileLayout.currentLayout === layout
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                            } ${mobileLayout.isLayoutSwitching ? 'opacity-50' : ''}`}
                                        style={getTouchTargetStyle('min')}
                                        {...getTouchProps()}
                                    >
                                        <i className={`fa-solid ${layout === 'cards' ? 'fa-th-large' :
                                            layout === 'list' ? 'fa-list' : 'fa-th'
                                            } mr-2`}></i>
                                        {layout.charAt(0).toUpperCase() + layout.slice(1)}
                                    </button>
                                ))}
                            </div>

                            {/* View Preferences Toggle */}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => handleToggleViewPreference('compactMode')}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${mobileLayout.viewPreferences.compactMode
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-slate-200 text-slate-600'
                                        }`}
                                    style={getTouchTargetStyle('min')}
                                >
                                    <i className="fa-solid fa-compress mr-1"></i>
                                    Compact
                                </button>
                                <button
                                    onClick={() => handleToggleViewPreference('showDescriptions')}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${mobileLayout.viewPreferences.showDescriptions
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-slate-200 text-slate-600'
                                        }`}
                                    style={getTouchTargetStyle('min')}
                                >
                                    <i className="fa-solid fa-info-circle mr-1"></i>
                                    Details
                                </button>
                                <button
                                    onClick={() => handleToggleViewPreference('animationsEnabled')}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${mobileLayout.viewPreferences.animationsEnabled
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-slate-200 text-slate-600'
                                        }`}
                                    style={getTouchTargetStyle('min')}
                                >
                                    <i className="fa-solid fa-magic mr-1"></i>
                                    Animations
                                </button>
                            </div>
                        </div>

                        {/* Touch-Friendly Data Manipulation Controls */}
                        <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-slate-900 text-sm">Data Controls</h3>
                                <button
                                    onClick={handleToggleSelectionMode}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${mobileDataManipulation.isSelectionMode
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-slate-200 text-slate-600'
                                        }`}
                                    style={getTouchTargetStyle('min')}
                                >
                                    <i className="fa-solid fa-check-square mr-1"></i>
                                    {mobileDataManipulation.isSelectionMode ? 'Exit Select' : 'Select Mode'}
                                </button>
                            </div>

                            {/* Sort and Filter Controls */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Sort By</label>
                                    <select
                                        value={`${mobileDataManipulation.sortBy}-${mobileDataManipulation.sortOrder}`}
                                        onChange={(e) => {
                                            const [sortBy, sortOrder] = e.target.value.split('-') as ['value' | 'title' | 'custom', 'asc' | 'desc'];
                                            handleSortChange(sortBy, sortOrder);
                                        }}
                                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                        style={getTouchTargetStyle('min')}
                                    >
                                        <option value="value-desc">Value (High to Low)</option>
                                        <option value="value-asc">Value (Low to High)</option>
                                        <option value="title-asc">Title (A to Z)</option>
                                        <option value="title-desc">Title (Z to A)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Filter</label>
                                    <input
                                        type="text"
                                        value={mobileDataManipulation.filterBy}
                                        onChange={(e) => setMobileDataManipulation(prev => ({
                                            ...prev,
                                            filterBy: e.target.value
                                        }))}
                                        placeholder="Search..."
                                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                        style={getTouchTargetStyle('min')}
                                    />
                                </div>
                            </div>

                            {/* Selection Summary */}
                            {mobileDataManipulation.isSelectionMode && (
                                <div className="bg-white rounded-lg p-2 border border-orange-200">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-orange-700 font-medium">
                                            {mobileDataManipulation.selectedCards.length} selected
                                        </span>
                                        {mobileDataManipulation.selectedCards.length > 0 && (
                                            <button
                                                onClick={() => setMobileDataManipulation(prev => ({
                                                    ...prev,
                                                    selectedCards: []
                                                }))}
                                                className="text-orange-600 hover:text-orange-800"
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Enhanced Mobile Action Buttons with Progress Indicators */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleRefreshData}
                                disabled={loadingState.isLoading}
                                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 active:bg-emerald-800 transition-all flex items-center justify-center gap-2 print:hidden disabled:opacity-50"
                                style={getTouchTargetStyle('comfortable')}
                                {...getTouchProps()}
                            >
                                <i className={`fa-solid ${loadingState.isLoading ? 'fa-spinner fa-spin' : 'fa-refresh'}`}></i>
                                {loadingState.isLoading ? 'Loading...' : 'Refresh'}
                            </button>

                            <button
                                onClick={handleMobileExportPDF}
                                disabled={exportState.isExporting && exportState.exportType === 'pdf'}
                                className="px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:bg-blue-800 transition-all flex items-center justify-center gap-2 print:hidden disabled:opacity-50 relative overflow-hidden"
                                style={getTouchTargetStyle('comfortable')}
                                {...getTouchProps()}
                            >
                                {exportState.isExporting && exportState.exportType === 'pdf' ? (
                                    <>
                                        <div className="absolute inset-0 bg-blue-700 transition-all duration-300"
                                            style={{ width: `${exportState.progress}%` }}></div>
                                        <span className="relative z-10">
                                            <i className="fa-solid fa-spinner fa-spin mr-1"></i>
                                            {exportState.progress}%
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-file-pdf"></i>
                                        PDF
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleMobileExportExcel}
                                disabled={exportState.isExporting && exportState.exportType === 'excel'}
                                className="px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 active:bg-green-800 transition-all flex items-center justify-center gap-2 print:hidden disabled:opacity-50 relative overflow-hidden"
                                style={getTouchTargetStyle('comfortable')}
                                {...getTouchProps()}
                            >
                                {exportState.isExporting && exportState.exportType === 'excel' ? (
                                    <>
                                        <div className="absolute inset-0 bg-green-700 transition-all duration-300"
                                            style={{ width: `${exportState.progress}%` }}></div>
                                        <span className="relative z-10">
                                            <i className="fa-solid fa-spinner fa-spin mr-1"></i>
                                            {exportState.progress}%
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-file-excel"></i>
                                        Excel
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={handleRefreshData}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 active:bg-emerald-800 transition-all flex items-center gap-2 print:hidden"
                    >
                        <i className="fa-solid fa-refresh"></i>
                        Refresh Data
                    </button>
                )}
            </div>

            {/* Mobile-Optimized Key Statistics */}
            {
                isMobile ? (
                    <div className="relative">
                        {/* Mobile Statistics Cards - Single Column with Swipe */}
                        <div
                            ref={cardContainerRef}
                            className="relative overflow-hidden"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <div
                                className="flex transition-transform duration-300 ease-out"
                                style={{
                                    transform: `translateX(-${currentCardIndex * 100}%)`,
                                    ...(swipeState.isDragging && {
                                        transform: `translateX(calc(-${currentCardIndex * 100}% + ${swipeState.currentX - swipeState.startX}px))`,
                                        transition: 'none'
                                    })
                                }}
                            >
                                {statisticsCards.map((card, index) => (
                                    <div
                                        key={card.id}
                                        className="w-full flex-shrink-0 px-2"
                                    >
                                        <div
                                            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 touch-target-comfortable"
                                            style={{
                                                ...getTouchTargetStyle('comfortable'),
                                                minHeight: '140px'
                                            }}
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex-1">
                                                    <p
                                                        className="text-slate-600 font-medium mb-2"
                                                        style={getTypographyStyle('body-medium')}
                                                    >
                                                        {card.title}
                                                    </p>
                                                    <p
                                                        className="text-slate-900 font-black"
                                                        style={{
                                                            ...getTypographyStyle('display-small'),
                                                            fontSize: isMobile ? '2rem' : '2.5rem'
                                                        }}
                                                    >
                                                        {card.value}
                                                    </p>
                                                </div>
                                                <div className={`${card.bgColor} p-4 rounded-xl`}>
                                                    <i className={`${card.icon} ${card.color} text-2xl`}></i>
                                                </div>
                                            </div>
                                            {card.description && (
                                                <p
                                                    className="text-slate-500 text-sm"
                                                    style={getTypographyStyle('body-small')}
                                                >
                                                    {card.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Mobile Pagination Dots */}
                        <div className="flex justify-center mt-4 space-x-2">
                            {statisticsCards.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => navigateToCard(index)}
                                    className={`w-2 h-2 rounded-full transition-all duration-200 ${index === currentCardIndex
                                        ? 'bg-emerald-600 w-6'
                                        : 'bg-slate-300'
                                        }`}
                                    style={getTouchTargetStyle('min')}
                                    aria-label={`Go to statistics card ${index + 1}`}
                                />
                            ))}
                        </div>

                        {/* Mobile Swipe Hint */}
                        {currentCardIndex === 0 && (
                            <div className="text-center mt-2">
                                <p className="text-slate-400 text-xs flex items-center justify-center gap-1">
                                    <i className="fa-solid fa-hand-pointer"></i>
                                    Swipe left to see more stats
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Desktop/Tablet Grid Layout */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {statisticsCards.map((card) => (
                            <div
                                key={card.id}
                                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-slate-600 text-sm font-medium">{card.title}</p>
                                        <p className="text-3xl font-black text-slate-900 mt-1">{card.value}</p>
                                    </div>
                                    <div className={`${card.bgColor} p-3 rounded-xl`}>
                                        <i className={`${card.icon} ${card.color} text-xl`}></i>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }

            {/* Performance Distribution with Mobile-Optimized Charts */}
            {
                isMobile ? (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Grade Distribution</h3>
                        <div className="space-y-2">
                            {Object.entries(gradeStats).map(([grade, count]) => (
                                <div key={grade} className="flex justify-between">
                                    <span className="text-slate-600">{grade}</span>
                                    <span className="font-bold text-slate-900">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h2
                            className="text-slate-900 mb-6 font-black"
                            style={getTypographyStyle(isMobile ? 'heading-large' : 'heading-medium')}
                        >
                            Grade Distribution
                        </h2>
                        <div className={`grid gap-4 ${isMobile
                            ? 'grid-cols-2 gap-y-6'
                            : 'grid-cols-2 md:grid-cols-5'
                            }`}>
                            {Object.entries(gradeStats).map(([level, count]) => (
                                <div key={level} className="text-center">
                                    <div
                                        className={`mx-auto rounded-full flex items-center justify-center text-white font-black mb-2 ${level.includes('Outstanding') ? 'bg-purple-500' :
                                            level.includes('Excellent') ? 'bg-emerald-500' :
                                                level.includes('Very Good') ? 'bg-blue-500' :
                                                    level.includes('Good') ? 'bg-teal-500' :
                                                        level.includes('Average') ? 'bg-amber-500' :
                                                            'bg-red-500'
                                            }`}
                                        style={{
                                            width: isMobile ? '56px' : '64px',
                                            height: isMobile ? '56px' : '64px',
                                            fontSize: isMobile ? '1.25rem' : '1.125rem',
                                            ...getTouchTargetStyle('large')
                                        }}
                                    >
                                        {count}
                                    </div>
                                    <p
                                        className="font-bold text-slate-600 uppercase tracking-wider"
                                        style={{
                                            ...getTypographyStyle('caption'),
                                            fontSize: isMobile ? '0.75rem' : '0.625rem'
                                        }}
                                    >
                                        {level.split(' ')[0]}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* Class Overview */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className={`flex items-center justify-between mb-6 ${isMobile ? 'flex-col gap-4' : ''
                    }`}>
                    <h2
                        className="text-slate-900 font-black"
                        style={getTypographyStyle(isMobile ? 'heading-large' : 'heading-medium')}
                    >
                        Class Overview
                    </h2>
                    <button
                        onClick={handleNavigateToManagement}
                        className={`px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 active:bg-slate-300 transition-all print:hidden ${isMobile ? 'w-full' : 'text-sm'
                            }`}
                        style={isMobile ? getTouchTargetStyle('comfortable') : {}}
                        {...(isMobile ? getTouchProps() : {})}
                    >
                        Manage Classes
                    </button>
                </div>

                <div className={`grid gap-4 ${isMobile
                    ? 'grid-cols-1'
                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
                    }`}>
                    {classStats.map(stat => (
                        <div
                            key={stat.className}
                            className={`bg-slate-50 rounded-xl p-4 ${isMobile ? 'touch-target-comfortable' : ''
                                }`}
                            style={isMobile ? getTouchTargetStyle('comfortable') : {}}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h3
                                    className="font-black text-slate-900"
                                    style={getTypographyStyle(isMobile ? 'heading-small' : 'heading-small')}
                                >
                                    {stat.className}
                                </h3>
                                <span
                                    className="bg-slate-200 text-slate-600 px-2 py-1 rounded-full font-bold"
                                    style={{
                                        ...getTypographyStyle('caption'),
                                        fontSize: isMobile ? '0.75rem' : '0.625rem'
                                    }}
                                >
                                    {stat.studentCount} students
                                </span>
                            </div>
                            <div className={`space-y-2 ${isMobile ? 'text-base' : 'text-sm'
                                }`}>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Class Average:</span>
                                    <span className="font-bold text-slate-900">{stat.average}%</span>
                                </div>
                                {stat.topStudent && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Top Student:</span>
                                        <span className="font-bold text-emerald-600">{stat.topStudent.name}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Class Performance Chart - Mobile Optimized */}
            {
                classStats.length > 0 && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Class Performance</h3>
                        <div className="space-y-2">
                            {classStats.map((stat) => (
                                <div key={stat.className} className="flex justify-between">
                                    <span className="text-slate-600">{stat.className}</span>
                                    <span className="font-bold text-slate-900">{stat.average.toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* Top Performers */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h2
                    className="text-slate-900 mb-6 font-black"
                    style={getTypographyStyle(isMobile ? 'heading-large' : 'heading-medium')}
                >
                    Top Performers
                </h2>

                {topPerformers.length > 0 ? (
                    <div className={`space-y-4 ${isMobile ? 'space-y-3' : ''}`}>
                        {topPerformers.map((student, index) => (
                            <div
                                key={student.id}
                                className={`flex items-center justify-between p-4 bg-slate-50 rounded-xl ${isMobile ? 'touch-target-comfortable' : ''
                                    }`}
                                style={isMobile ? getTouchTargetStyle('comfortable') : {}}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`rounded-full flex items-center justify-center text-white font-black ${index === 0 ? 'bg-yellow-500' :
                                        index === 1 ? 'bg-slate-400' :
                                            index === 2 ? 'bg-amber-600' :
                                                'bg-slate-300'
                                        }`}
                                        style={{
                                            width: isMobile ? '48px' : '40px',
                                            height: isMobile ? '48px' : '40px',
                                            fontSize: isMobile ? '1.125rem' : '1rem'
                                        }}
                                    >
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p
                                            className="font-black text-slate-900"
                                            style={getTypographyStyle(isMobile ? 'body-large' : 'body-medium')}
                                        >
                                            {student.name}
                                        </p>
                                        <p
                                            className="text-slate-600"
                                            style={getTypographyStyle(isMobile ? 'body-medium' : 'body-small')}
                                        >
                                            {student.className} • Adm: {student.adNo}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p
                                        className="font-black text-slate-900"
                                        style={{
                                            ...getTypographyStyle(isMobile ? 'heading-small' : 'body-large'),
                                            fontSize: isMobile ? '1.25rem' : '1.125rem'
                                        }}
                                    >
                                        {student.grandTotal}
                                    </p>
                                    <p
                                        className="text-slate-600"
                                        style={getTypographyStyle('body-small')}
                                    >
                                        {student.average.toFixed(1)}% avg
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <i className="fa-solid fa-users text-4xl text-slate-300 mb-4"></i>
                        <p
                            className="text-slate-600 font-bold mb-2"
                            style={getTypographyStyle('body-large')}
                        >
                            No Students Found
                        </p>
                        <p
                            className="text-slate-500 mb-4"
                            style={getTypographyStyle('body-medium')}
                        >
                            Get started by adding students to the system
                        </p>
                        <button
                            onClick={handleNavigateToManagement}
                            className={`px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 active:bg-emerald-800 transition-all flex items-center gap-2 mx-auto print:hidden ${isMobile ? 'w-full max-w-sm' : ''
                                }`}
                            style={isMobile ? getTouchTargetStyle('comfortable') : {}}
                            {...(isMobile ? getTouchProps() : {})}
                        >
                            <i className="fa-solid fa-plus"></i>
                            Add Students
                        </button>
                    </div>
                )}
            </div>

            {/* Mobile-Optimized Quick Actions */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 print:hidden">
                <h2
                    className="text-slate-900 mb-6 font-black"
                    style={getTypographyStyle(isMobile ? 'heading-large' : 'heading-medium')}
                >
                    Quick Actions
                </h2>

                {isMobile ? (
                    /* Mobile: Full-width stacked buttons */
                    <div className="space-y-4">
                        <button
                            onClick={handleNavigateToManagement}
                            className="w-full p-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl hover:bg-emerald-100 active:bg-emerald-200 transition-all text-left touch-target-comfortable"
                            style={getTouchTargetStyle('comfortable')}
                            {...getTouchProps()}
                        >
                            <div className="flex items-center gap-4 mb-3">
                                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                                    <i className="fa-solid fa-users-cog text-emerald-600 text-xl"></i>
                                </div>
                                <div className="flex-1">
                                    <span
                                        className="font-bold text-emerald-900 block"
                                        style={getTypographyStyle('body-large')}
                                    >
                                        Manage Students
                                    </span>
                                    <p
                                        className="text-emerald-700 mt-1"
                                        style={getTypographyStyle('body-small')}
                                    >
                                        Add, edit, or remove student records
                                    </p>
                                </div>
                                <i className="fa-solid fa-chevron-right text-emerald-600"></i>
                            </div>
                        </button>

                        <button
                            onClick={handleNavigateToManagement}
                            className="w-full p-6 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 active:bg-blue-200 transition-all text-left touch-target-comfortable"
                            style={getTouchTargetStyle('comfortable')}
                            {...getTouchProps()}
                        >
                            <div className="flex items-center gap-4 mb-3">
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <i className="fa-solid fa-book-open text-blue-600 text-xl"></i>
                                </div>
                                <div className="flex-1">
                                    <span
                                        className="font-bold text-blue-900 block"
                                        style={getTypographyStyle('body-large')}
                                    >
                                        Manage Subjects
                                    </span>
                                    <p
                                        className="text-blue-700 mt-1"
                                        style={getTypographyStyle('body-small')}
                                    >
                                        Configure subjects and class assignments
                                    </p>
                                </div>
                                <i className="fa-solid fa-chevron-right text-blue-600"></i>
                            </div>
                        </button>

                        <button
                            onClick={handleRefreshData}
                            className="w-full p-6 bg-amber-50 border-2 border-amber-200 rounded-xl hover:bg-amber-100 active:bg-amber-200 transition-all text-left touch-target-comfortable"
                            style={getTouchTargetStyle('comfortable')}
                            {...getTouchProps()}
                        >
                            <div className="flex items-center gap-4 mb-3">
                                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <i className="fa-solid fa-sync-alt text-amber-600 text-xl"></i>
                                </div>
                                <div className="flex-1">
                                    <span
                                        className="font-bold text-amber-900 block"
                                        style={getTypographyStyle('body-large')}
                                    >
                                        Sync Database
                                    </span>
                                    <p
                                        className="text-amber-700 mt-1"
                                        style={getTypographyStyle('body-small')}
                                    >
                                        Refresh all data from Firebase
                                    </p>
                                </div>
                                <i className="fa-solid fa-chevron-right text-amber-600"></i>
                            </div>
                        </button>

                        {/* Mobile-specific additional quick actions */}
                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <button
                                onClick={handlePrint}
                                className="p-4 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 active:bg-purple-200 transition-all text-center touch-target-comfortable"
                                style={getTouchTargetStyle('comfortable')}
                                {...getTouchProps()}
                            >
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                                    <i className="fa-solid fa-print text-purple-600"></i>
                                </div>
                                <span
                                    className="font-bold text-purple-900 block"
                                    style={getTypographyStyle('body-small')}
                                >
                                    Print Report
                                </span>
                            </button>

                            <button
                                onClick={handleExport}
                                className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 active:bg-indigo-200 transition-all text-center touch-target-comfortable"
                                style={getTouchTargetStyle('comfortable')}
                                {...getTouchProps()}
                            >
                                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                                    <i className="fa-solid fa-download text-indigo-600"></i>
                                </div>
                                <span
                                    className="font-bold text-indigo-900 block"
                                    style={getTypographyStyle('body-small')}
                                >
                                    Export Data
                                </span>
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Desktop: Grid layout */
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                        <button
                            onClick={handleNavigateToManagement}
                            className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all text-left"
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <i className="fa-solid fa-users-cog text-emerald-600"></i>
                                <span
                                    className="font-bold text-emerald-900"
                                    style={getTypographyStyle('body-medium')}
                                >
                                    Manage Students
                                </span>
                            </div>
                            <p
                                className="text-emerald-700"
                                style={getTypographyStyle('body-small')}
                            >
                                Add, edit, or remove student records
                            </p>
                        </button>

                        <button
                            onClick={handleNavigateToManagement}
                            className="p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all text-left"
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <i className="fa-solid fa-book-open text-blue-600"></i>
                                <span
                                    className="font-bold text-blue-900"
                                    style={getTypographyStyle('body-medium')}
                                >
                                    Manage Subjects
                                </span>
                            </div>
                            <p
                                className="text-blue-700"
                                style={getTypographyStyle('body-small')}
                            >
                                Configure subjects and class assignments
                            </p>
                        </button>

                        <button
                            onClick={handleRefreshData}
                            className="p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-all text-left"
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <i className="fa-solid fa-sync-alt text-amber-600"></i>
                                <span
                                    className="font-bold text-amber-900"
                                    style={getTypographyStyle('body-medium')}
                                >
                                    Sync Database
                                </span>
                            </div>
                            <p
                                className="text-amber-700"
                                style={getTypographyStyle('body-small')}
                            >
                                Refresh all data from Firebase
                            </p>
                        </button>
                    </div>
                )}
            </div>

            {/* Enhanced Authentication Footer for Print Only */}
            <div className="hidden print:block print:mt-6 print:pt-4 border-t-2 border-black print:break-inside-avoid print:keep-with-previous print:keep-together">
                <div className="grid grid-cols-3 gap-4 print:text-xs text-black print:leading-tight">
                    {/* Generation Details */}
                    <div>
                        <div className="font-bold uppercase tracking-wider print:mb-2">Document Details</div>
                        <div className="space-y-1">
                            <div><span className="font-semibold">Generated On:</span></div>
                            <div>{new Date().toLocaleDateString('en-IN', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}</div>
                            <div>{new Date().toLocaleTimeString('en-IN')}</div>
                            <div className="print:mt-2">
                                <span className="font-semibold">Document ID:</span><br />
                                <span className="font-mono">AIC-DB-{Date.now().toString().slice(-8)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Official Signatures */}
                    <div className="text-center">
                        <div className="space-y-4">
                            <div>
                                <div className="border-b border-black w-32 mx-auto print:mb-2"></div>
                                <div className="font-bold uppercase tracking-wider">Academic Coordinator</div>
                            </div>
                            <div>
                                <div className="border-b border-black w-32 mx-auto print:mb-2"></div>
                                <div className="font-bold uppercase tracking-wider">Principal</div>
                            </div>
                        </div>
                    </div>

                    {/* Verification & Seal */}
                    <div className="text-right">
                        <div className="font-bold uppercase tracking-wider print:mb-2">Official Seal</div>
                        <div className="w-20 h-20 border-2 border-black rounded-full mx-auto print:mb-2 flex items-center justify-center">
                            <span className="text-xs font-bold">SEAL</span>
                        </div>
                        <div className="print:text-xs">
                            <div className="font-semibold">Verification Code:</div>
                            <div className="font-mono">{btoa('DASHBOARD' + Date.now()).slice(0, 8).toUpperCase()}</div>
                        </div>
                        <div className="print:mt-2 print:text-xs">
                            <div className="font-semibold">Valid Until:</div>
                            <div>{new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}</div>
                        </div>
                    </div>
                </div>

                {/* Footer Note */}
                <div className="print:mt-4 print:pt-2 border-t border-black text-center print:text-xs text-black print:break-inside-avoid">
                    <div className="font-semibold">
                        This is an official academic dashboard report generated by AIC Da'wa College Examination System
                    </div>
                    <div className="print:mt-1">
                        For verification and queries, contact: examinations@aicdawacollege.edu.in | Phone: +91-483-2734567
                    </div>
                </div>
            </div>

            {/* Simple touch feedback for mobile */}
            {isMobile && touchFeedback.isVisible && (
                <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-4 shadow-lg">
                        <p className="text-slate-900 font-medium">{touchFeedback.action}</p>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Dashboard;