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
  let cleanedValue = value.replace(/[^0-9,.-]/g, '').trim();
  const hasComma = cleanedValue.includes(',');
  const hasDot = cleanedValue.includes('.');
  if (hasComma && (!hasDot || cleanedValue.lastIndexOf(',') > cleanedValue.lastIndexOf('.'))) {
    cleanedValue = cleanedValue.replace(/\./g, '').replace(',', '.');
  } else {
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

// --- PARSERS ESPECÍFICOS ---

const parseStone = (content: string, fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['Movimentação', 'Tipo', 'Valor', 'Data']);
  if (headerIndex === -1) return [];

  // Check to avoid conflict with Stone2
  if (normalizeString(lines[headerIndex]).includes(normalizeString('Saldo antes'))) {
    return [];
  }

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
  const data = results.data as any[];

  const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
  const cleanPartnerCpf = partnerCpf.replace(/\D/g, '');

  return data
    .filter(row => {
      const mov = normalizeString((getVal(row, ['Movimentação']) || '').toString());
      const isCredit = mov.includes('credito');
      const val = parseCurrency(getVal(row, ['Valor']));
      return isCredit && val > 0;
    })
    .map((row, index) => {
      const originDocument = getVal(row, ['Origem Documento'])?.toString().replace(/\D/g, '');
      const tipo = getVal(row, ['Tipo']) || '';
      const origem = getVal(row, ['Origem']) || '';
      const description = `${tipo} - ${origem}`.trim();
      const isOwnAccount = originDocument && (originDocument === cleanCompanyCnpj || originDocument === cleanPartnerCpf);
      const dateStr = getVal(row, ['Data']) || '';
      const formattedDate = normalizeDate(dateStr);

      return {
        id: `${fileName}-stone-${index}-${formattedDate}`,
        date: formattedDate,
        description: description,
        amount: parseCurrency(getVal(row, ['Valor'])),
        sourceFile: fileName,
        category: isOwnAccount ? 'non-taxable' : 'taxable',
      };
    });
};

const parseStone2 = (content: string, fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['Movimentação', 'Tipo', 'Valor', 'Saldo antes', 'Destino Documento']);
  if (headerIndex === -1) return [];

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
  const data = results.data as any[];

  const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
  const cleanPartnerCpf = partnerCpf.replace(/\D/g, '');

  return data
    .filter(row => {
      const mov = normalizeString((getVal(row, ['Movimentação']) || '').toString());
      const isCredit = mov.includes('credito');
      const val = parseCurrency(getVal(row, ['Valor']));
      return isCredit && val > 0;
    })
    .map((row, index) => {
      const originDocument = getVal(row, ['Origem Documento'])?.toString().replace(/\D/g, '');
      const tipo = getVal(row, ['Tipo']) || '';
      const origem = getVal(row, ['Origem']) || '';
      const description = `${tipo} - ${origem}`.trim();
      const isOwnAccount = originDocument && (originDocument === cleanCompanyCnpj || originDocument === cleanPartnerCpf);
      const dateStr = getVal(row, ['Data']) || '';
      const formattedDate = normalizeDate(dateStr);

      return {
        id: `${fileName}-stone2-${index}-${formattedDate}`,
        date: formattedDate,
        description: description,
        amount: parseCurrency(getVal(row, ['Valor'])),
        sourceFile: fileName,
        category: isOwnAccount ? 'non-taxable' : 'taxable',
      };
    });
};

const parseC6Bank = (content: string, fileName: string): Transaction[] => {
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['Data Lançamento', 'Título', 'Entrada(R$)']);
  if (headerIndex === -1) return [];

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
  
  return (results.data as any[])
    .filter(row => parseCurrency(getVal(row, ['Entrada(R$)'])) > 0)
    .map((row, index) => ({
      id: `${fileName}-c6-${index}`,
      date: normalizeDate(getVal(row, ['Data Lançamento'])),
      description: getVal(row, ['Título']) || '',
      amount: parseCurrency(getVal(row, ['Entrada(R$)'])),
      sourceFile: fileName,
      category: 'taxable',
    }));
};

const parseBradesco = (content: string, fileName: string, companyCnpj: string): Transaction[] => {
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['Data', 'Lançamento', 'Crédito (R$)']);
  if (headerIndex === -1) return [];

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
  const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');

  return (results.data as any[])
    .filter(row => parseCurrency(getVal(row, ['Crédito (R$)'])) > 0)
    .map((row, index) => {
      const desc = getVal(row, ['Lançamento']) || '';
      return {
        id: `${fileName}-bradesco-${index}`,
        date: normalizeDate(getVal(row, ['Data'])),
        description: desc,
        amount: parseCurrency(getVal(row, ['Crédito (R$)'])),
        sourceFile: fileName,
        category: desc.includes(cleanCompanyCnpj) ? 'non-taxable' : 'taxable',
      };
    });
};

const parseMercadoPago = (content: string, fileName: string): Transaction[] => {
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['RELEASE_DATE', 'TRANSACTION_TYPE', 'TRANSACTION_NET_AMOUNT']);
  if (headerIndex === -1) return [];

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });

  return (results.data as any[])
    .filter(row => parseCurrency(getVal(row, ['TRANSACTION_NET_AMOUNT'])) > 0)
    .map((row, index) => ({
      id: `${fileName}-mp-${index}`,
      date: normalizeDate(getVal(row, ['RELEASE_DATE'])),
      description: getVal(row, ['TRANSACTION_TYPE']) || '',
      amount: parseCurrency(getVal(row, ['TRANSACTION_NET_AMOUNT'])),
      sourceFile: fileName,
      category: 'taxable',
    }));
};

const parseNubankCsv = (content: string, fileName: string): Transaction[] => {
  const results = Papa.parse(content, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  
  if (!getVal(data[0], ['Identificador']) && !getVal(data[0], ['Descrição'])) return [];

  return data
    .filter(row => parseCurrency(getVal(row, ['Valor'])) > 0)
    .map((row, index) => ({
      id: getVal(row, ['Identificador']) || `${fileName}-nubank-${index}`,
      date: normalizeDate(getVal(row, ['Data'])),
      description: getVal(row, ['Descrição']) || '',
      amount: parseCurrency(getVal(row, ['Valor'])),
      sourceFile: fileName,
      category: (getVal(row, ['Descrição']) || '').toLowerCase().includes('resgate') ? 'non-taxable' : 'taxable',
    }));
};

const parseInter = (content: string, fileName: string): Transaction[] => {
  const results = Papa.parse(content, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  
  if (!getVal(data[0], ['Tipo Transação'])) return [];

  return data
    .filter(row => normalizeString(getVal(row, ['Tipo Transação']) || '').includes('credito'))
    .map((row, index) => ({
      id: `${fileName}-inter-${index}`,
      date: normalizeDate(getVal(row, ['Data'])),
      description: getVal(row, ['Transação']) || '',
      amount: parseCurrency(getVal(row, ['Valor'])),
      sourceFile: fileName,
      category: 'taxable',
    }));
};

const parseItau = (content: string, fileName: string): Transaction[] => {
  const results = Papa.parse(content, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  
  if (!getVal(data[0], ['Lançamento']) || !getVal(data[0], ['Valor (R$)'])) return [];

  return data
    .filter(row => parseCurrency(getVal(row, ['Valor (R$)'])) > 0)
    .map((row, index) => ({
      id: `${fileName}-itau-${index}`,
      date: normalizeDate(getVal(row, ['Data'])),
      description: getVal(row, ['Lançamento']) || '',
      amount: parseCurrency(getVal(row, ['Valor (R$)'])),
      sourceFile: fileName,
      category: 'taxable',
    }));
};

const parseItau2 = (content: string, fileName: string): Transaction[] => {
  console.log(`[Parser] Tentando Itaú 2 (com metadados) para ${fileName}`);
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['Data', 'Lançamento', 'Valor (R$)', 'Saldo (R$)']);
  if (headerIndex === -1) return [];

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, {
    header: true,
    skipEmptyLines: true,
    delimiter: ';'
  });
  
  return (results.data as any[])
    .filter(row => {
      const val = parseCurrency(getVal(row, ['Valor (R$)']));
      const desc = (getVal(row, ['Lançamento']) || '').toString().toUpperCase();
      return val > 0 && !desc.includes('SALDO TOTAL');
    })
    .map((row, index) => ({
      id: `${fileName}-itau2-${index}`,
      date: normalizeDate(getVal(row, ['Data'])),
      description: getVal(row, ['Lançamento']) || '',
      amount: parseCurrency(getVal(row, ['Valor (R$)'])),
      sourceFile: fileName,
      category: 'taxable',
    }));
};

const parseCora = (content: string, fileName: string): Transaction[] => {
  const results = Papa.parse(content, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  
  if (!getVal(data[0], ['Histórico']) || !getVal(data[0], ['Valor (R$)'])) return [];

  return data
    .filter(row => normalizeString(getVal(row, ['Tipo']) || '').includes('credito'))
    .map((row, index) => ({
      id: `${fileName}-cora-${index}`,
      date: normalizeDate(getVal(row, ['Data'])),
      description: getVal(row, ['Histórico']) || '',
      amount: parseCurrency(getVal(row, ['Valor (R$)'])),
      sourceFile: fileName,
      category: 'taxable',
    }));
};

const parseBB2 = (content: string, fileName: string): Transaction[] => {
  console.log(`[parseBB2] Iniciando parser para ${fileName}`);
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['Data', 'Lançamento', 'Detalhes', 'Nº documento', 'Valor', 'Tipo Lançamento']);
  
  if (headerIndex === -1) {
    console.error(`[parseBB2] Cabeçalho não encontrado para o formato BB2 em ${fileName}.`);
    return [];
  }

  const headerLine = lines[headerIndex];
  const contentLines = lines.slice(headerIndex + 1);

  // Pré-filtra as linhas de conteúdo para remover rodapés e linhas de resumo
  const filteredContentLines = contentLines.filter(line => {
    const lowerLine = normalizeString(line);
    const isFooterLine = lowerLine.includes('saldo do dia') || lowerLine.includes('s a l d o') || lowerLine.includes('bb rende facil');
    if (isFooterLine) {
      console.log(`[parseBB2] Pré-filtrando linha de rodapé: ${line}`);
      return false;
    }
    return true;
  });

  const cleanContent = [headerLine, ...filteredContentLines].join('\n');
  console.log(`[parseBB2] Conteúdo limpo enviado para o PapaParse:\n${cleanContent.substring(0, 500)}...`);
  
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  console.log(`[parseBB2] PapaParse encontrou ${data.length} linhas.`);

  const transactions = data
    .map((row, index) => {
      const lancamento = getVal(row, ['Lançamento']);
      if (!lancamento) return null;

      const valorStr = getVal(row, ['Valor']) || '0';
      const amount = parseCurrency(valorStr);

      // Filtra transações de débito ou com valor zero
      if (amount <= 0) return null;

      const dateStr = getVal(row, ['Data']);
      const detalhes = getVal(row, ['Detalhes']);
      const description = detalhes ? `${lancamento} - ${detalhes}`.trim() : (lancamento || '').trim();
      
      return {
        id: `${fileName}-bb2-${index}`,
        date: normalizeDate(dateStr),
        description: description,
        amount: amount,
        sourceFile: fileName,
        category: 'taxable',
      };
    })
    .filter(Boolean) as Transaction[];
  
  console.log(`[parseBB2] Filtrou e mapeou ${transactions.length} transações válidas.`);
  return transactions;
};

const parseBancoTradicional = (content: string, fileName: string): Transaction[] => {
  const results = Papa.parse(content, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  
  if (!getVal(data[0], ['Sinal']) || !getVal(data[0], ['Histórico'])) return [];

  return data
    .filter(row => getVal(row, ['Sinal']) === 'C')
    .map((row, index) => ({
      id: `${fileName}-bb-${index}`,
      date: normalizeDate(getVal(row, ['Data'])),
      description: getVal(row, ['Histórico']) || '',
      amount: parseCurrency(getVal(row, ['Valor'])),
      sourceFile: fileName,
      category: 'taxable',
    }));
};

const parsePagBank = (content: string, fileName: string): Transaction[] => {
  const results = Papa.parse(content, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  
  if (!getVal(data[0], ['Valor bruto']) || !getVal(data[0], ['Data da transação'])) return [];

  return data
    .filter(row => parseCurrency(getVal(row, ['Valor bruto'])) > 0)
    .map((row, index) => ({
      id: `${fileName}-pagbank-${index}`,
      date: normalizeDate(getVal(row, ['Data da transação'])),
      description: getVal(row, ['Descrição']) || '',
      amount: parseCurrency(getVal(row, ['Valor bruto'])),
      sourceFile: fileName,
      category: 'taxable',
    }));
};

const parsePagSeguro = (content: string, fileName: string): Transaction[] => {
  const results = Papa.parse(content, { header: true, skipEmptyLines: true });
  const data = results.data as any[];
  
  if (!getVal(data[0], ['VALOR']) || !getVal(data[0], ['DESCRICAO'])) return [];

  return data
    .filter(row => parseCurrency(getVal(row, ['VALOR'])) > 0)
    .map((row, index) => ({
      id: `${fileName}-pagseguro-${index}`,
      date: normalizeDate(getVal(row, ['DATA'])),
      description: getVal(row, ['DESCRICAO']) || '',
      amount: parseCurrency(getVal(row, ['VALOR'])),
      sourceFile: fileName,
      category: 'taxable',
    }));
};

// --- FUNÇÃO PRINCIPAL ---

const parsers = [
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

export const parseFiles = async (files: File[], companyCnpj: string, partnerCpf: string): Promise<Transaction[]> => {
  const allTransactions: Transaction[] = [];

  for (const file of files) {
    try {
      const content = await readFileAsText(file);
      console.log(`[Parser] Processando arquivo: ${file.name} (${content.length} bytes)`);
      
      if (file.name.toLowerCase().endsWith('.ofx')) {
        console.log(`[Parser] Arquivo identificado como OFX. Usando parser de OFX.`);
        const txs = await parseOfxFile(content, file.name, companyCnpj, partnerCpf);
        allTransactions.push(...txs);
        continue;
      }

      let foundParser = false;
      for (const parser of parsers) {
        console.log(`[Parser] Tentando o parser: ${parser.name}`);
        // @ts-ignore
        const transactions = parser.fn(content, file.name, companyCnpj, partnerCpf);
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
      console.log(`[readFileAsText] Arquivo ${file.name} lido, ${buffer.byteLength} bytes.`);
      
      // Tenta UTF-8 primeiro
      const utf8Decoder = new TextDecoder('utf-8');
      let content = utf8Decoder.decode(buffer);
      console.log(`[readFileAsText] Tentativa de decodificação UTF-8 (primeiras 300 chars): ${content.substring(0, 300)}`);
      
      // Heurística para detectar encoding incorreto, especialmente para arquivos do BB
      const hasGarbledChars = content.includes('Lan�amento') || content.includes('N� documento');
      console.log(`[readFileAsText] Verificando caracteres problemáticos (�): ${hasGarbledChars}`);

      if (hasGarbledChars || content.includes('\uFFFD')) {
        console.log(`[readFileAsText] Detectado problema de encoding. Tentando com windows-1252.`);
        const isoDecoder = new TextDecoder('windows-1252');
        content = isoDecoder.decode(buffer);
        console.log(`[readFileAsText] Resultado com windows-1252 (primeiras 300 chars): ${content.substring(0, 300)}`);
      }
      
      // Remove BOM se existir
      if (content.charCodeAt(0) === 0xFEFF) {
        console.log(`[readFileAsText] Byte Order Mark (BOM) encontrado e removido.`);
        content = content.substring(1);
      }
      
      resolve(content);
    };
    reader.readAsArrayBuffer(file);
  });
};