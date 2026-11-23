import { Database } from '../../database/connection';
import type { CmedProductType, CmedListType } from './cmed.types';

export class CmedParserService {
  constructor(private db: Database) {}

  /**
   * Converte strings numéricas em formato brasileiro ("1.234,56" ou "22,50") para number de ponto flutuante.
   */
  static parseDecimalBr(val: string | undefined | null): number {
    if (!val) return 0.0;
    const cleaned = val.trim();
    if (cleaned === '' || cleaned.toUpperCase() === 'N/A' || cleaned === '-') return 0.0;

    // Remove pontos de milhar e substitui vírgula decimal por ponto
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0.0 : Math.round(parsed * 100) / 100;
  }

  /**
   * Normaliza o tipo de produto CMED (GENÉRICO, SIMILAR, NOVO, BIOLÓGICO, etc.)
   */
  static normalizeProductType(val: string | undefined): CmedProductType {
    if (!val) return 'NOVO';
    const upper = val.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (upper.includes('GENERICO')) return 'GENERICO';
    if (upper.includes('SIMILAR')) return 'SIMILAR';
    if (upper.includes('BIOLOGICO')) return 'BIOLOGICO';
    if (upper.includes('ESPECIFICO')) return 'ESPECIFICO';
    return 'NOVO';
  }

  /**
   * Normaliza a lista tributária de PIS/COFINS (POSITIVA, NEGATIVA, NEUTRA)
   */
  static normalizeListType(val: string | undefined): CmedListType {
    if (!val) return 'NEUTRA';
    const upper = val.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (upper.includes('POSITIVA')) return 'POSITIVA';
    if (upper.includes('NEGATIVA')) return 'NEGATIVA';
    return 'NEUTRA';
  }

  /**
   * Processa e importa a base oficial da CMED a partir de arquivo CSV delimitado.
   */
  importCmedFile(
    fileContent: string,
    versionCode: string
  ): { versionId: number; versionCode: string; importedCount: number } {
    const lines = fileContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) {
      throw new Error('Arquivo CMED inválido ou sem linhas de dados.');
    }

    // Identifica delimitador (; ou ,)
    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : ',';
    const headers = headerLine.split(delimiter).map((h) =>
      h.trim().toUpperCase().replace(/["']/g, '')
    );

    const headerMap = new Map<string, number>();
    headers.forEach((h, idx) => headerMap.set(h, idx));

    // Desativa versões anteriores e registra a nova versão
    this.db.prepare('UPDATE cmed_table_versions SET is_active = 0').run();

    // Se já existir versão com o mesmo versionCode, deleta para reimportação limpa
    const existing = this.db
      .prepare<any>('SELECT id FROM cmed_table_versions WHERE version_code = ?')
      .get(versionCode);

    if (existing) {
      this.db.prepare('DELETE FROM cmed_table_versions WHERE id = ?').run(existing.id);
    }

    const today = new Date().toISOString().substring(0, 10);
    const versionRes = this.db
      .prepare(
        `INSERT INTO cmed_table_versions (version_code, release_date, total_records, is_active)
         VALUES (?, ?, 0, 1)`
      )
      .run(versionCode, today);

    const versionId = Number(versionRes.lastInsertRowid);

    // Helpers para localizar colunas tolerando variações de nomes oficiais da ANVISA
    const getCol = (cols: string[], row: string[]): string => {
      for (const c of cols) {
        const idx = headerMap.get(c);
        if (idx !== undefined && row[idx] !== undefined) {
          return row[idx].replace(/["']/g, '').trim();
        }
      }
      return '';
    };

    const insertStmt = this.db.prepare(
      `INSERT INTO cmed_products (
        version_id, ean, ms_registration, product_name, presentation, substance_name,
        laboratory_name, therapeutic_class, product_type, list_type, has_st_icms,
        pf_0, pf_12, pf_17, pf_17_5, pf_18, pf_19, pf_20, pf_21, pf_22,
        pmc_0, pmc_12, pmc_17, pmc_17_5, pmc_18, pmc_19, pmc_20, pmc_21, pmc_22
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`
    );

    let importedCount = 0;

    // Transação em lote de alta performance
    this.db.transaction(() => {
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(delimiter);
        const ean = getCol(['EAN_1', 'EAN 1', 'CODIGO_BARRAS', 'EAN', 'BARCODE'], row);
        const ms = getCol(['REGISTRO', 'REGISTRO_MS', 'CODIGO_MS', 'MS'], row);
        const prodName = getCol(['PRODUTO', 'NOME_PRODUTO', 'DESCRICAO'], row);
        const substance = getCol(['SUBSTANCIA', 'PRINCIPIO_ATIVO', 'SUBSTÂNCIA'], row);
        const lab = getCol(['LABORATORIO', 'LABORATÓRIO', 'FABRICANTE'], row);

        if (!ean || !prodName) {
          continue;
        }

        const presentation = getCol(['APRESENTACAO', 'APRESENTAÇÃO'], row);
        const therapeutic = getCol(['CLASSE_TERAPEUTICA', 'CLASSE TERAPÊUTICA'], row);
        const rawType = getCol(['TIPO_PRODUTO', 'TIPO_DE_PRODUTO', 'TIPO'], row);
        const rawList = getCol(['LISTA_CONCESSAO_CREDITO_TRIBUTARIO', 'LISTA', 'TIPO_LISTA'], row);

        const productType = CmedParserService.normalizeProductType(rawType);
        const listType = CmedParserService.normalizeListType(rawList);

        // Preços Fábrica (PF)
        const pf0 = CmedParserService.parseDecimalBr(getCol(['PF_0', 'PF 0%'], row));
        const pf12 = CmedParserService.parseDecimalBr(getCol(['PF_12', 'PF 12%'], row));
        const pf17 = CmedParserService.parseDecimalBr(getCol(['PF_17', 'PF 17%'], row));
        const pf175 = CmedParserService.parseDecimalBr(getCol(['PF_17_5', 'PF 17,5%'], row));
        const pf18 = CmedParserService.parseDecimalBr(getCol(['PF_18', 'PF 18%'], row));
        const pf19 = CmedParserService.parseDecimalBr(getCol(['PF_19', 'PF 19%'], row));
        const pf20 = CmedParserService.parseDecimalBr(getCol(['PF_20', 'PF 20%'], row));
        const pf21 = CmedParserService.parseDecimalBr(getCol(['PF_21', 'PF 21%'], row));
        const pf22 = CmedParserService.parseDecimalBr(getCol(['PF_22', 'PF 22%'], row));

        // Preços Máximos ao Consumidor (PMC)
        const pmc0 = CmedParserService.parseDecimalBr(getCol(['PMC_0', 'PMC 0%'], row));
        const pmc12 = CmedParserService.parseDecimalBr(getCol(['PMC_12', 'PMC 12%'], row));
        const pmc17 = CmedParserService.parseDecimalBr(getCol(['PMC_17', 'PMC 17%'], row));
        const pmc175 = CmedParserService.parseDecimalBr(getCol(['PMC_17_5', 'PMC 17,5%'], row));
        const pmc18 = CmedParserService.parseDecimalBr(getCol(['PMC_18', 'PMC 18%'], row));
        const pmc19 = CmedParserService.parseDecimalBr(getCol(['PMC_19', 'PMC 19%'], row));
        const pmc20 = CmedParserService.parseDecimalBr(getCol(['PMC_20', 'PMC 20%'], row));
        const pmc21 = CmedParserService.parseDecimalBr(getCol(['PMC_21', 'PMC 21%'], row));
        const pmc22 = CmedParserService.parseDecimalBr(getCol(['PMC_22', 'PMC 22%'], row));

        insertStmt.run(
          versionId,
          ean,
          ms,
          prodName,
          presentation || null,
          substance || prodName,
          lab || 'LABORATÓRIO',
          therapeutic || null,
          productType,
          listType,
          1,
          pf0,
          pf12,
          pf17,
          pf175,
          pf18,
          pf19,
          pf20,
          pf21,
          pf22,
          pmc0,
          pmc12,
          pmc17,
          pmc175,
          pmc18,
          pmc19,
          pmc20,
          pmc21,
          pmc22
        );

        importedCount++;
      }

      this.db
        .prepare('UPDATE cmed_table_versions SET total_records = ? WHERE id = ?')
        .run(importedCount, versionId);
    })();

    return {
      versionId,
      versionCode,
      importedCount,
    };
  }
}
