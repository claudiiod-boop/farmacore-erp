import xml.etree.ElementTree as ET
import re

tree = ET.parse(r'C:\Users\magno\.gemini\antigravity\scratch\farma-erp\manutencao_screens_ocr.xml')
root = tree.getroot()
ns = {'ps': 'http://schemas.microsoft.com/powershell/2004/04'}

sections = set()
for obj in root.findall('.//ps:Obj', ns):
    container = obj.find('ps:MS', ns) or obj.find('ps:Props', ns)
    if container is None:
        continue
    t = container.find("./ps:S[@N='AllText']", ns)
    if t is None or not t.text:
        continue
    lines = [l.strip() for l in t.text.replace('_x000A_', '\n').split('\n') if l.strip()]
    for l in lines:
        if re.match(r'^\d+\.\s+[A-ZÀ-Ú\s]+', l) or 'PARAMETRO' in l.upper() or 'CONFIGUR' in l.upper():
            sections.add(l)

print("Seções / Parâmetros encontrados em Manutenção:")
for s in sorted(sections):
    print(" -", s)
