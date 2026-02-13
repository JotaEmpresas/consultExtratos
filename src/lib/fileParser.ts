import Papa from 'papaparse';
import { Transaction } from '@/types';
import { parseOfxFile } from './ofxParser';

// Helper para normalizar strings (remover acentos e lowercase)
const normalizeString = (s: string): string => {
  if (!s) return '';
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

// Helper para converter moeda para número
const parseCurrency = (value: string): number => {
  if (typeof value !== 'string' || !value) return 0;
  // Remove R$, espaços e mantém o sinal, números, vírgulas e pontos.
  let cleanedValue = value.replace(/R\$\s*/g, '').trim();
  
  // Trata o formato brasileiro (1.000,00)
  const hasComma = cleanedValue.includes(',');
  const hasDot = cleanedValue.includes('.');
  if (hasComma && (!hasDot || cleanedValue.lastIndexOf(',') > cleanedValue.lastIndexOf('.'))) {
    cleanedValue = cleanedValue.replace(/\./g, '').replace(',', '.');
  } else {
    // Trata o formato americano (1,000.00)
    cleanedValue = cleanedValue.replace(/,/g, '');
  }
  return parseFloat(cleanedValue) || 0;
};

// Helper para normalizar datas para o formato DD/MM/AAAA
const normalizeDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const cleanDate = dateStr.split(' ')[0].replace(/-/g, '/').trim();

  if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleanDate)) {
    const [y, m, d] = cleanDate.split('/');
    return `${d}/${m}/${y}`;
  }

  if (/^\d{2}\/\d{2}\/\d{2}$/.test(cleanDate)) {
    const [d, m, y] = cleanDate.split('/');
    return `${d}/${m}/20${y}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanDate)) {
    return cleanDate;
  }

  return cleanDate;
};

// Helper para buscar valor em um objeto ignorando case e acentos na chave
const getVal = (row: any, keys: string[]): any => {
  if (!row) return undefined;
  const rowKeys = Object.keys(row);
  for (const key of keys) {
    const target = normalizeString(key);
    const foundKey = rowKeys.find(rk => normalizeString(rk) === target);
    if (foundKey) return row[foundKey];
  }
  return undefined;
};

// Helper para encontrar a linha do cabeçalho
const findHeaderLineIndex = (lines: string[], keywords: string[]): number => {
  const normalizedKeywords = keywords.map(k => normalizeString(k));
  const index = lines.findIndex(line => {
    const normalizedLine = normalizeString(line);
    return normalizedKeywords.every(nk => normalizedLine.includes(nk));
  });
  console.log(`[findHeaderLineIndex] Buscando por [${keywords.join(', ')}]. Encontrado no índice: ${index}`);
  return index;
};

// Helper para verificar se é transferência de sócio/empresa
const isNonTaxable = (
  description: string,
  document: string | undefined,
  companyCnpj: string, // cleaned: "12345678000199"
  cpfList: string[],   // cleaned: ["11122233344"]
  nameList: string[]   // normalized: ["fulano de tal"]
): boolean => {
  const normalizedDesc = normalizeString(description);
  const cleanDocument = document?.replace(/\D/g, '') || '';

  // 1. Compara números de documento (limpo vs limpo)
  if (cleanDocument) {
    if (cleanDocument === companyCnpj) return true;
    if (cpfList.includes(cleanDocument)) return true;
  }

  // 2. Para busca na descrição, removemos formatação para comparar apenas os números
  const numbersOnlyDesc = normalizedDesc.replace(/[^0-9]/g, '');
  if (companyCnpj && numbersOnlyDesc.includes(companyCnpj)) return true;
  if (cpfList.some(cpf => cpf && numbersOnlyDesc.includes(cpf))) return true;
  
  // 3. Busca por nome permanece a mesma (normalizado vs normalizado)
  if (nameList.some(name => name && normalizedDesc.includes(name))) return true;
  
  return false;
};

// --- PARSERS ESPECÍFICOS ---

const parseAmazonia = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  console.log(`[parseAmazonia] Iniciando parser para ${fileName}`);
  const lines = content.split(/\r?\n/);
  
  const headerIndex = findHeaderLineIndex(lines, ['DATA', 'DESCRICAO_HISTORICO', 'VALOR', 'DC']);
  
  if (headerIndex === -1) {
    console.error(`[parseAmazonia] Cabeçalho não encontrado em ${fileName}.`);
    return [];
  }

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  console.log(`[parseAmazonia] PapaParse encontrou ${data.length} linhas.`);

  return data
    .filter(row => {
      const dc = getVal(row, ['DC']);
      const valor = parseCurrency(getVal(row, ['VALOR']));
      return dc === 'C' && valor > 0;
    })
    .map((row, index) => {
      const description = getVal(row, ['DESCRICAO_HISTORICO']) || '';
      const documentInfo = getVal(row, ['CPF_CNPJ']) || '';

      return {
        id: `${fileName}-amazonia-${index}`,
        date: normalizeDate(getVal(row, ['DATA'])),
        description: description,
        amount: parseCurrency(getVal(row, ['VALOR'])),
        sourceFile: fileName,
        category: isNonTaxable(description, documentInfo, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

const parseInfinitPay = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  console.log(`[parseInfinitPay] Iniciando parser para ${fileName}`);
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['Date', 'Transaction Type', 'Amount']);

  if (headerIndex === -1) {
    console.error(`[parseInfinitPay] Cabeçalho não encontrado em ${fileName}.`);
    return [];
  }

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
  const data = results.data as any[];

  return data
    .filter(row => {
      const amountStr = getVal(row, ['Amount']) || '';
      return amountStr.includes('+') && parseCurrency(amountStr) > 0;
    })
    .map((row, index) => {
      const name = getVal(row, ['Name']) || '';
      const detail = getVal(row, ['Detail']) || '';
      const description = [name, detail].filter(Boolean).join(' - ');

      return {
        id: `${fileName}-infinitpay-${index}`,
        date: normalizeDate(getVal(row, ['Date'])),
        description: description,
        amount: parseCurrency(getVal(row, ['Amount'])),
        sourceFile: fileName,
        category: isNonTaxable(description, undefined, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

const parseStone = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['Movimentação', 'Tipo', 'Valor', 'Data']);
  if (headerIndex === -1) return [];

  if (normalizeString(lines[headerIndex]).includes(normalizeString('Saldo antes'))) return [];

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
  const data = results.data as any[];

  return data
    .filter(row => normalizeString((getVal(row, ['Movimentação']) || '').toString()).includes('credito') && parseCurrency(getVal(row, ['Valor'])) > 0)
    .map((row, index) => {
      const originDocument = getVal(row, ['Origem Documento'])?.toString();
      const tipo = getVal(row, ['Tipo']) || '';
      const origem = getVal(row, ['Origem']) || '';
      const description = `${tipo} - ${origem}`.trim();
      
      return {
        id: `${fileName}-stone-${index}`,
        date: normalizeDate(getVal(row, ['Data'])),
        description: description,
        amount: parseCurrency(getVal(row, ['Valor'])),
        sourceFile: fileName,
        category: isNonTaxable(description, originDocument, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

const parseStone2 = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['Movimentação', 'Tipo', 'Valor', 'Saldo antes', 'Destino Documento']);
  if (headerIndex === -1) return [];

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
  const data = results.data as any[];

  return data
    .filter(row => normalizeString((getVal(row, ['Movimentação']) || '').toString()).includes('credito') && parseCurrency(getVal(row, ['Valor'])) > 0)
    .map((row, index) => {
      const originDocument = getVal(row, ['Origem Documento'])?.toString();
      const tipo = getVal(row, ['Tipo']) || '';
      const origem = getVal(row, ['Origem']) || '';
      const description = `${tipo} - ${origem}`.trim();

      return {
        id: `${fileName}-stone2-${index}`,
        date: normalizeDate(getVal(row, ['Data'])),
        description: description,
        amount: parseCurrency(getVal(row, ['Valor'])),
        sourceFile: fileName,
        category: isNonTaxable(description, originDocument, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

const parseC6Bank = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['Data Lançamento', 'Título', 'Entrada(R$)']);
  if (headerIndex === -1) return [];

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
  
  return (results.data as any[])
    .filter(row => parseCurrency(getVal(row, ['Entrada(R$)'])) > 0)
    .map((row, index) => {
      const description = getVal(row, ['Título']) || '';
      return {
        id: `${fileName}-c6-${index}`,
        date: normalizeDate(getVal(row, ['Data Lançamento'])),
        description: description,
        amount: parseCurrency(getVal(row, ['Entrada(R$)'])),
        sourceFile: fileName,
        category: isNonTaxable(description, undefined, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

const parseBradesco = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['Data', 'Lançamento', 'Crédito (R$)']);
  if (headerIndex === -1) return [];

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });

  return (results.data as any[])
    .filter(row => parseCurrency(getVal(row, ['Crédito (R$)'])) > 0)
    .map((row, index) => {
      const description = getVal(row, ['Lançamento']) || '';
      return {
        id: `${fileName}-bradesco-${index}`,
        date: normalizeDate(getVal(row, ['Data'])),
        description: description,
        amount: parseCurrency(getVal(row, ['Crédito (R$)'])),
        sourceFile: fileName,
        category: isNonTaxable(description, undefined, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

const parseMercadoPago = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['RELEASE_DATE', 'TRANSACTION_TYPE', 'TRANSACTION_NET_AMOUNT']);
  if (headerIndex === -1) return [];

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });

  return (results.data as any[])
    .filter(row => parseCurrency(getVal(row, ['TRANSACTION_NET_AMOUNT'])) > 0)
    .map((row, index) => {
      const description = getVal(row, ['TRANSACTION_TYPE']) || '';
      return {
        id: `${fileName}-mp-${index}`,
        date: normalizeDate(getVal(row, ['RELEASE_DATE'])),
        description: description,
        amount: parseCurrency(getVal(row, ['TRANSACTION_NET_AMOUNT'])),
        sourceFile: fileName,
        category: isNonTaxable(description, undefined, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

const parseNubankCsv = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  const results = Papa.parse(content, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  
  if (!getVal(data[0], ['Identificador']) && !getVal(data[0], ['Descrição'])) return [];

  return data
    .filter(row => parseCurrency(getVal(row, ['Valor'])) > 0)
    .map((row, index) => {
      const description = getVal(row, ['Descrição']) || '';
      return {
        id: getVal(row, ['Identificador']) || `${fileName}-nubank-${index}`,
        date: normalizeDate(getVal(row, ['Data'])),
        description: description,
        amount: parseCurrency(getVal(row, ['Valor'])),
        sourceFile: fileName,
        category: isNonTaxable(description, undefined, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

const parseInter = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  const results = Papa.parse(content, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  
  if (!getVal(data[0], ['Tipo Transação'])) return [];

  return data
    .filter(row => normalizeString(getVal(row, ['Tipo Transação']) || '').includes('credito'))
    .map((row, index) => {
      const description = getVal(row, ['Transação']) || '';
      return {
        id: `${fileName}-inter-${index}`,
        date: normalizeDate(getVal(row, ['Data'])),
        description: description,
        amount: parseCurrency(getVal(row, ['Valor'])),
        sourceFile: fileName,
        category: isNonTaxable(description, undefined, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

const parseItau = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  const results = Papa.parse(content, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  
  if (!getVal(data[0], ['Lançamento']) || !getVal(data[0], ['Valor (R$)'])) return [];

  return data
    .filter(row => parseCurrency(getVal(row, ['Valor (R$)'])) > 0)
    .map((row, index) => {
      const description = getVal(row, ['Lançamento']) || '';
      return {
        id: `${fileName}-itau-${index}`,
        date: normalizeDate(getVal(row, ['Data'])),
        description: description,
        amount: parseCurrency(getVal(row, ['Valor (R$)'])),
        sourceFile: fileName,
        category: isNonTaxable(description, undefined, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

const parseItau2 = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['Data', 'Lançamento', 'Valor (R$)', 'Saldo (R$)']);
  if (headerIndex === -1) return [];

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true, delimiter: ';' });
  
  return (results.data as any[])
    .filter(row => parseCurrency(getVal(row, ['Valor (R$)'])) > 0 && !normalizeString(getVal(row, ['Lançamento'])).includes('saldo total'))
    .map((row, index) => {
      const description = getVal(row, ['Lançamento']) || '';
      return {
        id: `${fileName}-itau2-${index}`,
        date: normalizeDate(getVal(row, ['Data'])),
        description: description,
        amount: parseCurrency(getVal(row, ['Valor (R$)'])),
        sourceFile: fileName,
        category: isNonTaxable(description, undefined, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

const parseCora = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  const results = Papa.parse(content, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  
  if (!getVal(data[0], ['Histórico']) || !getVal(data[0], ['Valor (R$)'])) return [];

  return data
    .filter(row => normalizeString(getVal(row, ['Tipo']) || '').includes('credito'))
    .map((row, index) => {
      const description = getVal(row, ['Histórico']) || '';
      return {
        id: `${fileName}-cora-${index}`,
        date: normalizeDate(getVal(row, ['Data'])),
        description: description,
        amount: parseCurrency(getVal(row, ['Valor (R$)'])),
        sourceFile: fileName,
        category: isNonTaxable(description, undefined, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

const parseBB2 = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['Data', 'Lançamento', 'Valor']);
  if (headerIndex === -1) return [];

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
  const data = results.data as any[];

  return data
    .map((row, index) => {
      const lancamento = getVal(row, ['Lançamento']);
      const valorStr = getVal(row, ['Valor']);
      if (!lancamento || !valorStr || parseCurrency(valorStr) <= 0) return null;

      const lowerLancamento = normalizeString(lancamento);
      if (['saldo do dia', 's a l d o', 'bb rende facil', 'saldo anterior'].some(k => lowerLancamento.includes(k))) return null;

      const detalhes = getVal(row, ['Detalhes']);
      const description = detalhes ? `${lancamento} - ${detalhes}`.trim() : lancamento.trim();
      
      return {
        id: `${fileName}-bb2-${index}`,
        date: normalizeDate(getVal(row, ['Data'])),
        description: description,
        amount: parseCurrency(valorStr),
        sourceFile: fileName,
        category: isNonTaxable(description, undefined, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    })
    .filter(Boolean) as Transaction[];
};

const parseBancoTradicional = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  const results = Papa.parse(content, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  
  if (!getVal(data[0], ['Sinal']) || !getVal(data[0], ['Histórico'])) return [];

  return data
    .filter(row => getVal(row, ['Sinal']) === 'C')
    .map((row, index) => {
      const description = getVal(row, ['Histórico']) || '';
      return {
        id: `${fileName}-bb-${index}`,
        date: normalizeDate(getVal(row, ['Data'])),
        description: description,
        amount: parseCurrency(getVal(row, ['Valor'])),
        sourceFile: fileName,
        category: isNonTaxable(description, undefined, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

const parsePagBank = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  const results = Papa.parse(content, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  
  if (!getVal(data[0], ['Valor bruto']) || !getVal(data[0], ['Data da transação'])) return [];

  return data
    .filter(row => parseCurrency(getVal(row, ['Valor bruto'])) > 0)
    .map((row, index) => {
      const description = getVal(row, ['Descrição']) || '';
      return {
        id: `${fileName}-pagbank-${index}`,
        date: normalizeDate(getVal(row, ['Data da transação'])),
        description: description,
        amount: parseCurrency(getVal(row, ['Valor bruto'])),
        sourceFile: fileName,
        category: isNonTaxable(description, undefined, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

const parsePagSeguro = (content: string, fileName: string, companyCnpj: string, cpfList: string[], nameList: string[]): Transaction[] => {
  const results = Papa.parse(content, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  
  if (!getVal(data[0], ['VALOR']) || !getVal(data[0], ['DESCRICAO'])) return [];

  return data
    .filter(row => parseCurrency(getVal(row, ['VALOR'])) > 0)
    .map((row, index) => {
      const description = getVal(row, ['DESCRICAO']) || '';
      return {
        id: `${fileName}-pagseguro-${index}`,
        date: normalizeDate(getVal(row, ['DATA'])),
        description: description,
        amount: parseCurrency(getVal(row, ['VALOR'])),
        sourceFile: fileName,
        category: isNonTaxable(description, undefined, companyCnpj, cpfList, nameList) ? 'non-taxable' : 'taxable',
      };
    });
};

// --- FUNÇÃO PRINCIPAL ---

const parsers = [
  { name: 'Banco da Amazônia', fn: parseAmazonia },
  { name: 'InfinitPay', fn: parseInfinitPay },
  { name: 'Stone 2', fn: parseStone2 },
  { name: 'Stone', fn: parseStone },
  { name: 'C6 Bank', fn: parseC6Bank },
  { name: 'Bradesco', fn: parseBradesco },
  { name: 'Mercado Pago', fn: parseMercadoPago },
  { name: 'Nubank', fn: parseNubankCsv },
  { name: 'Inter', fn: parseInter },
  { name: 'Itaú', fn: parseItau },
  { name: 'Itaú 2', fn: parseItau2 },
  { name: 'Cora', fn: parseCora },
  { name: 'Banco do Brasil (formato 2)', fn: parseBB2 },
  { name: 'Banco Tradicional', fn: parseBancoTradicional },
  { name: 'PagBank', fn: parsePagBank },
  { name: 'PagSeguro', fn: parsePagSeguro },
];

export const parseFiles = async (files: File[], companyCnpj: string, partnerCpf: string, partnerNames: string): Promise<Transaction[]> => {
  const allTransactions: Transaction[] = [];
  const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
  const cpfList = partnerCpf.split(',').map(cpf => cpf.trim().replace(/\D/g, '')).filter(Boolean);
  const nameList = partnerNames.split(',').map(name => normalizeString(name)).filter(Boolean);

  for (const file of files) {
    try {
      const content = await readFileAsText(file);
      console.log(`[Parser] Processando arquivo: ${file.name} (${content.length} bytes)`);
      
      if (file.name.toLowerCase().endsWith('.ofx')) {
        console.log(`[Parser] Arquivo identificado como OFX. Usando parser de OFX.`);
        const txs = await parseOfxFile(content, file.name, cleanCompanyCnpj, cpfList, nameList);
        allTransactions.push(...txs);
        continue;
      }

      let foundParser = false;
      for (const parser of parsers) {
        console.log(`[Parser] Tentando o parser: ${parser.name}`);
        const transactions = parser.fn(content, file.name, cleanCompanyCnpj, cpfList, nameList);
        if (transactions.length > 0) {
          console.log(`[Parser] SUCESSO! Parser '${parser.name}' encontrou ${transactions.length} transações.`);
          allTransactions.push(...transactions);
          foundParser = true;
          break; 
        } else {
          console.log(`[Parser] O parser '${parser.name}' não encontrou transações.`);
        }
      }

      if (!foundParser) {
        console.warn(`[Parser] NENHUM PARSER COMPATÍVEL encontrado para o arquivo: ${file.name}`);
      }

    } catch (error) {
      console.error(`[Parser] ERRO CRÍTICO ao processar arquivo ${file.name}:`, error);
    }
  }

  return allTransactions;
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const utf8Decoder = new TextDecoder('utf-8');
      let content = utf8Decoder.decode(buffer);
      
      const hasGarbledChars = content.includes('Lan�amento') || content.includes('N� documento');
      if (hasGarbledChars || content.includes('\uFFFD')) {
        const isoDecoder = new TextDecoder('windows-1252');
        content = isoDecoder.decode(buffer);
      }
      
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.substring(1);
      }
      
      resolve(content);
    };
    reader.readAsArrayBuffer(file);
  });
};