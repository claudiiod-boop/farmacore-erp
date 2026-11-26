const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Iniciando extração do catálogo de produtos do InovaFarma...');

const query = `
SET NOCOUNT ON;
SELECT 
    p.CodigoProduto,
    RTRIM(LTRIM(p.CodigoBarra)) AS CodigoBarra,
    REPLACE(REPLACE(RTRIM(LTRIM(p.NomeProduto)), CHAR(13), ''), CHAR(10), '') AS NomeProduto,
    ISNULL(RTRIM(LTRIM(p.RegistroMS)), 'ISENTO') AS RegistroMS,
    ISNULL(RTRIM(LTRIM(pg.NomeGrupo)), 'GERAL') AS Grupo,
    ISNULL(p.TipoLista, 0) AS TipoLista,
    pe.PrecoVenda,
    pe.PrecoCusto,
    pe.PMC
FROM dbo.Produto p
INNER JOIN dbo.Produto_Estoque pe ON p.CodigoProduto = pe.CodigoProduto
LEFT JOIN dbo.Produto_Grupo pg ON p.CodigoGrupo = pg.CodigoGrupo
WHERE ISNULL(p.Eliminado, 0) = 0
  AND p.CodigoBarra IS NOT NULL
  AND LEN(RTRIM(LTRIM(p.CodigoBarra))) >= 7
  AND pe.PrecoVenda > 0
ORDER BY pe.PrecoVenda DESC;
`;

const cmd = `sqlcmd -U "sa" -P "inovafarmaI" -S "srv-magnosfarma\\sqldev2016,1433" -d "inovafarma_trevofarmafilial" -W -s "|" -Q "${query.replace(/\r?\n/g, ' ')}"`;

exec(cmd, { maxBuffer: 100 * 1024 * 1024 }, (err, stdout, stderr) => {
  if (err) {
    console.error('Erro ao executar sqlcmd:', err.message);
    process.exit(1);
  }

  const lines = stdout.split(/\r?\n/);
  console.log(`Total de linhas brutas recebidas: ${lines.length}`);

  const productsMap = new Map();
  let count = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('CodigoProduto') || line.startsWith('---')) continue;

    const parts = line.split('|');
    if (parts.length < 8) continue;

    const [codProd, codBarra, nome, ms, grupo, precoVendaStr, precoCustoStr, pmcStr] = parts.map(p => p.trim());
    if (!codBarra || !nome) continue;

    // Apenas código de barras alfanumérico limpo
    const cleanEan = codBarra.replace(/[^0-9a-zA-Z]/g, '');
    if (cleanEan.length < 7 || cleanEan.length > 14) continue;

    const price = parseFloat(precoVendaStr) || 0;
    const pf = parseFloat(precoCustoStr) || Number((price * 0.65).toFixed(2));
    let pmc = parseFloat(pmcStr) || 0;
    if (pmc <= 0 || pmc < price) {
      pmc = Number((price * 1.35).toFixed(2));
    }

    // Identificação de tarja e controle sanitário
    let stripe = 'SEM_TARJA';
    let controlType = 'Geral';

    const upperNome = nome.toUpperCase();
    const upperGrupo = grupo.toUpperCase();

    if (upperNome.includes('PRETA') || upperGrupo.includes('CONTROLADO') || upperNome.includes('CLONAZEPAM') || upperNome.includes('DIAZEPAM')) {
      stripe = 'PRETA';
      controlType = 'Controlado Portaria 344/98 (Lista B1)';
    } else if (upperNome.includes('AMOXICILINA') || upperNome.includes('AZITROMICINA') || upperNome.includes('CEFALEXINA') || upperNome.includes('CIPROFLOXACINO')) {
      stripe = 'VERMELHA';
      controlType = 'Antimicrobiano (RDC 20/2011)';
    } else if (upperGrupo.includes('MEDICAMENTO') || upperGrupo.includes('GENERICO') || upperGrupo.includes('SIMILAR') || upperGrupo.includes('ETICO')) {
      stripe = 'VERMELHA';
      controlType = 'Medicamento';
    }

    // Se já existe, mantém o de maior preço ou mais completo
    if (!productsMap.has(cleanEan)) {
      productsMap.set(cleanEan, {
        ean: cleanEan,
        name: nome,
        active_ingredient: nome,
        ms_registration: ms || 'ISENTO',
        stripe,
        control_type: controlType,
        pmc,
        pf,
        price,
        is_active: 1
      });
      count++;
    }
  }

  const productsList = Array.from(productsMap.values());
  console.log(`Produtos únicos e validados com EAN: ${productsList.length}`);

  const outputDir = path.join(__dirname, '..', 'src', 'database', 'seeds');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'magnos_farma_catalog_seed.json');
  fs.writeFileSync(outputPath, JSON.stringify(productsList, null, 2), 'utf8');

  console.log(`Sucesso! Arquivo gerado em: ${outputPath}`);
});
