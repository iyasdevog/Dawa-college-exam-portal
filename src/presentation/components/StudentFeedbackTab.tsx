import React, { useState, useEffect } from 'react';
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

    // Feedback response fields
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

    // Convert term key to display format
    const termKeyToDisplay = (termKey: string): string => {
        if (!termKey) return termKey;
        return termKey.replace(/-(?=[^-]*$)/, ' ');
    };

    // Convert display format back to term key
    const displayToTermKey = (display: string): string => {
        if (!display) return display;
        return display.replace(/ (?=(Odd|Even|Bridge)$)/, '-');
    };

    // Load semester options from DB
    const [semesterOptions, setSemesterOptions] = useState<string[]>([]);
    useEffect(() => {
        const loadTerms = async () => {
            try {
                const terms = await dataService.getAvailableTerms();
                const displayTerms = terms.map(termKeyToDisplay).filter(Boolean);
                const unique = Array.from(new Set(displayTerms)).sort().reverse();
                setSemesterOptions(unique);
            } catch {
                // Fallback
            }
        };
        loadTerms();
    }, []);

    // Sync selectedSemester with activeTerm
    useEffect(() => {
        if (activeTerm) {
            const formatted = termKeyToDisplay(activeTerm);
            setSelectedSemester(formatted);
        }
    }, [activeTerm]);

    // Load metadata based on selected semester
    useEffect(() => {
        if (!selectedSemester) return;
        const loadMetadata = async () => {
            try {
                const termKey = displayToTermKey(selectedSemester);
                const [termClasses, counts, subs, accounts] = await Promise.all([
                    dataService.getClassesByTerm(termKey),
                    dataService.getClassFeedbackCounts(selectedSemester),
                    dataService.getAllSubjects(termKey),
                    dataService.getAllTeacherAccounts()
                ]);

                const resolvedClasses = termClasses.length > 0 ? termClasses : activeClasses;
                setClassList(resolvedClasses);
                setClassCounts(counts);

                setSelectedClass(prev => resolvedClasses.includes(prev) ? prev : '');

                const namesSet = new Set<string>();
                subs.forEach(s => {
                    if (s.facultyName && s.facultyName.trim()) namesSet.add(s.facultyName.trim());
                });
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
            const topicPrefix = `${clueText}: `;
            const updated = current ? `${current.trim()}\n${topicPrefix}` : topicPrefix;
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
            setFormError('Please select your class.');
            return;
        }
        if (!selectedTeacher) {
            setFormError('Please select the teacher you are reviewing.');
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
            const updatedCounts = await dataService.getClassFeedbackCounts(selectedSemester);
            setClassCounts(updatedCounts);

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

    // Evaluation categories with neutral topic/aspect hints
    const evalCategories = [
        {
            key: 'teachingLearning' as const,
            title: 'Teaching & Explanation',
            icon: '📚',
            chips: ['Explanation clarity', 'Teaching pace & speed', 'Doubt clarification', 'Subject knowledge depth', 'Classroom interaction', 'Use of examples']
        },
        {
            key: 'spiritualMoral' as const,
            title: 'Spiritual & Moral Guidance',
            icon: '🕌',
            chips: ['Moral guidance', 'Spiritual advice', 'Value integration', 'Role modeling & ethics']
        },
        {
            key: 'communication' as const,
            title: 'Communication & Approachability',
            icon: '💬',
            chips: ['Tone & speech', 'Approachability', 'Feedback on performance', 'Listening to students']
        },
        {
            key: 'professionalConduct' as const,
            title: 'Punctuality & Fairness',
            icon: '⚖️',
            chips: ['Punctuality & timing', 'Fairness & impartiality', 'Classroom discipline', 'Class regularity']
        },
        {
            key: 'studentDevelopment' as const,
            title: 'Student Support & Growth',
            icon: '🌱',
            chips: ['Support for struggling students', 'Student motivation', 'Doubt encouragement', 'Individual guidance']
        },
        {
            key: 'residentialCommunity' as const,
            title: 'Campus & Hostel Interaction',
            icon: '🏠',
            chips: ['Hostel availability', 'Campus interaction', 'Outside-class guidance', 'Student welfare care']
        }
    ];

    const ratingLabels = ['1 - Poor', '2 - Fair', '3 - Good', '4 - Very Good', '5 - Excellent'];

    return (
        <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-5 sm:p-7 text-white shadow-xl border border-emerald-500/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            Student Feedback Portal
                        </div>
                        <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
                            Teacher Evaluation Form
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1">
                            Provide quick, confidential feedback to help improve teaching quality.
                        </p>
                    </div>

                    <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Selected Term</span>
                        <span className="text-sm font-black text-emerald-400">{selectedSemester}</span>
                    </div>
                </div>

                {/* Collapsible Class-wise Counts */}
                <div className="mt-4 pt-4 border-t border-slate-800/80">
                    <button
                        type="button"
                        onClick={() => setIsClassCountsExpanded(!isClassCountsExpanded)}
                        className="w-full flex items-center justify-between text-left focus:outline-none group"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Class Feedback Summary</span>
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full">
                                {Object.values(classCounts).reduce((a, b) => a + b, 0)} total submitted
                            </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-emerald-400 transition-colors">
                            <span>{isClassCountsExpanded ? 'Hide' : 'Show'} ({classList.length} classes)</span>
                            <svg className={`w-4 h-4 transform transition-transform ${isClassCountsExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </button>

                    {isClassCountsExpanded && (
                        <div className="mt-3 flex flex-wrap gap-1.5 pt-2">
                            {classList.map(cls => {
                                const count = classCounts[cls] || 0;
                                return (
                                    <div key={cls} className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs">
                                        <span className="text-slate-300">{cls}:</span>
                                        <span className={`font-bold px-1.5 py-0.2 rounded text-[11px] ${count > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                                            {count}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Submission Success */}
            {submitSuccess && (
                <div className="bg-emerald-950/60 border border-emerald-500/50 rounded-3xl p-6 text-center space-y-3">
                    <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                        ✓
                    </div>
                    <h3 className="text-emerald-300 font-bold text-lg">Thank You! Feedback Submitted</h3>
                    <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto">
                        Your response has been securely saved and will contribute to improving teaching and academic excellence.
                    </p>
                    <button
                        type="button"
                        onClick={() => setSubmitSuccess(false)}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
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
                        <div className="bg-rose-950/60 border border-rose-500/50 text-rose-200 text-sm font-medium p-4 rounded-2xl flex items-center gap-2">
                            <span>⚠️</span>
                            <span>{formError}</span>
                        </div>
                    )}

                    {/* Step 1: Basic Information & Teacher Selection */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                                    <span>👤</span> Select Faculty & Class
                                </h2>
                                <p className="text-slate-400 text-xs mt-0.5">Choose your semester, class, teacher, and privacy preference</p>
                            </div>

                            {/* Anonymous Toggle */}
                            <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700 w-full sm:w-auto justify-between">
                                <span className="text-xs text-slate-300 font-medium px-2">Privacy:</span>
                                <button
                                    type="button"
                                    onClick={() => setIsAnonymous(!isAnonymous)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        isAnonymous
                                            ? 'bg-emerald-500 text-slate-950 shadow-md'
                                            : 'bg-slate-700 text-slate-200'
                                    }`}
                                >
                                    {isAnonymous ? '🛡️ Anonymous' : '👤 Named'}
                                </button>
                            </div>
                        </div>

                        {/* Student Details (Only if Named) */}
                        {!isAnonymous && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-800/60 rounded-2xl border border-slate-700">
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Student Name (Optional)</label>
                                    <input
                                        type="text"
                                        value={studentName}
                                        onChange={e => setStudentName(e.target.value)}
                                        placeholder="Your name"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Admission Number (Optional)</label>
                                    <input
                                        type="text"
                                        value={studentAdNo}
                                        onChange={e => setStudentAdNo(e.target.value)}
                                        placeholder="Admission number"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Selectors */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">
                                    Semester <span className="text-rose-400">*</span>
                                </label>
                                <select
                                    value={selectedSemester}
                                    onChange={e => setSelectedSemester(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-medium focus:outline-none focus:border-emerald-500"
                                >
                                    {semesterOptions.map(sem => (
                                        <option key={sem} value={sem}>{sem}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">
                                    Class / Batch <span className="text-rose-400">*</span>
                                </label>
                                <select
                                    value={selectedClass}
                                    onChange={e => setSelectedClass(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-medium focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="">-- Select Class --</option>
                                    {classList.map(cls => (
                                        <option key={cls} value={cls}>{cls}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">
                                    Faculty / Teacher Name <span className="text-rose-400">*</span>
                                </label>
                                {teacherList.length > 0 ? (
                                    <select
                                        value={selectedTeacher}
                                        onChange={e => setSelectedTeacher(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-medium focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="">-- Select Teacher --</option>
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
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Star Rating */}
                        <div className="bg-slate-800/70 p-4 rounded-2xl border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                                <span className="text-xs font-bold text-slate-200">Overall Rating</span>
                                <p className="text-[11px] text-slate-400">Rate your overall experience with this teacher</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setOverallRating(star)}
                                            className={`w-9 h-9 rounded-xl text-lg font-bold flex items-center justify-center transition-all ${
                                                star <= overallRating
                                                    ? 'bg-amber-500 text-slate-950 scale-105 shadow-md shadow-amber-500/20'
                                                    : 'bg-slate-700 text-slate-500 hover:text-amber-300'
                                            }`}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>
                                <span className="text-xs font-bold text-amber-400 ml-1">
                                    {ratingLabels[overallRating - 1] || `${overallRating} / 5`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Key Evaluation Areas (Neutral Topics + Language Prompt) */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                        <div className="border-b border-slate-800 pb-3">
                            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                                <span>⭐</span> Evaluation Areas & Detailed Feedback
                            </h2>
                            <p className="text-slate-400 text-xs mt-0.5">
                                Tap topic hints to add structured headings or write your honest observations below.
                            </p>
                        </div>

                        {/* Malayalam Language Guidance Prompt */}
                        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3">
                            <span className="text-xl shrink-0">🗣️</span>
                            <div className="text-xs space-y-1">
                                <p className="font-bold text-emerald-300 text-sm">
                                    അഭിപ്രായങ്ങൾ മലയാളത്തിലോ ഇംഗ്ലീഷിലോ എഴുതാവുന്നതാണ് (Write in Malayalam or English)
                                </p>
                                <p className="text-slate-300 leading-relaxed">
                                    റെഡിമേഡ് positive ക്ലിക്കുകൾക്ക് പകരം നിങ്ങളുടെ സ്വന്തം അഭിപ്രായങ്ങൾ മലയാളത്തിലോ (Malayalam/Manglish) ഇംഗ്ലീഷിലോ ടൈപ്പ് ചെയ്യുക. ചർച്ചാവിഷയം തെരഞ്ഞെടുക്കാൻ താഴെയുള്ള Topic Hints (+) ടാപ്പ് ചെയ്യാവുന്നതാണ്.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {evalCategories.map(cat => {
                                const hasValue = Boolean(responses[cat.key]?.trim());
                                return (
                                    <div
                                        key={cat.key}
                                        className={`bg-slate-800/60 border rounded-2xl p-3.5 sm:p-4 transition-all ${
                                            hasValue ? 'border-emerald-500/50 bg-slate-800/90' : 'border-slate-700/80 hover:border-slate-600'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{cat.icon}</span>
                                                <h3 className="text-xs sm:text-sm font-bold text-white">{cat.title}</h3>
                                            </div>
                                            {hasValue && (
                                                <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/30">
                                                    Added
                                                </span>
                                            )}
                                        </div>

                                        <textarea
                                            rows={2}
                                            value={responses[cat.key]}
                                            onChange={e => handleInputChange(cat.key, e.target.value)}
                                            placeholder="അഭിപ്രായം ഇവിടെ എഴുതുക (മലയാളത്തിലോ ഇംഗ്ലീഷിലോ)... Write feedback in Malayalam or English..."
                                            className="w-full bg-slate-900/90 border border-slate-700/90 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed transition-all"
                                        />

                                        {/* Neutral Topic Hints */}
                                        <div className="mt-2.5 space-y-1">
                                            <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Tap topic to add heading:</span>
                                            <div className="flex flex-wrap gap-1">
                                                {cat.chips.map((chip, idx) => {
                                                    const isAdded = (responses[cat.key] || '').includes(chip);
                                                    return (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => handleAppendClue(cat.key, chip)}
                                                            className={`px-2 py-1 text-[11px] rounded-lg transition-all active:scale-95 ${
                                                                isAdded
                                                                    ? 'bg-emerald-500/30 border border-emerald-400 text-emerald-300 font-bold'
                                                                    : 'bg-slate-900 border border-slate-700/80 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300'
                                                            }`}
                                                        >
                                                            {chip} {isAdded ? '✓' : '+'}
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

                    {/* Step 3: Optional Remarks & Suggestions */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                        <div className="border-b border-slate-800 pb-3">
                            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                                <span>📝</span> General Remarks & Recommendations <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                            </h2>
                            <p className="text-slate-400 text-xs mt-0.5">Share specific observations or constructive recommendations for growth (in Malayalam or English).</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4">
                                <label className="block text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                                    <span>🌟</span> Strengths & Inspiring Practices
                                </label>
                                <textarea
                                    rows={3}
                                    value={responses.strengths}
                                    onChange={e => handleInputChange('strengths', e.target.value)}
                                    placeholder="അധ്യാപകന്റെ പ്രധാന നേട്ടങ്ങളും നല്ല വശങ്ങളും (മലയാളത്തിലോ ഇംഗ്ലീഷിലോ)... Write strengths in Malayalam or English..."
                                    className="w-full bg-slate-900/90 border border-slate-700/90 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed"
                                />
                            </div>

                            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4">
                                <label className="block text-xs font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                                    <span>💡</span> Suggestions for Growth
                                </label>
                                <textarea
                                    rows={3}
                                    value={responses.improvements}
                                    onChange={e => handleInputChange('improvements', e.target.value)}
                                    placeholder="മെച്ചപ്പെടുത്തേണ്ട കാര്യങ്ങളും നിർദേശങ്ങളും (മലയാളത്തിലോ ഇംഗ്ലീഷിലോ)... Write recommendations in Malayalam or English..."
                                    className="w-full bg-slate-900/90 border border-slate-700/90 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex items-center justify-end pt-2 sticky bottom-4 z-20">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Submitting...</span>
                                </>
                            ) : (
                                <>
                                    <span>Submit Feedback</span>
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
