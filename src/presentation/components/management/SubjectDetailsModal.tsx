import React, { useState, useEffect } from 'react';
import { SubjectConfig, SubjectDetails, CIAComponent, CourseContentUnit, CourseOutcome } from '../../../domain/entities/types';
import { v4 as uuidv4 } from 'uuid'; // Fallback to simple random id if not found, but standard is using a library or simple Math.random. Let's use simple Math.random for standalone.

interface SubjectDetailsModalProps {
    subject: SubjectConfig;
    onClose: () => void;
    onSave: (subjectId: string, details: SubjectDetails) => Promise<void>;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const SubjectDetailsModal: React.FC<SubjectDetailsModalProps> = ({ subject, onClose, onSave }) => {
    const [details, setDetails] = useState<SubjectDetails>({
        department: '',
        stage: '',
        courseName: subject.name || '',
        courseType: '',
        courseLevel: '',
        semester: subject.activeSemester || '',
        totalHours: '',
        totalStudentLearningTime: '',
        summaryAndJustification: '',
        prerequisites: '',
        courseOutcomes: [],
        courseContent: [],
        teachingAndLearningApproach: '',
        assessment: {
            ciaComponents: [],
            semesterEndExamDetails: ''
        }
    });

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (subject.details) {
            setDetails(subject.details);
        }
    }, [subject]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            await onSave(subject.id, details);
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to save subject details');
        } finally {
            setIsSaving(false);
        }
    };

    // Handlers for dynamic tables
    const addCourseOutcome = () => {
        setDetails(prev => ({
            ...prev,
            courseOutcomes: [...prev.courseOutcomes, { id: generateId(), description: '', learningDomains: '', psoNo: '' }]
        }));
    };
    
    const updateCourseOutcome = (id: string, field: keyof CourseOutcome, value: string) => {
        setDetails(prev => ({
            ...prev,
            courseOutcomes: prev.courseOutcomes.map(co => co.id === id ? { ...co, [field]: value } : co)
        }));
    };

    const removeCourseOutcome = (id: string) => {
        setDetails(prev => ({
            ...prev,
            courseOutcomes: prev.courseOutcomes.filter(co => co.id !== id)
        }));
    };

    const addCourseContent = () => {
        setDetails(prev => ({
            ...prev,
            courseContent: [...prev.courseContent, { id: generateId(), unit: '', description: '', hours: '', codeNumber: '' }]
        }));
    };

    const updateCourseContent = (id: string, field: keyof CourseContentUnit, value: string) => {
        setDetails(prev => ({
            ...prev,
            courseContent: prev.courseContent.map(cc => cc.id === id ? { ...cc, [field]: value } : cc)
        }));
    };

    const removeCourseContent = (id: string) => {
        setDetails(prev => ({
            ...prev,
            courseContent: prev.courseContent.filter(cc => cc.id !== id)
        }));
    };

    const addCIAComponent = (type: CIAComponent['type']) => {
        setDetails(prev => ({
            ...prev,
            assessment: {
                ...prev.assessment,
                ciaComponents: [...prev.assessment.ciaComponents, { id: generateId(), type, details: '', units: '', timePeriod: '' }]
            }
        }));
    };

    const updateCIAComponent = (id: string, field: keyof CIAComponent, value: string) => {
        setDetails(prev => ({
            ...prev,
            assessment: {
                ...prev.assessment,
                ciaComponents: prev.assessment.ciaComponents.map(cia => cia.id === id ? { ...cia, [field]: value } : cia)
            }
        }));
    };

    const removeCIAComponent = (id: string) => {
        setDetails(prev => ({
            ...prev,
            assessment: {
                ...prev.assessment,
                ciaComponents: prev.assessment.ciaComponents.filter(cia => cia.id !== id)
            }
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-hidden">
            <div className="bg-white w-full max-w-5xl rounded-2xl flex flex-col max-h-[95vh] shadow-2xl">
                <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">Subject Details (Syllabus)</h2>
                        <p className="text-slate-500 font-medium text-sm mt-1">{subject.name} - {subject.facultyName || 'Unassigned Faculty'}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-500">
                        <i className="fa-solid fa-times text-xl"></i>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-8">
                    <form id="subject-details-form" onSubmit={handleSave} className="space-y-8">
                        {/* Section 1: Basic Details */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 border-b pb-2"><i className="fa-solid fa-circle-info mr-2 text-emerald-500"></i>General Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">Course Name</span>
                                    <input type="text" value={details.courseName} onChange={e => setDetails({...details, courseName: e.target.value})} className="mt-1 w-full p-2.5 border rounded-xl bg-slate-50" />
                                </label>
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">Department</span>
                                    <input type="text" value={details.department} onChange={e => setDetails({...details, department: e.target.value})} className="mt-1 w-full p-2.5 border rounded-xl bg-slate-50" />
                                </label>
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">Stage</span>
                                    <input type="text" value={details.stage} onChange={e => setDetails({...details, stage: e.target.value})} className="mt-1 w-full p-2.5 border rounded-xl bg-slate-50" />
                                </label>
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">Type of Course</span>
                                    <input type="text" value={details.courseType} onChange={e => setDetails({...details, courseType: e.target.value})} className="mt-1 w-full p-2.5 border rounded-xl bg-slate-50" />
                                </label>
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">Course Level</span>
                                    <input type="text" value={details.courseLevel} onChange={e => setDetails({...details, courseLevel: e.target.value})} className="mt-1 w-full p-2.5 border rounded-xl bg-slate-50" />
                                </label>
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">Semester</span>
                                    <input type="text" value={details.semester} onChange={e => setDetails({...details, semester: e.target.value})} className="mt-1 w-full p-2.5 border rounded-xl bg-slate-50" />
                                </label>
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">Total Hours</span>
                                    <input type="text" value={details.totalHours} onChange={e => setDetails({...details, totalHours: e.target.value})} className="mt-1 w-full p-2.5 border rounded-xl bg-slate-50" />
                                </label>
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">Total Student Learning Time</span>
                                    <input type="text" value={details.totalStudentLearningTime} onChange={e => setDetails({...details, totalStudentLearningTime: e.target.value})} className="mt-1 w-full p-2.5 border rounded-xl bg-slate-50" />
                                </label>
                            </div>
                        </div>

                        {/* Section 2: Narrative Details */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 border-b pb-2"><i className="fa-solid fa-align-left mr-2 text-emerald-500"></i>Narrative Information</h3>
                            <label className="block">
                                <span className="text-sm font-bold text-slate-700">Course Summary and Justification</span>
                                <textarea rows={4} value={details.summaryAndJustification} onChange={e => setDetails({...details, summaryAndJustification: e.target.value})} className="mt-1 w-full p-3 border rounded-xl bg-slate-50" />
                            </label>
                            <label className="block mt-4">
                                <span className="text-sm font-bold text-slate-700">Prerequisites</span>
                                <textarea rows={2} value={details.prerequisites} onChange={e => setDetails({...details, prerequisites: e.target.value})} className="mt-1 w-full p-3 border rounded-xl bg-slate-50" />
                            </label>
                            <label className="block mt-4">
                                <span className="text-sm font-bold text-slate-700">Teaching and Learning Approach</span>
                                <textarea rows={3} value={details.teachingAndLearningApproach} onChange={e => setDetails({...details, teachingAndLearningApproach: e.target.value})} className="mt-1 w-full p-3 border rounded-xl bg-slate-50" />
                            </label>
                        </div>

                        {/* Section 3: Course Outcomes */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b pb-2">
                                <h3 className="text-lg font-bold text-slate-800"><i className="fa-solid fa-bullseye mr-2 text-emerald-500"></i>Course Outcomes</h3>
                                <button type="button" onClick={addCourseOutcome} className="text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100"><i className="fa-solid fa-plus mr-1"></i>Add Outcome</button>
                            </div>
                            {details.courseOutcomes.length === 0 && <p className="text-sm text-slate-400 italic">No outcomes added.</p>}
                            {details.courseOutcomes.map((co, index) => (
                                <div key={co.id} className="flex gap-4 items-start p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="font-bold text-slate-400 mt-2">#{index + 1}</div>
                                    <div className="flex-1 space-y-3">
                                        <input placeholder="Expected Course Outcome" value={co.description} onChange={e => updateCourseOutcome(co.id, 'description', e.target.value)} className="w-full p-2 border rounded-lg" />
                                        <div className="flex gap-4">
                                            <input placeholder="Learning Domains" value={co.learningDomains} onChange={e => updateCourseOutcome(co.id, 'learningDomains', e.target.value)} className="flex-1 p-2 border rounded-lg" />
                                            <input placeholder="PSO No" value={co.psoNo} onChange={e => updateCourseOutcome(co.id, 'psoNo', e.target.value)} className="flex-1 p-2 border rounded-lg" />
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => removeCourseOutcome(co.id)} className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg mt-1"><i className="fa-solid fa-trash"></i></button>
                                </div>
                            ))}
                        </div>

                        {/* Section 4: Course Content */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b pb-2">
                                <h3 className="text-lg font-bold text-slate-800"><i className="fa-solid fa-list mr-2 text-emerald-500"></i>Course Content</h3>
                                <button type="button" onClick={addCourseContent} className="text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100"><i className="fa-solid fa-plus mr-1"></i>Add Unit</button>
                            </div>
                            {details.courseContent.length === 0 && <p className="text-sm text-slate-400 italic">No course content added.</p>}
                            {details.courseContent.map((cc, index) => (
                                <div key={cc.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 relative group">
                                    <button type="button" onClick={() => removeCourseContent(cc.id)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-trash"></i></button>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mr-10">
                                        <label className="block md:col-span-1">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Unit</span>
                                            <input type="text" value={cc.unit} onChange={e => updateCourseContent(cc.id, 'unit', e.target.value)} className="w-full p-2 border rounded-lg mt-1" />
                                        </label>
                                        <label className="block md:col-span-3">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Course Description for month</span>
                                            <textarea rows={2} value={cc.description} onChange={e => updateCourseContent(cc.id, 'description', e.target.value)} className="w-full p-2 border rounded-lg mt-1" />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Hours</span>
                                            <input type="text" value={cc.hours} onChange={e => updateCourseContent(cc.id, 'hours', e.target.value)} className="w-full p-2 border rounded-lg mt-1" />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Code Number</span>
                                            <input type="text" value={cc.codeNumber} onChange={e => updateCourseContent(cc.id, 'codeNumber', e.target.value)} className="w-full p-2 border rounded-lg mt-1" />
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Section 5: Assessments */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-800 border-b pb-2"><i className="fa-solid fa-check-double mr-2 text-emerald-500"></i>Assessment Types</h3>
                            
                            <div>
                                <div className="flex gap-2 items-center mb-4">
                                    <h4 className="font-bold text-slate-700">Continuous Internal Assessment (CIA)</h4>
                                    <div className="flex bg-slate-100 p-1 rounded-lg ml-auto">
                                        {(['Writing', 'Individual Presentation', 'Group Presentation', 'Class Test', 'Other'] as CIAComponent['type'][]).map(type => (
                                            <button key={type} type="button" onClick={() => addCIAComponent(type)} className="text-xs px-2 py-1.5 font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded transition-all">
                                                + {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {details.assessment.ciaComponents.length === 0 && <p className="text-sm text-slate-400 italic">No CIA components added.</p>}
                                <div className="space-y-3">
                                    {details.assessment.ciaComponents.map(cia => (
                                        <div key={cia.id} className="flex gap-4 items-start p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                            <div className="w-1/4">
                                                <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded uppercase tracking-wider">{cia.type}</span>
                                            </div>
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <label className="block md:col-span-2">
                                                    <span className="text-xs font-bold text-slate-500 uppercase">Details</span>
                                                    <input type="text" value={cia.details} onChange={e => updateCIAComponent(cia.id, 'details', e.target.value)} className="w-full p-1.5 text-sm border rounded mt-1 shadow-sm" />
                                                </label>
                                                <label className="block">
                                                    <span className="text-xs font-bold text-slate-500 uppercase">Units specified</span>
                                                    <input type="text" value={cia.units} onChange={e => updateCIAComponent(cia.id, 'units', e.target.value)} className="w-full p-1.5 text-sm border rounded mt-1 shadow-sm" />
                                                </label>
                                                <label className="block">
                                                    <span className="text-xs font-bold text-slate-500 uppercase">Time Period in Semester</span>
                                                    <input type="text" value={cia.timePeriod} onChange={e => updateCIAComponent(cia.id, 'timePeriod', e.target.value)} className="w-full p-1.5 text-sm border rounded mt-1 shadow-sm" />
                                                </label>
                                            </div>
                                            <button type="button" onClick={() => removeCIAComponent(cia.id)} className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><i className="fa-solid fa-times"></i></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <label className="block">
                                    <span className="text-sm font-bold text-slate-700">Second Semester End Examination</span>
                                    <textarea rows={3} placeholder="Details about semester end examination..." value={details.assessment.semesterEndExamDetails} onChange={e => setDetails({ ...details, assessment: { ...details.assessment, semesterEndExamDetails: e.target.value }})} className="mt-1 w-full p-3 border rounded-xl bg-slate-50" />
                                </label>
                            </div>
                        </div>

                    </form>
                </div>

                <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                    <button type="submit" form="subject-details-form" disabled={isSaving} className="px-8 py-2.5 font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                        {isSaving ? <><i className="fa-solid fa-circle-notch fa-spin"></i> Saving...</> : <><i className="fa-solid fa-save"></i> Save Details</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
