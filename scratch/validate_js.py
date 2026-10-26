import sys

def check_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()

    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    in_str = None
    in_comment = False
    in_line_comment = False

    i = 0
    line = 1
    col = 1
    while i < len(code):
        c = code[i]
        if c == '\n':
            line += 1
            col = 1
            in_line_comment = False
            i += 1
            continue

        if in_line_comment:
            i += 1
            col += 1
            continue

        if in_comment:
            if code[i:i+2] == '*/':
                in_comment = False
                i += 2
                col += 2
                continue
            i += 1
            col += 1
            continue

        if in_str:
            if c == '\\':
                i += 2
                col += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            col += 1
            continue

        if code[i:i+2] == '//':
            in_line_comment = True
            i += 2
            col += 2
            continue

        if code[i:i+2] == '/*':
            in_comment = True
            i += 2
            col += 2
            continue

        if c in ('"', "'", '`'):
            in_str = c
            i += 1
            col += 1
            continue

        if c in '({[':
            stack.append((c, line, col))
        elif c in ')}]':
            if not stack:
                print(f'Unmatched closing {c} at line {line}:{col} in {filepath}')
                return False
            top, tl, tc = stack.pop()
            if pairs[c] != top:
                print(f'Mismatched {c} at {line}:{col}, expected matching for {top} at {tl}:{tc} in {filepath}')
                return False
        i += 1
        col += 1

    if stack:
        print(f'Unclosed brackets in {filepath}:', stack[-5:])
        return False
    print(f'{filepath} bracket balancing: OK!')
    return True

ok1 = check_file('js/spatial.js')
ok2 = check_file('js/app.js')
if not (ok1 and ok2):
    sys.exit(1)
print('ALL CHECKS PASSED!')
