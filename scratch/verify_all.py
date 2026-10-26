import re, glob, os, sys

def check_html():
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    required_ids = [
        'geometricSummaryContainer',
        'structuralTableBody',
        'concreteVolumesContainer',
        'statWeightTotal',
        'statCuantiaPill',
        'statConcreteTotal',
        'statCementTotal',
        'paramProjectName',
        'paramTramoName',
        'paramIngenieroName',
        'statSidebarLongitud',
        'statSidebarConc21',
        'statSidebarConcCicl',
        'statSidebarSacos'
    ]
    print("Checking HTML IDs:")
    for rid in required_ids:
        if f'id="{rid}"' in html:
            print(f"  [OK] {rid} exists")
        else:
            print(f"  [MISSING] {rid}")
            
    forbidden_ids = ['placaHuellaGraphicContainer']
    for fid in forbidden_ids:
        if f'id="{fid}"' in html:
            print(f"  [ERROR] FORBIDDEN {fid} STILL IN HTML!")
        else:
            print(f"  [OK] {fid} successfully removed from HTML")

def check_js_files():
    print("\nChecking JS Files for syntax brackets:")
    for js_path in glob.glob('js/*.js'):
        with open(js_path, 'r', encoding='utf-8') as f:
            code = f.read()
        curly = code.count('{') - code.count('}')
        paren = code.count('(') - code.count(')')
        bracket = code.count('[') - code.count(']')
        print(f"  {os.path.basename(js_path)}: curly delta={curly}, paren delta={paren}, bracket delta={bracket}")
        if curly != 0 or paren != 0 or bracket != 0:
            print(f"    [WARN] Unbalanced brackets in {js_path}!")
        else:
            print(f"    [OK] Perfectly balanced syntax")

check_html()
check_js_files()
