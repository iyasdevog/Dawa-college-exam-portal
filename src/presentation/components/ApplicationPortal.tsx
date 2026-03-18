import React, { useState, useEffect } from 'react';
import { dataService } from '../../infrastructure/services/dataService';
import { StudentApplication, ApplicationType, ApplicationStatus, SubjectConfig, StudentRecord } from '../../domain/entities/types';
import { CLASSES } from '../../domain/entities/constants';
import { useMobile } from '../hooks/useMobile';

interface ApplicationPortalProps {
    onClose: () => void;
}

const ApplicationPortal: React.FC<ApplicationPortalProps> = ({ onClose }) => {
    const [view, setView] = useState<'apply' | 'status'>('apply');
    const [adNo, setAdNo] = useState('');
    const [studentName, setStudentName] = useState('');
    const [className, setClassName] = useState(CLASSES[0]);
    const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    const [appType, setAppType] = useState<ApplicationType>('revaluation');
    const [reason, setReason] = useState('');
    const [specialReason, setSpecialReason] = useState<'medical' | 'other'>('medical');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAutoFilling, setIsAutoFilling] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [searchAdNo, setSearchAdNo] = useState('');
    const [myApplications, setMyApplications] = useState<StudentApplication[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const { isMobile } = useMobile();

    // Auto-fill student name when Ad No changes
    useEffect(() => {
        const autoFill = async () => {
            if (adNo.length >= 3) { // Threshold for searching
                setIsAutoFilling(true);
                try {
                    const student = await dataService.getStudentByAdNo(adNo);
                    if (student) {
                        setStudentName(student.name);
                        if (CLASSES.includes(student.className || '')) {
                            setClassName(student.className || CLASSES[0]);
                        }
                    }
                } catch (error) {
                    console.error('Auto-fill error:', error);
                } finally {
                    setIsAutoFilling(false);
                }
            }
        };
        const timer = setTimeout(autoFill, 500); // Debounce
        return () => clearTimeout(timer);
    }, [adNo]);

    // Load subjects based on selected class
    useEffect(() => {
        const loadSubjects = async () => {
            const classSubjects = await dataService.getSubjectsByClass(className);
            setSubjects(classSubjects);
            setSelectedSubjects([]); // Reset selection when class changes
        };
        loadSubjects();
    }, [className]);

    const fees: Record<ApplicationType, number> = {
        'revaluation': 100,
        'improvement': 100,
        'external-supp': 300,
        'internal-supp': 50,
        'special-supp': 150
    };

    const toggleSubject = (subjectId: string) => {
        setSelectedSubjects(prev => 
            prev.includes(subjectId) 
                ? prev.filter(id => id !== subjectId) 
                : [...prev, subjectId]
        );
    };

    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedSubjects.length === 0) {
            setMessage({ type: 'error', text: 'Please select at least one subject.' });
            return;
        }

        setIsSubmitting(true);
        setMessage(null);

        try {
            const settings = await dataService.getGlobalSettings();
            
            // Submit individual applications for each subject
            const promises = selectedSubjects.map(async (subjId) => {
                const subject = subjects.find(s => s.id === subjId);
                return dataService.submitApplication({
                    adNo,
                    studentName,
                    className,
                    subjectId: subjId,
                    subjectName: subject?.name || subjId,
                    type: appType,
                    fee: fees[appType],
                    appliedYear: settings.currentAcademicYear,
                    appliedSemester: settings.currentSemester,
                    reason: appType === 'special-supp' ? `[${specialReason.toUpperCase()}] ${reason}` : undefined
                });
            });

            await Promise.all(promises);

            setMessage({ type: 'success', text: `Successfully submitted ${selectedSubjects.length} application(s)! They are currently pending verification.` });
            
            // Reset form
            setAdNo('');
            setStudentName('');
            setSelectedSubjects([]);
            setReason('');
            setSpecialReason('medical');
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to submit one or more applications. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSearch = async () => {
        if (!searchAdNo) return;
        setIsSearching(true);
        try {
            const apps = await dataService.getApplicationsByAdNo(searchAdNo);
            setMyApplications(apps);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleReapply = (app: StudentApplication) => {
        // Pre-fill the form with the rejected application's data
        setAdNo(app.adNo);
        setStudentName(app.studentName);
        setClassName(app.className);
        setAppType(app.type);
        setSelectedSubjects([app.subjectId]);
        if (app.reason) {
            // Extract the reason text, removing any [MEDICAL]/[OTHER] prefix
            const cleanReason = app.reason.replace(/^\[(MEDICAL|OTHER)\]\s*/, '');
            setReason(cleanReason);
            // Set specialReason based on prefix
            if (app.reason.startsWith('[MEDICAL]')) {
                setSpecialReason('medical');
            } else if (app.reason.startsWith('[OTHER]')) {
                setSpecialReason('other');
            }
        }
        setMessage({ type: 'success', text: `Reapplying for ${app.subjectName} — please modify your application and submit.` });
        setView('apply');
    };

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 md:p-8">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="bg-emerald-600 p-6 md:p-8 text-white flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight">Examination Portal</h2>
                        <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mt-1">Application & Services</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all">
                        <i className="fa-solid fa-times"></i>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-12 h-full">
                        {/* Sidebar - Instructions (Visible on Desktop) */}
                        <div className="lg:col-span-4 bg-slate-50 p-6 md:p-8 border-r border-slate-100 overflow-y-auto">
                            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2">
                                <i className="fa-solid fa-circle-info text-emerald-600"></i>
                                Instructions
                            </h3>
                            <div className="space-y-6 text-sm leading-relaxed text-slate-600">
                                <p className="font-bold text-emerald-700 text-lg">2025-26 ODD സെമസ്റ്റർ പരീക്ഷാ ഫലം</p>
                                <p>പരീക്ഷയിൽ പ്രതീക്ഷിച്ച മാർക്ക് ലഭിക്കാത്തവർക്ക് റീവാല്യൂഷൻ, മാർക്ക് കൂട്ടാൻ ഇംപ്രൂവ്മെന്റ്, വിജയം നേടാത്തവർക്ക് സപ്ലിമെന്ററി / സ്പെഷ്യൽ സപ്ലിമെന്ററി അവസരവും ഉണ്ടായിരിക്കും. ഈ സേവനങ്ങൾക്കായി താഴെ കാണുന്ന ഫോം പൂരിപ്പിക്കുക.</p>
                                
                                <div className="space-y-4 pt-4">
                                    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                        <p className="font-black text-slate-800 mb-1 text-base">1. റീവാല്യൂഷൻ</p>
                                        <p className="text-xs">ഫീസ്‍: ഒരു പേപ്പറിന് 100 രൂപ. (5 ൽ കൂടുതൽ മാർക്ക് ലഭിച്ചാൽ ഫീസ്‍ തിരികെ നൽകുന്നതാണ്).</p>
                                        <p className="text-[10px] font-black text-red-500 mt-2 uppercase tracking-widest">അവസാന തീയതി: മാർച്ച് 18, 10 AM</p>
                                    </div>
                                    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                        <p className="font-black text-slate-800 mb-1 text-base">2. ഇംപ്രൂവ്മെന്റ്</p>
                                        <p className="text-xs">ഒരു വിഷയത്തിന് 100 രൂപ.</p>
                                        <p className="text-[10px] font-black text-red-500 mt-2 uppercase tracking-widest">അവസാന തീയതി: മാർച്ച് 27, 10 PM</p>
                                    </div>
                                    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                        <p className="font-black text-slate-800 mb-1 text-base">3. എക്സ്റ്റേണൽ സപ്ലിമെന്ററി</p>
                                        <p className="text-xs">ഒരു വിഷയത്തിന് 300 രൂപ.</p>
                                        <p className="text-[10px] font-black text-red-500 mt-2 uppercase tracking-widest">അവസാന തീയതി: മാർച്ച് 27, 10 PM</p>
                                    </div>
                                    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                        <p className="font-black text-slate-800 mb-1 text-base">4. ഇൻ്റേണൽ സപ്ലിമെന്ററി</p>
                                        <p className="text-xs">ഒരു വിഷയത്തിന് 50 രൂപ.</p>
                                        <p className="text-[10px] font-black text-red-500 mt-2 uppercase tracking-widest">അവസാന തീയതി: മാർച്ച് 27, 10 PM</p>
                                    </div>
                                    <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                        <p className="font-black text-slate-800 mb-1 text-base">5. സ്പെഷ്യൽ സപ്ലിമെന്ററി</p>
                                        <p className="text-xs">ഒരു വിഷയത്തിന് 150 രൂപ. ഹാജരില്ലാത്തവർക്കും മറ്റും പ്രത്യേക അനുമതിയോട് കൂടി അപേക്ഷിക്കാം.</p>
                                        <p className="text-[10px] font-black text-red-500 mt-2 uppercase tracking-widest">അവസാന തീയതി: മാർച്ച് 27</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="lg:col-span-8 p-6 md:p-10 flex flex-col">
                            {/* Tabs */}
                            <div className="flex bg-slate-100 p-1 rounded-2xl mb-8">
                                <button 
                                    onClick={() => setView('apply')}
                                    className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${view === 'apply' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    New Application
                                </button>
                                <button 
                                    onClick={() => setView('status')}
                                    className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${view === 'status' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Check Status
                                </button>
                            </div>

                            {message && (
                                <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                    <i className={`fa-solid ${message.type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
                                    <p className="text-sm font-bold">{message.text}</p>
                                </div>
                            )}

                            {view === 'apply' ? (
                                <form onSubmit={handleApply} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Admission Number</label>
                                                {isAutoFilling && <div className="w-3 h-3 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>}
                                            </div>
                                            <input 
                                                type="text" required value={adNo} onChange={e => setAdNo(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold transition-all"
                                                placeholder="e.g. 2023001"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Student Name</label>
                                            <input 
                                                type="text" required value={studentName} onChange={e => setStudentName(e.target.value)}
                                                className={`w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold transition-all ${isAutoFilling ? 'bg-slate-50 opacity-70' : ''}`}
                                                placeholder="Full Name"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Class</label>
                                            <select 
                                                value={className} onChange={e => setClassName(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold transition-all"
                                            >
                                                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Select Subject(s)</label>
                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{selectedSubjects.length} subjects selected</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1">
                                            {subjects.map(s => (
                                                <button
                                                    key={s.id} type="button"
                                                    onClick={() => toggleSubject(s.id)}
                                                    className={`px-4 py-3 rounded-xl border text-left flex items-center justify-between transition-all ${selectedSubjects.includes(s.id) ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                                                >
                                                    <span className={`text-xs font-bold ${selectedSubjects.includes(s.id) ? 'text-emerald-900' : 'text-slate-600'}`}>{s.name}</span>
                                                    {selectedSubjects.includes(s.id) && <i className="fa-solid fa-circle-check text-emerald-500"></i>}
                                                </button>
                                            ))}
                                            {subjects.length === 0 && (
                                                <div className="col-span-full py-6 text-center text-slate-400 font-bold text-xs italic bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                                    No subjects found for class {className}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Action Type</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {(['revaluation', 'improvement', 'external-supp', 'internal-supp', 'special-supp'] as ApplicationType[]).map(type => (
                                                <button
                                                    key={type} type="button"
                                                    onClick={() => setAppType(type)}
                                                    className={`px-4 py-3 rounded-xl border font-bold text-xs capitalize transition-all ${appType === type ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}
                                                >
                                                    {type.replace('-', ' ')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {appType === 'special-supp' && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Reason Type</label>
                                                <div className="flex gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSpecialReason('medical')}
                                                        className={`flex-1 px-4 py-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 ${specialReason === 'medical' ? 'bg-red-50 text-red-700 border-red-400 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-red-300'}`}
                                                    >
                                                        <i className="fa-solid fa-briefcase-medical"></i>
                                                        Medical
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSpecialReason('other')}
                                                        className={`flex-1 px-4 py-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-2 ${specialReason === 'other' ? 'bg-amber-50 text-amber-700 border-amber-400 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'}`}
                                                    >
                                                        <i className="fa-solid fa-circle-info"></i>
                                                        Other
                                                    </button>
                                                </div>
                                            </div>

                                            {specialReason === 'medical' && (
                                                <div className="p-4 bg-red-50 border border-red-200 rounded-xl animate-in fade-in duration-200">
                                                    <p className="text-xs font-black text-red-700 flex items-start gap-2">
                                                        <i className="fa-solid fa-triangle-exclamation mt-0.5"></i>
                                                        <span>NB: Please share your medical document with your <strong>Mentor</strong>, <strong>Class Teacher</strong>, and <strong>Vice Principal</strong> for exam approval.</span>
                                                    </p>
                                                </div>
                                            )}

                                            {specialReason === 'other' && (
                                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl animate-in fade-in duration-200">
                                                    <p className="text-xs font-black text-amber-700 flex items-start gap-2">
                                                        <i className="fa-solid fa-triangle-exclamation mt-0.5"></i>
                                                        <span>NB: Please write your reason on a white paper and share it with your <strong>Mentor</strong>, <strong>Class Teacher</strong>, and <strong>Vice Principal</strong> for exam approval.</span>
                                                    </p>
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Reason for Absence</label>
                                                <textarea 
                                                    required value={reason} onChange={e => setReason(e.target.value)}
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold transition-all h-24"
                                                    placeholder={specialReason === 'medical' ? 'Describe your medical reason...' : 'Explain the reason for absence...'}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Common Notification */}
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                                        <i className="fa-solid fa-bell text-blue-600 mt-0.5"></i>
                                        <p className="text-xs font-bold text-blue-800">
                                            Please share your payment screenshot to the number <strong className="text-blue-900 font-black">7559989590</strong>
                                        </p>
                                    </div>

                                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-center justify-between mt-auto">
                                        <div className="flex items-center gap-6">
                                            <div>
                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">Fee Per Subject</p>
                                                <p className="text-xl font-black text-emerald-900 line-through opacity-30">₹{fees[appType]}</p>
                                            </div>
                                            <div className="h-10 w-px bg-emerald-200"></div>
                                            <div>
                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">Total Fee ({selectedSubjects.length})</p>
                                                <p className="text-3xl font-black text-emerald-900">₹{fees[appType] * selectedSubjects.length}</p>
                                            </div>
                                        </div>
                                        <button 
                                            type="submit" disabled={isSubmitting || selectedSubjects.length === 0}
                                            className="px-8 py-4 bg-emerald-600 text-white rounded-xl font-black shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <i className="fa-solid fa-paper-plane"></i>}
                                            {isSubmitting ? 'Submitting...' : 'Submit Now'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-6 flex-1 flex flex-col">
                                    <div className="flex gap-3">
                                        <div className="flex-1 space-y-2">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Search by Admission Number</label>
                                            <input 
                                                type="text" value={searchAdNo} onChange={e => setSearchAdNo(e.target.value)}
                                                onKeyPress={e => e.key === 'Enter' && handleSearch()}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold transition-all"
                                                placeholder="Enter Ad No to check status"
                                            />
                                        </div>
                                        <button 
                                            onClick={handleSearch} disabled={isSearching}
                                            className="self-end h-[48px] px-6 bg-slate-900 text-white rounded-xl font-black hover:bg-slate-800 transition-all disabled:opacity-50"
                                        >
                                            {isSearching ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Search'}
                                        </button>
                                    </div>

                                    <div className="space-y-4 flex-1">
                                        {myApplications.map(app => (
                                            <div key={app.id} className="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{app.type.replace('-', ' ')}</span>
                                                            <span className="text-slate-300">•</span>
                                                            <span className="text-xs font-bold text-slate-500">{app.subjectName}</span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-bold">Applied on {new Date(app.createdAt).toLocaleDateString()}</p>
                                                        {app.adminComment && <p className="text-xs text-amber-600 font-bold mt-2 bg-amber-50 p-2 rounded-lg">Admin: {app.adminComment}</p>}
                                                    </div>
                                                    <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                        app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                                        app.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                        {app.status}
                                                    </div>
                                                </div>
                                                {app.status === 'rejected' && (
                                                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                                                        <p className="text-[10px] text-slate-400 font-bold italic">You can reapply with modifications</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReapply(app)}
                                                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm"
                                                        >
                                                            <i className="fa-solid fa-rotate-right"></i>
                                                            Reapply
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {myApplications.length === 0 && !isSearching && searchAdNo && (
                                            <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                                                <i className="fa-solid fa-ghost text-4xl text-slate-300 mb-4"></i>
                                                <p className="text-slate-500 font-bold">No applications found for this Admission Number.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApplicationPortal;
