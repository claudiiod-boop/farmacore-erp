import xml.etree.ElementTree as ET

tree = ET.parse(r'C:\Users\magno\.gemini\antigravity\scratch\farma-erp\cadastros_screens_ocr.xml')
root = tree.getroot()
ns = {'ps': 'http://schemas.microsoft.com/powershell/2004/04'}

targets = ['Clientes', 'Produtos', 'Colaboradores', 'Ofertas', 'Promoção', 'Fornecedores', 'Convênios']

for obj in root.findall('.//ps:Obj', ns):
    container = obj.find('ps:MS', ns) or obj.find('ps:Props', ns)
    if container is None:
        continue
    f = container.find("./ps:S[@N='File']", ns)
    h = container.find("./ps:S[@N='Header']", ns)
    t = container.find("./ps:S[@N='AllText']", ns)
    if f is None or h is None or t is None:
        continue
    
    fname = f.text or ''
    hdr = h.text or ''
    text = (t.text or '').replace('_x000A_', ' | ')
    
    for tg in targets:
        if f'@{tg}' in hdr:
            print(f"\n[{tg.upper()}] {fname}")
            lines = [l.strip() for l in text.split(' | ') if l.strip() and len(l.strip()) > 2]
            # filter out boilerplate
            clean_lines = [l for l in lines if not any(x in l.upper() for x in ['V1.82.24', 'MAGNOS FARMA', 'SUPORTE REMOTO', 'EMPRESA'])]
            print("  Top Lines: " + " // ".join(clean_lines[:15]))
            break
