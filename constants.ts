
import { SubjectConfig, StudentRecord } from './types';

export const SUBJECTS: SubjectConfig[] = [
  { id: 'fiqh', name: 'Fiqh', arabicName: 'الفقه الإسلامي', maxTA: 35, maxCE: 15, passingTotal: 20 },
  { id: 'hadees', name: 'Hadees', arabicName: 'الحديث', maxTA: 35, maxCE: 15, passingTotal: 20 },
  { id: 'nahw', name: 'Nahw', arabicName: 'النحو الواضح', maxTA: 70, maxCE: 30, passingTotal: 40 },
  { id: 'sarf', name: 'Sarf', arabicName: 'الصرف', maxTA: 70, maxCE: 30, passingTotal: 40 },
  { id: 'arabic_aqeeda', name: 'Arabic & Aqeeda', arabicName: 'العربية والعقيدة', maxTA: 70, maxCE: 30, passingTotal: 40 },
  { id: 'maths', name: 'Mathematics', maxTA: 70, maxCE: 30, passingTotal: 35 },
  { id: 'social', name: 'Social Science', maxTA: 70, maxCE: 30, passingTotal: 35 },
  { id: 'soft_skills', name: 'Soft & Life Skill', maxTA: 70, maxCE: 30, passingTotal: 35 },
  { id: 'science', name: 'Basic Sciences', maxTA: 70, maxCE: 30, passingTotal: 35 },
  { id: 'urdu_hindi', name: 'Urdu & Hindi', maxTA: 70, maxCE: 30, passingTotal: 35 },
  { id: 'english', name: 'English', maxTA: 70, maxCE: 30, passingTotal: 35 },
  { id: 'malayalam_thareekh', name: 'Malayalam & Thareekh', maxTA: 70, maxCE: 30, passingTotal: 35 },
  { id: 'it', name: 'IT', maxTA: 70, maxCE: 30, passingTotal: 35 },
  { id: 'thajweed', name: 'Doura & Thajweed', maxTA: 70, maxCE: 30, passingTotal: 35 },
];

export const CLASSES = ['Eight standard', 'Nine standard', 'Ten standard'];

export const INITIAL_STUDENTS: StudentRecord[] = [
  {
    id: '1',
    adNo: '138',
    name: 'NIHAL.N',
    className: 'Eight standard',
    semester: 'Odd',
    marks: {
      english: { ta: 34, ce: 15, total: 49, status: 'Passed' },
      malayalam_thareekh: { ta: 26.5, ce: 13, total: 39.5, status: 'Passed' }
    },
    grandTotal: 352,
    average: 27.08,
    rank: 4,
    performanceLevel: 'Failed'
  },
  {
    id: '2',
    adNo: '139',
    name: 'RAYYAN',
    className: 'Eight standard',
    semester: 'Odd',
    marks: {
      english: { ta: 35, ce: 15, total: 50, status: 'Passed' },
    },
    grandTotal: 300,
    average: 23.08,
    rank: 13,
    performanceLevel: 'Failed'
  }
];
