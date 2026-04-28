import React, { useState } from 'react';
import { CurriculumEntry, CurriculumStage } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { useMobile } from '../../hooks/useMobile';

interface CurriculumManagementProps {
    curriculum: CurriculumEntry[];
    activeTerm?: string;
    onRefresh: () => Promise<void>;
    isLoading: boolean;
}

export const CurriculumManagement: React.FC<CurriculumManagementProps> = ({ curriculum, activeTerm, onRefresh, isLoading }) => {
    const { isMobile } = useMobile();
    const [isOperating, setIsOperating] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingEntry, setEditingEntry] = useState<CurriculumEntry | null>(null);

    const [form, setForm] = useState<Omit<CurriculumEntry, 'id'>>({
        stage: 'Foundational',
        stream: '3-Year',
        semester: 1,
        subjectCode: '',
        subjectName: '',
        subjectType: 'general',
        learningPeriod: '',
        portions: ''
    });

    const [showAllTerms, setShowAllTerms] = useState(false);
    const [activeStage, setActiveStage] = useState<CurriculumStage>('Foundational');
    const [activeStream, setActiveStream] = useState<'3-Year' | '5-Year'>('3-Year');

    const handleAdd = () => {
        setEditingEntry(null);
        setForm({
            stage: activeStage,
            stream: activeStage === 'Foundational' ? activeStream : 'None',
            semester: 1,
            subjectCode: '',
            subjectName: '',
            subjectType: 'general',
            learningPeriod: '',
            portions: '',
            termKey: activeTerm || undefined,
            academicYear: activeTerm ? activeTerm.split('-').slice(0, -1).join('-') : undefined
        });
        setShowForm(true);
    };

    const handleEdit = (entry: CurriculumEntry) => {
        setEditingEntry(entry);
        setForm({
            stage: entry.stage,
            stream: entry.stream,
            semester: entry.semester,
            subjectCode: entry.subjectCode || '',
            subjectName: entry.subjectName,
            subjectType: entry.subjectType || 'general',
            learningPeriod: entry.learningPeriod,
            portions: entry.portions
        });
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this curriculum entry?')) return;
        try {
            setIsOperating(true);
            await dataService.deleteCurriculumEntry(id);
            await onRefresh();
        } catch (error) {
            alert('Failed to delete entry.');
        } finally {
            setIsOperating(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsOperating(true);
            if (editingEntry) {
                await dataService.updateCurriculumEntry(editingEntry.id, form);
            } else {
                await dataService.addCurriculumEntry(form);
            }
            setShowForm(false);
            await onRefresh();
        } catch (error) {
            alert('Failed to save entry.');
        } finally {
            setIsOperating(false);
        }
    };

    // Term-aware filtering: show entries matching current term OR legacy entries without a termKey
    const termFilteredCurriculum = React.useMemo(() => {
        if (showAllTerms || !activeTerm) return curriculum;
        return curriculum.filter(c => !c.termKey || c.termKey === activeTerm);
    }, [curriculum, activeTerm, showAllTerms]);

    const filteredCurriculum = termFilteredCurriculum
        .filter(c => c.stage === activeStage && (activeStage !== 'Foundational' || c.stream === activeStream))
        .sort((a, b) => a.semester - b.semester || a.subjectName.localeCompare(b.subjectName));

    // Group by semester
    const groupedBySemester = filteredCurriculum.reduce((acc, entry) => {
        if (!acc[entry.semester]) acc[entry.semester] = [];
        acc[entry.semester].push(entry);
        return acc;
    }, {} as Record<number, CurriculumEntry[]>);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-slate-900">Curriculum &amp; Syllabus</h2>
                    {activeTerm && (
                        <div className="flex items-center gap-2">
                            <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                                showAllTerms 
                                    ? 'bg-slate-100 text-slate-500 border-slate-200' 
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                                {showAllTerms ? 'All Terms' : activeTerm}
                            </span>
                            <button
                                onClick={() => setShowAllTerms(p => !p)}
                                title={showAllTerms ? 'Filter by active term' : 'Show all terms'}
                                className="text-xs text-slate-400 hover:text-slate-600 underline"
                            >
                                {showAllTerms ? 'Filter by term' : 'Show all'}
                            </button>
                        </div>
                    )}
                </div>
                <button
                    onClick={handleAdd}
                    disabled={isOperating}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                    <i className="fa-solid fa-plus"></i>
                    Add Entry
                </button>
            </div>

            {/* Stage Tabs */}
            <div className="flex gap-4 border-b border-slate-200">
                <button
                    onClick={() => setActiveStage('Foundational')}
                    className={`pb-2 px-4 font-bold border-b-2 transition-colors ${activeStage === 'Foundational' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Foundational
                </button>
                <button
                    onClick={() => setActiveStage('Undergraduate')}
                    className={`pb-2 px-4 font-bold border-b-2 transition-colors ${activeStage === 'Undergraduate' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Undergraduate
                </button>
                <button
                    onClick={() => setActiveStage('Post Graduate')}
                    className={`pb-2 px-4 font-bold border-b-2 transition-colors ${activeStage === 'Post Graduate' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Post Graduate
                </button>
            </div>

            {/* Stream Tabs (only for Foundational) */}
            {activeStage === 'Foundational' && (
                <div className="flex gap-4 pl-4">
                    <button
                        onClick={() => setActiveStream('3-Year')}
                        className={`py-1 px-4 text-sm font-bold rounded-full transition-colors ${activeStream === '3-Year' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        3-Year Stream
                    </button>
                    <button
                        onClick={() => setActiveStream('5-Year')}
                        className={`py-1 px-4 text-sm font-bold rounded-full transition-colors ${activeStream === '5-Year' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        5-Year Stream
                    </button>
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-center shrink-0">
                            <h3 className="font-black text-xl text-slate-800">{editingEntry ? 'Edit Entry' : 'Add New Entry'}</h3>
                            <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300">
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <form id="curriculum-form" onSubmit={handleSave} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Stage</label>
                                        <select
                                            value={form.stage}
                                            onChange={e => {
                                                const newStage = e.target.value as CurriculumStage;
                                                setForm({ 
                                                    ...form, 
                                                    stage: newStage, 
                                                    stream: newStage === 'Foundational' ? '3-Year' : 'None' 
                                                });
                                            }}
                                            className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-emerald-500 outline-none"
                                        >
                                            <option value="Foundational">Foundational</option>
                                            <option value="Undergraduate">Undergraduate</option>
                                            <option value="Post Graduate">Post Graduate</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Stream</label>
                                        <select
                                            value={form.stream}
                                            disabled={form.stage !== 'Foundational'}
                                            onChange={e => setForm({ ...form, stream: e.target.value as any })}
                                            className={`w-full p-3 border-2 rounded-xl font-bold outline-none ${form.stage !== 'Foundational' ? 'bg-slate-100 border-slate-100 text-slate-400' : 'border-slate-200 text-slate-700 focus:border-emerald-500'}`}
                                        >
                                            <option value="None">None</option>
                                            {form.stage === 'Foundational' && (
                                                <>
                                                    <option value="3-Year">3-Year Stream</option>
                                                    <option value="5-Year">5-Year Stream</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Semester (1 to 10)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            required
                                            value={form.semester}
                                            onChange={e => setForm({ ...form, semester: parseInt(e.target.value) || 1 })}
                                            className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Subject Code</label>
                                        <input
                                            type="text"
                                            value={form.subjectCode || ''}
                                            onChange={e => setForm({ ...form, subjectCode: e.target.value })}
                                            placeholder="e.g. AR101"
                                            className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Subject Type</label>
                                        <select
                                            value={form.subjectType || 'general'}
                                            onChange={e => setForm({ ...form, subjectType: e.target.value })}
                                            className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-emerald-500 outline-none"
                                        >
                                            <option value="general">General</option>
                                            <option value="elective">Elective</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Subject Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={form.subjectName}
                                            onChange={e => setForm({ ...form, subjectName: e.target.value })}
                                            className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-emerald-500 outline-none"
                                            placeholder="e.g. Advanced Mathematics"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Learning Period / Time</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.learningPeriod}
                                        onChange={e => setForm({ ...form, learningPeriod: e.target.value })}
                                        className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-emerald-500 outline-none"
                                        placeholder="e.g. 60 Hours or Jan - Jun"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Portions</label>
                                    <textarea
                                        required
                                        rows={4}
                                        value={form.portions}
                                        onChange={e => setForm({ ...form, portions: e.target.value })}
                                        className="w-full p-3 border-2 border-slate-200 rounded-xl font-medium text-slate-700 focus:border-emerald-500 outline-none resize-none"
                                        placeholder="e.g. Unit 1: Basics, Unit 2: Advanced Topics..."
                                    ></textarea>
                                </div>
                            </form>
                        </div>
                        <div className="p-6 border-t border-slate-200 bg-slate-50 shrink-0 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="flex-1 py-3 px-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="curriculum-form"
                                disabled={isOperating}
                                className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                            >
                                {isOperating ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving</> : 'Save Entry'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {Object.keys(groupedBySemester).length === 0 ? (
                <div className="text-center p-12 text-slate-400 bg-slate-50 border border-slate-200 rounded-3xl">
                    <i className="fa-solid fa-book-open text-4xl mb-3 opacity-20"></i>
                        <p className="font-medium text-lg">No curriculum data for {activeStage} {activeStage === 'Foundational' ? `(${activeStream})` : ''}.</p>
                        <p className="text-sm mt-1">Click 'Add Entry' to configure what is taught in this stage.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Reverse sort or ascending? Usually 1 to 10 */}
                    {Object.entries(groupedBySemester)
                        .sort(([sA], [sB]) => parseInt(sA) - parseInt(sB))
                        .map(([semester, entries]) => (
                        <div key={semester} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">
                                        <i className="fa-solid fa-layer-group"></i>
                                    </div>
                                    Semester {semester}
                                </h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {entries.map(entry => (
                                    <div key={entry.id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row gap-6">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {entry.subjectType && (
                                                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-widest border border-slate-200">
                                                                {entry.subjectType}
                                                            </span>
                                                        )}
                                                        {entry.subjectCode && (
                                                            <span className="text-[10px] font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                                {entry.subjectCode}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="font-bold text-slate-900 text-lg">{entry.subjectName}</h4>
                                                </div>
                                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1">
                                                    <i className="fa-regular fa-clock"></i> {entry.learningPeriod}
                                                </span>
                                            </div>
                                            <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">{entry.portions}</p>
                                        </div>
                                        <div className="flex gap-2 items-start shrink-0">
                                            <button onClick={() => handleEdit(entry)} className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center justify-center shadow-sm border border-blue-100">
                                                <i className="fa-solid fa-pen text-sm"></i>
                                            </button>
                                            <button onClick={() => handleDelete(entry.id)} className="w-10 h-10 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center shadow-sm border border-red-100">
                                                <i className="fa-solid fa-trash text-sm"></i>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CurriculumManagement;
