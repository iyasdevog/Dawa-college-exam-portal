import json

input_file = r'c:\Users\iyas\Desktop\exam portal\antigravity\Dawa-college-exam-portal\public\FIXED_BACKUP_FOR_RESTORE.json'

try:
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Find Najin
    student = next((s for s in data.get('students', []) if 'NAJIN' in s.get('name', '').upper()), None)
    if not student:
        print("Student NAJIN not found")
        exit(1)

    print(f"Student: {student['name']}, Class: {student['currentClass']}")
    
    marks_dict = student.get('academicHistory', {}).get('2025-2026-Odd', {}).get('marks', {})
    print(f"\nMarks map for NAJIN:")
    for sid, m in marks_dict.items():
        print(f"  {sid}: {m}")
        
    print(f"\nSubjects collection check:")
    subjects = {s['id']: s for s in data.get('subjects', [])}
    for sid in marks_dict:
        sub = subjects.get(sid)
        if sub:
            print(f"- {sid} -> {sub.get('name')} | targetClasses: {sub.get('targetClasses')}")
        else:
            print(f"- {sid} -> NOT FOUND IN SUBJECTS")

except Exception as e:
    print(f"ERROR: {str(e)}")
