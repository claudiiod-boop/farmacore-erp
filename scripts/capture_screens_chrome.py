import os
import sys
import time
import shutil
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROJECT_DIR = r"C:\Users\magno\.gemini\antigravity\scratch\farma-erp"
DIST_DIR = os.path.join(PROJECT_DIR, "frontend", "dist")
SCREENSHOTS_DIR = os.path.join(PROJECT_DIR, "screenshots")
ARTIFACT_DIR = r"C:\Users\magno\.gemini\antigravity\brain\d252e0e6-9300-44e0-99e2-3446fbd84e2c"
PORT = 4173

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
os.makedirs(ARTIFACT_DIR, exist_ok=True)

class StaticHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def log_message(self, format, *args):
        # Silenciar logs para saída limpa
        pass

def run_server(httpd):
    httpd.serve_forever()

screens = [
    {
        "filename": "01_splash_screen.png",
        "title": "Splash Screen com Logo Magnos Farma & HyperFrames",
        "url": f"http://localhost:{PORT}/?mode=COUNTER&splash=true",
        "budget": 1200
    },
    {
        "filename": "02_balcao_counter.png",
        "title": "Terminal de Balcão (Atendimento Ágil F1-F12 InovaFarma)",
        "url": f"http://localhost:{PORT}/?mode=COUNTER&splash=false",
        "budget": 2000
    },
    {
        "filename": "03_frente_caixa_pdv.png",
        "title": "Frente de Caixa PDV (Operação de Caixa & TEF)",
        "url": f"http://localhost:{PORT}/?mode=POS&splash=false",
        "budget": 2000
    },
    {
        "filename": "04_magnos_farma_analytics.png",
        "title": "Dashboard Executivo Magnos Farma Analytics",
        "url": f"http://localhost:{PORT}/?mode=MAGNOS_FARMA_ANALYTICS&splash=false",
        "budget": 2500
    },
    {
        "filename": "05_sngpc_regulatorio.png",
        "title": "Controle Regulatório SNGPC & Farmácia Popular",
        "url": f"http://localhost:{PORT}/?mode=SNGPC&splash=false",
        "budget": 2000
    },
    {
        "filename": "06_financeiro_dashboard.png",
        "title": "Painel Financeiro, Contas & DRE",
        "url": f"http://localhost:{PORT}/?mode=FINANCIAL&splash=false",
        "budget": 2000
    },
    {
        "filename": "07_filiais_rede.png",
        "title": "Rede & Gestão Multi-Filiais",
        "url": f"http://localhost:{PORT}/?mode=STORES&splash=false",
        "budget": 2000
    },
    {
        "filename": "08_compras_fiscal.png",
        "title": "Entrada de Notas Fiscais & Compras XML",
        "url": f"http://localhost:{PORT}/?mode=PURCHASES&splash=false",
        "budget": 2000
    },
    {
        "filename": "09_convenios_crediario.png",
        "title": "Convênios & Gestão de Crediário",
        "url": f"http://localhost:{PORT}/?mode=CREDIT&splash=false",
        "budget": 2000
    },
    {
        "filename": "10_crm_fidelidade.png",
        "title": "CRM & Programa de Fidelidade",
        "url": f"http://localhost:{PORT}/?mode=CRM&splash=false",
        "budget": 2000
    }
]

def main():
    print(f"Iniciando servidor estático na porta {PORT} apontando para {DIST_DIR}...")
    httpd = HTTPServer(('127.0.0.1', PORT), StaticHandler)
    server_thread = threading.Thread(target=run_server, args=(httpd,), daemon=True)
    server_thread.start()
    time.sleep(1)

    print("Iniciando captura das telas com Google Chrome Headless...")
    results = []

    for item in screens:
        out_path = os.path.join(SCREENSHOTS_DIR, item["filename"])
        artifact_path = os.path.join(ARTIFACT_DIR, item["filename"])

        cmd = [
            CHROME_PATH,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            f"--window-size=1440,900",
            "--hide-scrollbars",
            f"--virtual-time-budget={item['budget']}",
            f"--screenshot={out_path}",
            item["url"]
        ]

        # Executar comando Chrome
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20)
        
        if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            size_kb = os.path.getsize(out_path) / 1024
            shutil.copy2(out_path, artifact_path)
            results.append((item["filename"], item["title"], size_kb, True))
            print(f"  [OK] {item['filename']} -> {size_kb:.1f} KB ({item['title']})")
        else:
            results.append((item["filename"], item["title"], 0, False))
            print(f"  [FALHA] {item['filename']}")

    httpd.shutdown()
    print("\nResumo das Telas Capturadas:")
    for fn, title, sz, ok in results:
        status = "GERADO" if ok else "ERRO"
        print(f" - [{status}] {fn} ({sz:.1f} KB) - {title}")

if __name__ == "__main__":
    main()
