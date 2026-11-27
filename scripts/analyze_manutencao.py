import xml.etree.ElementTree as ET
import re
from collections import Counter

tree = ET.parse(r'C:\Users\magno\.gemini\antigravity\scratch\farma-erp\manutencao_screens_ocr.xml')
root = tree.getroot()
ns = {'ps': 'http://schemas.microsoft.com/powershell/2004/04'}

screens = []
for obj in root.findall('.//ps:Obj', ns):
    container = obj.find('ps:MS', ns) or obj.find('ps:Props', ns)
    if container is None:
        continue
    file_elem = container.find("./ps:S[@N='File']", ns)
    header_elem = container.find("./ps:S[@N='Header']", ns)
    text_elem = container.find("./ps:S[@N='AllText']", ns)
    if file_elem is not None and header_elem is not None:
        filename = file_elem.text or ''
        header = header_elem.text or ''
        text = text_elem.text if text_elem is not None else ''
        
        m = re.search(r'@[^/|]+(?:\s*/\s*[^|]+)?', header)
        if m:
            mod = m.group(0).replace('@', '').strip()
        else:
            mod = 'Geral'
        screens.append({'file': filename, 'module': mod, 'header': header, 'text': text})

counts = Counter(s['module'] for s in screens)
print(f"Total de Telas Escaneadas em MANUTENÇÃO: {len(screens)}")
for mod, cnt in counts.most_common():
    print(f" - {mod}: {cnt} telas")

print("\n--- DETALHAMENTO DE ABAS E CAMPOS POR MÓDULO ---")
by_mod = {}
for s in screens:
    by_mod.setdefault(s['module'], []).append(s)

for mod, sc_list in sorted(by_mod.items()):
    print(f"\n==================================================")
    print(f"MÓDULO: {mod} ({len(sc_list)} telas)")
    terms = []
    seen = set()
    for s in sc_list:
        raw_lines = s['text'].replace('_x000A_', '\n').split('\n')
        for line in raw_lines:
            line_str = line.strip()
            if len(line_str) > 2 and not any(ign in line_str.upper() for ign in ['V1.82.24', 'MAGNOS FARMA', 'SUPORTE REMOTO', 'EMPRESA', 'OCTOPUS', 'INFORMACOES']):
                if line_str not in seen:
                    seen.add(line_str)
                    terms.append(line_str)
    print(f"Campos / Abas / Botões: {', '.join(terms[:20])}")
