const fs = require('fs');
const path = require('path');

function getAllFiles(dir, files = []) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, files);
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      files.push(filePath);
    }
  });
  return files;
}

const allFiles = getAllFiles('./src');
let fixedCount = 0;

allFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace import { ... } from '...types' with import type { ... } from '...types'
  content = content.replace(/import\s+\{([^}]*)\}\s+from\s+(['"].*(?:domain\/entities\/types|\/types)['"])/g, (match, p1, p2) => {
    return `import type {${p1}} from ${p2}`;
  });

  // Replace import { ... } from '...interfaces/...' with import type { ... } from '...interfaces/...'
  content = content.replace(/import\s+\{([^}]*)\}\s+from\s+(['"].*domain\/interfaces\/[^'"]+['"])/g, (match, p1, p2) => {
    return `import type {${p1}} from ${p2}`;
  });

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    fixedCount++;
    console.log(`Fixed ${file}`);
  }
});

console.log(`Total files updated: ${fixedCount}`);
