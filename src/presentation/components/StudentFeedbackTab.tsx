import React, { useState, useEffect, useMemo } from 'react';
import type { SubjectConfig, StudentFeedback } from '../../domain/entities/types';
import { SYSTEM_CLASSES } from '../../domain/entities/constants';
import { dataService } from '../../infrastructure/services/dataService';
import { useTerm } from '../viewmodels/TermContext';

interface StudentFeedbackTabProps {
    availableSubjects?: SubjectConfig[];
    activeClasses?: string[];
}

export const StudentFeedbackTab: React.FC<StudentFeedbackTabProps> = ({
    availableSubjects = [],
    activeClasses = SYSTEM_CLASSES
}) => {
    const { activeTerm } = useTerm();

    // Form state
    const [selectedSemester, setSelectedSemester] = useState<string>('2025-2026 Even');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedTeacher, setSelectedTeacher] = useState<string>('');
    const [isAnonymous, setIsAnonymous] = useState<boolean>(true);
    const [studentName, setStudentName] = useState<string>('');
    const [studentAdNo, setStudentAdNo] = useState<string>('');
    const [overallRating, setOverallRating] = useState<number>(5);

    // Open reflection response fields
    const [responses, setResponses] = useState({
        teachingLearning: '',
        spiritualMoral: '',
        residentialCommunity: '',
        communication: '',
        studentDevelopment: '',
        professionalConduct: '',
        overallImpact: '',
        strengths: '',
        continueDoing: '',
        improvements: '',
        positiveExperience: '',
        bridgingDisconnection: ''
    });

    const [classCounts, setClassCounts] = useState<Record<string, number>>({});
    const [teacherList, setTeacherList] = useState<string[]>([]);
    const [classList, setClassList] = useState<string[]>(activeClasses);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
    const [formError, setFormError] = useState<string>('');
    const [isClassCountsExpanded, setIsClassCountsExpanded] = useState<boolean>(false);

    // Convert term key (e.g. "2025-2026-Even") to display format ("2025-2026 Even")
    const termKeyToDisplay = (termKey: string): string => {
        if (!termKey) return termKey;
        return termKey.replace(/-(?=[^-]*$)/, ' ');
    };

    // Convert display format ("2025-2026 Even") back to term key ("2025-2026-Even")
    const displayToTermKey = (display: string): string => {
        if (!display) return display;
        return display.replace(/ (?=(Odd|Even|Bridge)$)/, '-');
    };

    // Load semester options from DB (real terms that have data)
    const [semesterOptions, setSemesterOptions] = useState<string[]>([]);
    useEffect(() => {
        const loadTerms = async () => {
            try {
                const terms = await dataService.getAvailableTerms(); // returns ["2025-2026-Even", ...]
                const displayTerms = terms.map(termKeyToDisplay).filter(Boolean);
                // Deduplicate and sort descending
                const unique = Array.from(new Set(displayTerms)).sort().reverse();
                setSemesterOptions(unique);
            } catch {
                // Fallback to activeTerm only
            }
        };
        loadTerms();
    }, []);

    // Sync selectedSemester with activeTerm when activeTerm changes
    useEffect(() => {
        if (activeTerm) {
            const formatted = termKeyToDisplay(activeTerm);
            setSelectedSemester(formatted);
        }
    }, [activeTerm]);

    // Load dynamic class list, class counts & teacher list based on selected semester
    useEffect(() => {
        if (!selectedSemester) return;
        const loadMetadata = async () => {
            try {
                const termKey = displayToTermKey(selectedSemester);

                // Load classes, counts and teachers in parallel
                const [termClasses, counts, subs, accounts] = await Promise.all([
                    dataService.getClassesByTerm(termKey),
                    dataService.getClassFeedbackCounts(selectedSemester),
                    dataService.getAllSubjects(termKey),
                    dataService.getAllTeacherAccounts()
                ]);

                // Classes for this specific semester
                const resolvedClasses = termClasses.length > 0 ? termClasses : activeClasses;
                setClassList(resolvedClasses);
                setClassCounts(counts);

                // Reset class if no longer valid for this semester
                setSelectedClass(prev => resolvedClasses.includes(prev) ? prev : '');

                // Teachers from subjects of this semester
                const namesSet = new Set<string>();
                subs.forEach(s => {
                    if (s.facultyName && s.facultyName.trim()) namesSet.add(s.facultyName.trim());
                });
                // Merge registered teacher accounts as fallback
                accounts.forEach(t => {
                    if (t.name && t.name.trim()) namesSet.add(t.name.trim());
                });

                setTeacherList(Array.from(namesSet).sort());
                setSelectedTeacher('');
            } catch (err) {
                console.error('Failed to load feedback metadata:', err);
            }
        };
        loadMetadata();
    }, [selectedSemester]);

    const handleInputChange = (field: keyof typeof responses, value: string) => {
        setResponses(prev => ({ ...prev, [field]: value }));
    };

    const handleAppendClue = (field: keyof typeof responses, clueText: string) => {
        setResponses(prev => {
            const current = prev[field] || '';
            if (current.includes(clueText)) return prev;
            const updated = current ? `${current.trim()}; ${clueText}` : clueText;
            return { ...prev, [field]: updated };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (!selectedSemester) {
            setFormError('Please select a semester.');
            return;
        }
        if (!selectedClass) {
            setFormError('Please select your class / batch.');
            return;
        }
        if (!selectedTeacher) {
            setFormError('Please select the faculty / teacher you are reviewing.');
            return;
        }

        setIsSubmitting(true);
        try {
            const feedbackPayload: Omit<StudentFeedback, 'id' | 'createdAt'> = {
                semester: selectedSemester,
                teacherName: selectedTeacher,
                className: selectedClass,
                isAnonymous: isAnonymous,
                studentName: isAnonymous ? undefined : studentName.trim(),
                studentAdNo: isAnonymous ? undefined : studentAdNo.trim(),
                overallRating: overallRating,
                responses: responses
            };

            await dataService.submitFeedback(feedbackPayload);

            setSubmitSuccess(true);
            // Refresh counts
            const updatedCounts = await dataService.getClassFeedbackCounts(selectedSemester);
            setClassCounts(updatedCounts);

            // Reset form fields
            setResponses({
                teachingLearning: '',
                spiritualMoral: '',
                residentialCommunity: '',
                communication: '',
                studentDevelopment: '',
                professionalConduct: '',
                overallImpact: '',
                strengths: '',
                continueDoing: '',
                improvements: '',
                positiveExperience: '',
                bridgingDisconnection: ''
            });
            setOverallRating(5);
        } catch (err) {
            console.error('Failed to submit student feedback:', err);
            setFormError('An error occurred while submitting your feedback. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Category Clue Config
    const categoriesConfig = [
        {
            key: 'teachingLearning' as const,
            title: '1. Teaching & Learning',
            icon: '📚',
            clues: ['Clarity of explanation', 'Subject mastery', 'Pace & structure of delivery', 'Use of learning aids / interactive teaching', 'Encouraging student participation']
        },
        {
            key: 'spiritualMoral' as const,
            title: '2. Spiritual & Moral Influence',
            icon: '🕌',
            clues: ['Encourage good akhlaq (character)', 'Inspires spiritually', 'Connects knowledge with Islamic values', 'Promotes moral responsibility']
        },
        {
            key: 'residentialCommunity' as const,
            title: '3. Residential & Community Presence',
            icon: '🏠',
            clues: ['Interacts positively outside class', 'Accessible in hostel / campus settings', 'Shows concern for student well-being', 'Participates in student life appropriately', 'Creates a positive campus atmosphere']
        },
        {
            key: 'communication' as const,
            title: '4. Communication',
            icon: '💬',
            clues: ['Speaks respectfully', 'Gives constructive feedback', 'Handles disagreements fairly', 'Explains expectations clearly', 'Responds appropriately to student concerns']
        },
        {
            key: 'studentDevelopment' as const,
            title: '5. Student Development',
            icon: '🌱',
            clues: ['Encourages leadership', 'Encourages responsibility', 'Builds confidence', 'Encourages independent thinking', 'Supports language & communication growth']
        },
        {
            key: 'professionalConduct' as const,
            title: '6. Professional Conduct',
            icon: '⚖️',
            clues: ['Punctual & responsible', 'Consistent in behavior', 'Fair to all students', 'Maintains appropriate boundaries', 'Acts with integrity']
        },
        {
            key: 'overallImpact' as const,
            title: '7. Overall Impact',
            icon: '🌟',
            clues: ['Positively influenced my growth', 'Contributed to academic development', 'Contributed to personal development', 'Contributed to Islamic development']
        }
    ];

    const reflectionQuestionsConfig = [
        {
            key: 'strengths' as const,
            title: 'Strengths & Exemplary Practices',
            prompt: 'What specific teaching strengths or inspiring practices does this teacher possess that make learning effective?'
        },
        {
            key: 'continueDoing' as const,
            title: 'Positive Practices to Continue',
            prompt: 'What positive activities, teaching methods, or support systems should this teacher continue?'
        },
        {
            key: 'improvements' as const,
            title: 'Constructive Suggestions for Growth',
            prompt: 'What constructive recommendations or improvements could help this teacher enhance their teaching or student rapport?'
        },
        {
            key: 'positiveExperience' as const,
            title: 'Memorable Positive Experience',
            prompt: 'Describe a memorable positive experience or inspiring interaction you had with this teacher.'
        },
        {
            key: 'bridgingDisconnection' as const,
            title: 'Bridging Connection & Extra Support',
            prompt: 'Describe any situations where students may feel disconnected or need extra support from this teacher, along with ideas to build better connection.'
        }
    ];

    return (
        <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-emerald-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full filter blur-3xl pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-emerald-300 text-xs font-bold uppercase tracking-wider mb-3">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                            Student Voice & Growth Portal
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                            Student Feedback System
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
                            Share genuine, constructive feedback to enhance faculty teaching, spiritual mentorship, and campus life.
                        </p>
                    </div>

                    <div className="bg-slate-800/80 backdrop-blur border border-slate-700/80 rounded-2xl p-4 min-w-[200px] text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Selected Term</span>
                        <span className="text-lg font-black text-emerald-400">{selectedSemester}</span>
                    </div>
                </div>

                {/* Class-wise Received Feedback Counts – Collapsible & Compact */}
                <div className="mt-6 pt-6 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={() => setIsClassCountsExpanded(!isClassCountsExpanded)}
                        className="w-full flex items-center justify-between text-left focus:outline-none group"
                    >
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Class-Wise Feedback Counts</span>
                            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black rounded-full">
                                {Object.values(classCounts).reduce((a, b) => a + b, 0)} total
                            </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 group-hover:text-emerald-400 transition-colors">
                            <span>{isClassCountsExpanded ? 'Hide' : 'Show'} ({classList.length})</span>
                            <svg className={`w-3.5 h-3.5 transform transition-transform duration-200 ${isClassCountsExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </button>

                    {isClassCountsExpanded && (
                        <div className="mt-3 flex flex-wrap gap-1.5 animate-fadeIn">
                            {classList.map(cls => {
                                const count = classCounts[cls] || 0;
                                return (
                                    <div key={cls} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-[11px]">
                                        <span className="font-semibold text-slate-300">{cls}:</span>
                                        <span className={`font-black px-1.5 py-0.2 rounded ${count > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700/60 text-slate-400'}`}>
                                            {count}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Submit Success Message */}
            {submitSuccess && (
                <div className="bg-emerald-900/40 border border-emerald-500/50 rounded-2xl p-6 text-center animate-fadeIn">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-400 text-2xl font-bold">
                        ✓
                    </div>
                    <h3 className="text-emerald-300 font-bold text-lg">Jazakallahu Khair! Feedback Received</h3>
                    <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-md mx-auto">
                        Your feedback has been saved securely and confidentially. It will contribute to continuous growth and educational excellence.
                    </p>
                    <button
                        onClick={() => setSubmitSuccess(false)}
                        className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                    >
                        Submit Another Feedback
                    </button>
                </div>
            )}

            {/* Main Form */}
            {!submitSuccess && (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Error Banner */}
                    {formError && (
                        <div className="bg-rose-900/40 border border-rose-500/50 text-rose-200 text-sm font-medium p-4 rounded-2xl flex items-center gap-3">
                            <span className="text-xl">⚠️</span>
                            <span>{formError}</span>
                        </div>
                    )}

                    {/* Step 1: Selection & Confidentiality Settings */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                            <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-sm flex items-center justify-center">1</span>
                            <div>
                                <h2 className="text-lg font-bold text-white">Target Faculty & Confidentiality Setup</h2>
                                <p className="text-slate-400 text-xs">Select semester, class, teacher, and privacy preference</p>
                            </div>
                        </div>

                        {/* Confidentiality Notice & Toggle */}
                        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 text-xl">
                                    🔒
                                </div>
                                <div>
                                    <h4 className="text-emerald-300 font-bold text-sm flex items-center gap-2">
                                        100% Confidentiality Guarantee
                                    </h4>
                                    <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">
                                        When <strong className="text-emerald-400">Anonymous</strong> is selected, your name and admission number are completely hidden. Teachers only review aggregated open feedback.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-slate-900/80 p-2 rounded-xl border border-slate-800 shrink-0 w-full sm:w-auto justify-between">
                                <span className="text-xs font-bold text-slate-300">Identity Mode:</span>
                                <button
                                    type="button"
                                    onClick={() => setIsAnonymous(!isAnonymous)}
                                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
                                        isAnonymous
                                            ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                                >
                                    {isAnonymous ? '🛡️ Anonymous (Hidden)' : '👤 Named (Visible)'}
                                </button>
                            </div>
                        </div>

                        {/* Student Name/AdNo input if NOT anonymous */}
                        {!isAnonymous && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/80 animate-fadeIn">
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Student Name (Optional)</label>
                                    <input
                                        type="text"
                                        value={studentName}
                                        onChange={e => setStudentName(e.target.value)}
                                        placeholder="Enter your name"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Admission Number (Optional)</label>
                                    <input
                                        type="text"
                                        value={studentAdNo}
                                        onChange={e => setStudentAdNo(e.target.value)}
                                        placeholder="Enter admission number"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Dropdown Selectors */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                                    Semester <span className="text-rose-400">*</span>
                                </label>
                                <select
                                    value={selectedSemester}
                                    onChange={e => setSelectedSemester(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-emerald-500"
                                >
                                    {semesterOptions.map(sem => (
                                        <option key={sem} value={sem}>{sem}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                                    Select Class / Batch <span className="text-rose-400">*</span>
                                </label>
                                <select
                                    value={selectedClass}
                                    onChange={e => setSelectedClass(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="">-- Choose Class --</option>
                                    {classList.map(cls => (
                                        <option key={cls} value={cls}>{cls}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                                    Faculty / Teacher Name <span className="text-rose-400">*</span>
                                </label>
                                {teacherList.length > 0 ? (
                                    <select
                                        value={selectedTeacher}
                                        onChange={e => setSelectedTeacher(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-medium focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="">-- Choose Faculty --</option>
                                        {teacherList.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={selectedTeacher}
                                        onChange={e => setSelectedTeacher(e.target.value)}
                                        placeholder="Enter Teacher Name"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Overall Rating Stars */}
                        <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Overall Teacher Experience</span>
                                <p className="text-[11px] text-slate-400">Rate your general experience with this teacher for this semester</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setOverallRating(star)}
                                        className={`w-9 h-9 rounded-xl text-lg font-bold flex items-center justify-center transition-all ${
                                            star <= overallRating
                                                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 scale-105'
                                                : 'bg-slate-700 text-slate-500 hover:text-amber-400'
                                        }`}
                                    >
                                        ★
                                    </button>
                                ))}
                                <span className="ml-2 text-xs font-bold text-amber-400">{overallRating} / 5</span>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Open-Ended Category Reflections with Persistent Clues */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-7 shadow-xl space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-sm flex items-center justify-center shrink-0">2</span>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-base sm:text-lg font-bold text-white">Evaluation Categories</h2>
                                        <span className="px-2 py-0.5 bg-slate-800 text-emerald-400 text-[10px] font-bold rounded-md border border-emerald-500/30 uppercase">
                                            Optional - Fill what you like
                                        </span>
                                    </div>
                                    <p className="text-slate-400 text-xs">Write your thoughts or tap the suggestion chips below each box on mobile.</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {categoriesConfig.map(cat => {
                                const hasValue = Boolean(responses[cat.key]?.trim());
                                return (
                                    <div key={cat.key} className={`bg-slate-800/60 border rounded-2xl p-4 sm:p-5 transition-all ${
                                        hasValue ? 'border-emerald-500/50 bg-slate-800/90' : 'border-slate-700/80 hover:border-slate-600'
                                    }`}>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">{cat.icon}</span>
                                                <h3 className="text-sm font-bold text-white">{cat.title}</h3>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 bg-slate-900/60 rounded-md border border-slate-700">
                                                {hasValue ? '✓ Content Added' : 'Optional'}
                                            </span>
                                        </div>

                                        {/* Textarea */}
                                        <textarea
                                            rows={3}
                                            value={responses[cat.key]}
                                            onChange={e => handleInputChange(cat.key, e.target.value)}
                                            placeholder={`Optional: Type your feedback or tap clue chips below...`}
                                            className="w-full bg-slate-900/90 border border-slate-700/90 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed transition-all touch-manipulation min-h-[80px]"
                                        />

                                        {/* INTERACTIVE TAP-TO-INSERT CLUES */}
                                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-2">
                                                💡 Key Areas (Tap any chip to auto-insert):
                                            </span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {cat.clues.map((clue, idx) => {
                                                    const isAdded = (responses[cat.key] || '').includes(clue);
                                                    return (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => handleAppendClue(cat.key, clue)}
                                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all active:scale-95 touch-manipulation ${
                                                                isAdded
                                                                    ? 'bg-emerald-500/30 border border-emerald-400 text-emerald-300 font-bold'
                                                                    : 'bg-slate-900/90 border border-slate-700 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300'
                                                            }`}
                                                        >
                                                            <span className={`w-1.5 h-1.5 rounded-full ${isAdded ? 'bg-emerald-300' : 'bg-emerald-400'}`}></span>
                                                            <span>{clue}</span>
                                                            <span className="text-[10px] opacity-75">{isAdded ? '✓' : '+'}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step 3: Open Reflection Questions */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-7 shadow-xl space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-sm flex items-center justify-center shrink-0">3</span>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-base sm:text-lg font-bold text-white">Open Reflection Questions</h2>
                                        <span className="px-2 py-0.5 bg-slate-800 text-emerald-400 text-[10px] font-bold rounded-md border border-emerald-500/30 uppercase">
                                            Optional
                                        </span>
                                    </div>
                                    <p className="text-slate-400 text-xs">Feel free to answer any reflection questions you feel comfortable with.</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {reflectionQuestionsConfig.map((q, i) => {
                                const hasVal = Boolean(responses[q.key]?.trim());
                                return (
                                    <div key={q.key} className={`bg-slate-800/60 border rounded-2xl p-4 sm:p-5 transition-all ${
                                        hasVal ? 'border-emerald-500/50 bg-slate-800/90' : 'border-slate-700/80'
                                    }`}>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div>
                                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Question {i + 1}</span>
                                                <h4 className="text-sm font-bold text-white">{q.title}</h4>
                                                <p className="text-xs text-slate-300 mt-0.5">{q.prompt}</p>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 bg-slate-900/60 rounded-md border border-slate-700 shrink-0">
                                                {hasVal ? '✓ Answered' : 'Optional'}
                                            </span>
                                        </div>

                                        <textarea
                                            rows={3}
                                            value={responses[q.key]}
                                            onChange={e => handleInputChange(q.key, e.target.value)}
                                            placeholder="Optional: Write your reflection or recommendation here..."
                                            className="w-full bg-slate-900/90 border border-slate-700/90 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed transition-all mt-2 touch-manipulation min-h-[80px]"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Submit Actions */}
                    <div className="flex items-center justify-end gap-4 pt-4 sticky bottom-4 z-20">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm sm:text-base rounded-2xl shadow-2xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50 touch-manipulation active:scale-98"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Submitting Secure Feedback...</span>
                                </>
                            ) : (
                                <>
                                    <span>Submit Confidential Feedback</span>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default StudentFeedbackTab;
