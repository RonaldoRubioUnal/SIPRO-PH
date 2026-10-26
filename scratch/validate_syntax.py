import re

def check_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check simple bracket balances
    brackets = {'(': ')', '{': '}', '[': ']'}
    stack = []
    in_string = False
    str_char = ''
    in_regex = False
    in_comment = False
    in_block_comment = False
    
    lines = content.split('\n')
    for line_no, line in enumerate(lines, 1):
        i = 0
        while i < len(line):
            ch = line[i]
            if in_comment:
                break
            if in_block_comment:
                if ch == '*' and i + 1 < len(line) and line[i+1] == '/':
                    in_block_comment = False
                    i += 1
                i += 1
                continue
            if in_string:
                if ch == '\\':
                    i += 2
                    continue
                if ch == str_char:
                    in_string = False
                i += 1
                continue
            
            # Not in string or comment
            if ch == '/' and i + 1 < len(line):
                if line[i+1] == '/':
                    break # rest of line is comment
                elif line[i+1] == '*':
                    in_block_comment = True
                    i += 2
                    continue
            
            if ch in ['"', "'", '`']:
                in_string = True
                str_char = ch
                i += 1
                continue
            
            if ch in brackets.keys():
                stack.append((ch, line_no))
            elif ch in brackets.values():
                if not stack:
                    return f"{filename}: Line {line_no}: Unexpected closing bracket '{ch}'"
                top, top_line = stack.pop()
                if brackets[top] != ch:
                    return f"{filename}: Line {line_no}: Mismatched bracket '{ch}' closing '{top}' from line {top_line}"
            i += 1

    if stack:
        top, top_line = stack[-1]
        return f"{filename}: Unclosed '{top}' from line {top_line}"
    return f"{filename}: OK (Balanced brackets and syntax)"

for f in ['js/data.js', 'js/folderReader.js', 'js/spatial.js', 'js/app.js', 'js/reports.js', 'index.html']:
    print(check_file(f))
