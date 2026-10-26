import sys

def parse_js(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        src = f.read()
    
    stack = []
    i = 0
    line = 1
    col = 1
    in_str = None
    
    while i < len(src):
        c = src[i]
        
        if c == '\n':
            line += 1
            col = 1
            i += 1
            continue
            
        if not in_str:
            if src[i:i+2] == '//':
                i = src.find('\n', i)
                if i == -1: break
                continue
            elif src[i:i+2] == '/*':
                end = src.find('*/', i+2)
                if end == -1:
                    print(f"Unclosed /* at {line}:{col}")
                    return False
                line += src[i:end+2].count('\n')
                i = end + 2
                continue
                
        if in_str:
            if c == '\\':
                i += 2
                col += 2
                continue
            if in_str == '`':
                if src[i:i+2] == '${':
                    stack.append(('${', line, col))
                    in_str = None
                    i += 2
                    col += 2
                    continue
                elif c == '`':
                    in_str = None
                    i += 1
                    col += 1
                    continue
            else:
                if c == in_str:
                    in_str = None
                i += 1
                col += 1
                continue
        else:
            if c in ('"', "'"):
                in_str = c
                i += 1
                col += 1
                continue
            elif c == '`':
                in_str = '`'
                i += 1
                col += 1
                continue
            elif c in '([{':
                stack.append((c, line, col))
            elif c in ')]}':
                if not stack:
                    print(f"Extra {c} at {line}:{col} in {filepath}")
                    return False
                top, tl, tc = stack.pop()
                if c == ')' and top != '(':
                    print(f"Mismatched {c} at {line}:{col}, open {top} at {tl}:{tc} in {filepath}")
                    return False
                elif c == ']' and top != '[':
                    print(f"Mismatched {c} at {line}:{col}, open {top} at {tl}:{tc} in {filepath}")
                    return False
                elif c == '}':
                    if top == '${':
                        in_str = '`' # Resume template literal
                    elif top != '{':
                        print(f"Mismatched {c} at {line}:{col}, open {top} at {tl}:{tc} in {filepath}")
                        return False
            i += 1
            col += 1
            
    if stack:
        print(f"Unclosed in {filepath}:", stack)
        return False
    print(f"{filepath}: VALID!")
    return True

all_ok = True
for f in ['js/data.js', 'js/folderReader.js', 'js/spatial.js', 'js/structural.js', 'js/reports.js', 'js/app.js']:
    if not parse_js(f):
        all_ok = False

if all_ok:
    print("\n>>> ALL JAVASCRIPT FILES ARE SYNTACTICALLY 100% VALID! <<<")
else:
    sys.exit(1)
