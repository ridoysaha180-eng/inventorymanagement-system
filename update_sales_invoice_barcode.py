import re

with open('src/pages/Sales.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Math.random with a deterministic pattern
bad_pattern = """{Array.from({length: 30}).map((_, i) => (
                               <div key={i} className="h-full bg-slate-900" style={{width: Math.random() > 0.5 ? '2px' : '4px', margin: Math.random() > 0.5 ? '0 1px' : '0 2px'}}></div>
                             ))}"""

good_pattern = """{Array.from({length: 30}).map((_, i) => (
                               <div key={i} className="h-full bg-slate-900" style={{width: (i % 2 === 0 || i % 5 === 0) ? '2px' : '4px', margin: (i % 3 === 0) ? '0 1px' : '0 2px'}}></div>
                             ))}"""

content = content.replace(bad_pattern, good_pattern)

with open('src/pages/Sales.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
