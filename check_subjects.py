import json
import glob
files = glob.glob('public/*.json')
with open('subjects_out.txt', 'w', encoding='utf-8') as out:
    for f in files:
        with open(f, 'r', encoding='utf-8') as file:
            data = json.load(file)
            if 'subjects' in data:
                subjects = data['subjects']
                out.write(f'File {f}: {len(subjects)} subjects\n')
                seen = {}
                for s in subjects:
                    classes = tuple(s.get('targetClasses', []))
                    key = (s.get('name'), classes)
                    if key in seen:
                        out.write(f'  Duplicate: {s.get("name")} in {classes} (IDs: {s["id"]}, {seen[key]})\n')
                    seen[key] = s['id']
