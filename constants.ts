
import { SubjectConfig, StudentRecord } from './types';

export const CLASSES = ['S1', 'S2', 'S3', 'D1', 'D2', 'D3', 'PG1', 'PG2'];

export const SUBJECTS: SubjectConfig[] = [
  { id: 'fiqh', name: 'Fiqh', arabicName: 'الفقه الإسلامي', maxTA: 35, maxCE: 15, passingTotal: 20, targetClasses: ['S1', 'S2', 'S3'], facultyName: 'Ustad Ahmad' },
  { id: 'hadees', name: 'Hadees', arabicName: 'الحديث', maxTA: 35, maxCE: 15, passingTotal: 20, targetClasses: ['D1', 'D2', 'D3'], facultyName: 'Ustad Kareem' },
  { id: 'nahw', name: 'Nahw', arabicName: 'النحو الواضح', maxTA: 70, maxCE: 30, passingTotal: 40, targetClasses: ['S1', 'S2'], facultyName: 'Ustad Omar' },
  { id: 'sarf', name: 'Sarf', arabicName: 'الصرف', maxTA: 70, maxCE: 30, passingTotal: 40, targetClasses: ['S1', 'S2'], facultyName: 'Ustad Omar' },
  { id: 'arabic_aqeeda', name: 'Arabic & Aqeeda', arabicName: 'العربية والعقيدة', maxTA: 70, maxCE: 30, passingTotal: 40, targetClasses: ['D1', 'D2', 'D3'], facultyName: 'Ustad Hassan' },
  { id: 'english_adv', name: 'English Literature', maxTA: 70, maxCE: 30, passingTotal: 35, targetClasses: ['PG1', 'PG2'], facultyName: 'Prof. Sarah' },
];

export const INITIAL_STUDENTS: StudentRecord[] = [
  {
    id: '1',
    adNo: '138',
    name: 'NIHAL.N',
    className: 'S1',
    semester: 'Odd',
    marks: {
      fiqh: { ta: 34, ce: 15, total: 49, status: 'Passed' },
      nahw: { ta: 50, ce: 25, total: 75, status: 'Passed' }
    },
    grandTotal: 124,
    average: 62,
    rank: 1,
    performanceLevel: 'Good'
  },
  {
    id: '2',
    adNo: '139',
    name: 'RAYYAN',
    className: 'D1',
    semester: 'Odd',
    marks: {
      hadees: { ta: 30, ce: 12, total: 42, status: 'Passed' },
    },
    grandTotal: 42,
    average: 21,
    rank: 2,
    performanceLevel: 'Failed'
  }
];
