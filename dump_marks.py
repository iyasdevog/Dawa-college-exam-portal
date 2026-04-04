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
        
    marks = student.get('academicHistory', {}).get('2025-2026-Odd', {}).get('marks', {})
    
    with open('tmp_debug_marks.json', 'w') as outf:
        json.dump(marks, outf, indent=2)
        
    print("Marks written to tmp_debug_marks.json!")

except Exception as e:
    print(f"ERROR: {str(e)}")
