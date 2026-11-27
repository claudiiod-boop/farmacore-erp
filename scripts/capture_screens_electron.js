const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

const outputDir = path.join(__dirname, '../screenshots');
const artifactDir = 'C:\\Users\\magno\\.gemini\\antigravity\\brain\\d252e0e6-9300-44e0-99e2-3446fbd84e2c';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const screens = [
  { name: '01_splash_screen.png', mode: 'COUNTER', splash: true, waitMs: 1400 },
  { name: '02_balcao_counter.png', mode: 'COUNTER', splash: false, waitMs: 1800 },
  { name: '03_frente_caixa_pdv.png', mode: 'POS', splash: false, waitMs: 1800 },
  { name: '04_magnos_farma_analytics.png', mode: 'MAGNOS_FARMA_ANALYTICS', splash: false, waitMs: 1800 },
  { name: '05_sngpc_regulatorio.png', mode: 'SNGPC', splash: false, waitMs: 1800 },
  { name: '06_financeiro_dashboard.png', mode: 'FINANCIAL', splash: false, waitMs: 1800 },
  { name: '07_filiais_rede.png', mode: 'STORES', splash: false, waitMs: 1800 }
];

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    backgroundColor: '#0F172A',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  const indexPath = path.join(__dirname, '../frontend/dist/index.html');

  for (const s of screens) {
    console.log(`Renderizando tela: ${s.name} (mode: ${s.mode}, splash: ${s.splash})...`);
    
    // Load page first
    await win.loadFile(indexPath);
    
    // Inject localStorage and reload so useStationMode reads it
    await win.webContents.executeJavaScript(`
      localStorage.setItem('farma_erp_station_mode', '${s.mode}');
      if (${s.splash}) {
        sessionStorage.removeItem('splash_shown');
      } else {
        sessionStorage.setItem('splash_shown', 'true');
      }
      window.location.reload();
    `);

    // Wait for page to reload and settle
    await new Promise(r => setTimeout(r, s.waitMs));

    const image = await win.webContents.capturePage();
    const buffer = image.toPNG();
    
    const projectPath = path.join(outputDir, s.name);
    fs.writeFileSync(projectPath, buffer);

    if (fs.existsSync(artifactDir)) {
      const artifactPath = path.join(artifactDir, s.name);
      fs.writeFileSync(artifactPath, buffer);
    }
    console.log(`Salvo: ${projectPath} (${buffer.length} bytes)`);
  }

  console.log('CONCLUIDO: Todas as telas foram salvas em PNG!');
  app.quit();
});
