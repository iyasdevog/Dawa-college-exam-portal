import React, { useState } from 'react';
import { CurriculumEntry } from '../../../domain/entities/types';
import { dataService } from '../../../infrastructure/services/dataService';
import { useMobile } from '../../hooks/useMobile';

interface CurriculumManagementProps {
    curriculum: CurriculumEntry[];
    onRefresh: () => Promise<void>;
    isLoading: boolean;
}

export const CurriculumManagement: React.FC<CurriculumManagementProps> = ({ curriculum, onRefresh, isLoading }) => {
    const { isMobile } = useMobile();
    const [isOperating, setIsOperating] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingEntry, setEditingEntry] = useState<CurriculumEntry | null>(null);

    const [form, setForm] = useState<Omit<CurriculumEntry, 'id'>>({
        stream: '3-Year',
        semester: 1,
        subjectName: '',
        learningPeriod: '',
        portions: ''
    });

    const [activeTab, setActiveTab] = useState<'3-Year' | '5-Year'>('3-Year');

    const handleAdd = () => {
        setEditingEntry(null);
        setForm({
            stream: activeTab,
            semester: 1,
            subjectName: '',
            learningPeriod: '',
            portions: ''
        });
        setShowForm(true);
    };

    const handleEdit = (entry: CurriculumEntry) => {
        setEditingEntry(entry);
        setForm({
            stream: entry.stream,
            semester: entry.semester,
            subjectName: entry.subjectName,
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

    const filteredCurriculum = curriculum
        .filter(c => c.stream === activeTab)
        .sort((a, b) => a.semester - b.semester || a.subjectName.localeCompare(b.subjectName));

    // Group by semester
    const groupedBySemester = filteredCurriculum.reduce((acc, entry) => {
        if (!acc[entry.semester]) acc[entry.semester] = [];
        acc[entry.semester].push(entry);
        return acc;
    }, {} as Record<number, CurriculumEntry[]>);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-900">Curriculum & Syllabus</h2>
                <button
                    onClick={handleAdd}
                    disabled={isOperating}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                    <i className="fa-solid fa-plus"></i>
                    Add Entry
                </button>
            </div>

            {/* Stream Tabs */}
            <div className="flex gap-4 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('3-Year')}
                    className={`pb-2 px-4 font-bold border-b-2 transition-colors ${activeTab === '3-Year' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    3-Year Stream
                </button>
                <button
                    onClick={() => setActiveTab('5-Year')}
                    className={`pb-2 px-4 font-bold border-b-2 transition-colors ${activeTab === '5-Year' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    5-Year Stream
                </button>
            </div>

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
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Stream</label>
                                        <select
                                            value={form.stream}
                                            onChange={e => setForm({ ...form, stream: e.target.value as any })}
                                            className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-700 focus:border-emerald-500 outline-none"
                                        >
                                            <option value="3-Year">3-Year Stream</option>
                                            <option value="5-Year">5-Year Stream</option>
                                        </select>
                                    </div>
                                    <div>
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
                                <div>
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
                    <p className="font-medium text-lg">No curriculum data for {activeTab}.</p>
                    <p className="text-sm mt-1">Click 'Add Entry' to configure what is taught in this stream.</p>
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
                                                <h4 className="font-bold text-slate-900 text-lg">{entry.subjectName}</h4>
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
