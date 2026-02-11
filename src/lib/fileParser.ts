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
  return lines.findIndex(line => {
    const normalizedLine = normalizeString(line);
    return normalizedKeywords.every(nk => normalizedLine.includes(nk));
  });
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
  const lines = content.split(/\r?\n/);
  const headerIndex = findHeaderLineIndex(lines, ['Data', 'Lançamento', 'Detalhes', 'Nº documento', 'Valor', 'Tipo Lançamento']);
  if (headerIndex === -1) return [];

  const cleanContent = lines.slice(headerIndex).join('\n');
  const results = Papa.parse(cleanContent, { header: true, skipEmptyLines: true });
  const data = results.data as any[];

  return data
    .map((row, index) => {
      const lancamento = getVal(row, ['Lançamento']);
      if (!lancamento) return null;

      const lowerLancamento = normalizeString(lancamento);
      if (lowerLancamento.includes('saldo anterior') || lowerLancamento.includes('saldo do dia') || lowerLancamento.includes('s a l d o')) {
        return null;
      }

      const valorStr = getVal(row, ['Valor']) || '0';
      const amount = parseCurrency(valorStr);

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

export const parseFiles = async (files: File[], companyCnpj: string, partnerCpf: string): Promise<Transaction[]> => {
  const allTransactions: Transaction[] = [];

  for (const file of files) {
    try {
      const content = await readFileAsText(file);
      console.log(`[Parser] Processando arquivo: ${file.name} (${content.length} bytes)`);
      
      if (file.name.toLowerCase().endsWith('.ofx')) {
        const txs = await parseOfxFile(content, file.name, companyCnpj, partnerCpf);
        allTransactions.push(...txs);
        continue;
      }

      let transactions: Transaction[] = [];
      
      // Tenta cada parser separadamente
      
      // Stone 2
      transactions = parseStone2(content, file.name, companyCnpj, partnerCpf);
      if (transactions.length > 0) {
        console.log(`[Parser] Identificado como Stone 2: ${transactions.length} transações`);
        allTransactions.push(...transactions);
        continue;
      }

      // Stone
      transactions = parseStone(content, file.name, companyCnpj, partnerCpf);
      if (transactions.length > 0) {
        console.log(`[Parser] Identificado como Stone: ${transactions.length} transações`);
        allTransactions.push(...transactions);
        continue;
      }

      // C6 Bank
      transactions = parseC6Bank(content, file.name);
      if (transactions.length > 0) {
        console.log(`[Parser] Identificado como C6 Bank: ${transactions.length} transações`);
        allTransactions.push(...transactions);
        continue;
      }

      // Bradesco
      transactions = parseBradesco(content, file.name, companyCnpj);
      if (transactions.length > 0) {
        console.log(`[Parser] Identificado como Bradesco: ${transactions.length} transações`);
        allTransactions.push(...transactions);
        continue;
      }

      // Mercado Pago
      transactions = parseMercadoPago(content, file.name);
      if (transactions.length > 0) {
        console.log(`[Parser] Identificado como Mercado Pago: ${transactions.length} transações`);
        allTransactions.push(...transactions);
        continue;
      }

      // Nubank
      transactions = parseNubankCsv(content, file.name);
      if (transactions.length > 0) {
        console.log(`[Parser] Identificado como Nubank: ${transactions.length} transações`);
        allTransactions.push(...transactions);
        continue;
      }

      // Inter
      transactions = parseInter(content, file.name);
      if (transactions.length > 0) {
        console.log(`[Parser] Identificado como Inter: ${transactions.length} transações`);
        allTransactions.push(...transactions);
        continue;
      }

      // Itaú
      transactions = parseItau(content, file.name);
      if (transactions.length > 0) {
        console.log(`[Parser] Identificado como Itaú: ${transactions.length} transações`);
        allTransactions.push(...transactions);
        continue;
      }

      // Itaú 2 (com metadados)
      transactions = parseItau2(content, file.name);
      if (transactions.length > 0) {
        console.log(`[Parser] Identificado como Itaú 2: ${transactions.length} transações`);
        allTransactions.push(...transactions);
        continue;
      }

      // Cora
      transactions = parseCora(content, file.name);
      if (transactions.length > 0) {
        console.log(`[Parser] Identificado como Cora: ${transactions.length} transações`);
        allTransactions.push(...transactions);
        continue;
      }

      // Banco do Brasil (formato 2)
      transactions = parseBB2(content, file.name);
      if (transactions.length > 0) {
        console.log(`[Parser] Identificado como Banco do Brasil (formato 2): ${transactions.length} transações`);
        allTransactions.push(...transactions);
        continue;
      }

      // Banco Tradicional
      transactions = parseBancoTradicional(content, file.name);
      if (transactions.length > 0) {
        console.log(`[Parser] Identificado como Banco Tradicional: ${transactions.length} transações`);
        allTransactions.push(...transactions);
        continue;
      }

      // PagBank
      transactions = parsePagBank(content, file.name);
      if (transactions.length > 0) {
        console.log(`[Parser] Identificado como PagBank: ${transactions.length} transações`);
        allTransactions.push(...transactions);
        continue;
      }

      // PagSeguro
      transactions = parsePagSeguro(content, file.name);
      if (transactions.length > 0) {
        console.log(`[Parser] Identificado como PagSeguro: ${transactions.length} transações`);
        allTransactions.push(...transactions);
        continue;
      }

      console.warn(`[Parser] Nenhum parser compatível encontrado para o arquivo: ${file.name}`);
    } catch (error) {
      console.error(`[Parser] Erro ao processar arquivo ${file.name}:`, error);
    }
  }

  return allTransactions;
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      
      // Tenta UTF-8 primeiro
      const utf8Decoder = new TextDecoder('utf-8');
      let content = utf8Decoder.decode(buffer);
      
      // Se contiver o caractere de substituição () ou se não encontrarmos palavras-chave básicas, tentamos ISO-8859-1
      if (content.includes('\uFFFD') || (!content.includes('Data') && !content.includes('Valor') && !content.includes('Movimenta'))) {
        console.log(`[Parser] Detectado possível problema de encoding em ${file.name}, tentando windows-1252`);
        const isoDecoder = new TextDecoder('windows-1252');
        content = isoDecoder.decode(buffer);
      }
      
      // Remove BOM se existir
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.substring(1);
      }
      
      resolve(content);
    };
    reader.readAsArrayBuffer(file);
  });
};
