import Papa from 'papaparse';
import { Transaction } from '@/types';
import { parseOfxFile } from './ofxParser';

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

// Helper para normalizar datas para o formato DD/MM/AAAA de forma ultra-robusta
const normalizeDate = (dateStr: string): string => {
  if (!dateStr) return '';
  // Remove horas e limpa espaços
  const cleanDate = dateStr.split(' ')[0].replace(/-/g, '/').trim();

  // Caso 1: AAAA/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleanDate)) {
    const [y, m, d] = cleanDate.split('/');
    return `${d}/${m}/${y}`;
  }

  // Caso 2: DD/MM/AA (2 dígitos)
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(cleanDate)) {
    const [d, m, y] = cleanDate.split('/');
    return `${d}/${m}/20${y}`;
  }

  // Caso 3: DD/MM/AAAA (Já está correto)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanDate)) {
    return cleanDate;
  }

  return cleanDate;
};

// Parser para o formato Stone
const parseStone = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
  const cleanPartnerCpf = partnerCpf.replace(/\D/g, '');

  const transactions = data
    .filter(row => {
      const mov = (row['Movimentação'] || '').toString().trim().toLowerCase();
      const isCredit = mov === 'crédito' || mov === 'credito';
      const val = parseCurrency(row['Valor']);
      return isCredit && val > 0;
    })
    .map((row, index) => {
      const originDocument = row['Origem Documento']?.toString().replace(/\D/g, '');
      const description = `${row['Tipo'] || ''} - ${row['Origem'] || ''}`;
      const isOwnAccount = originDocument && (originDocument === cleanCompanyCnpj || originDocument === cleanPartnerCpf);
      const formattedDate = normalizeDate(row['Data'] || '');

      return {
        id: `${fileName}-stone-${index}-${formattedDate}`,
        date: formattedDate,
        description: description,
        amount: parseCurrency(row['Valor']),
        sourceFile: fileName,
        category: isOwnAccount ? 'non-taxable' : 'taxable',
      };
    });

  console.log(`[Stone] ${fileName}: Processadas ${transactions.length} transações de crédito.`);
  return transactions;
};

// ... (Outros parsers permanecem iguais, mas usando normalizeDate onde necessário)

const parseBradesco = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
  const cleanPartnerCpf = partnerCpf.replace(/\D/g, '');
  const creditKey = Object.keys(data[0] || {}).find(k => k.includes('Crédito'));
  const descriptionKey = Object.keys(data[0] || {}).find(k => k.includes('Lançamento'));
  const dateKey = Object.keys(data[0] || {}).find(k => k.includes('Data'));
  if (!creditKey || !descriptionKey || !dateKey) return [];
  return data
    .filter(row => parseCurrency(row[creditKey]) > 0)
    .map((row, index) => ({
      id: `${fileName}-bradesco-${index}`,
      date: normalizeDate(row[dateKey]),
      description: row[descriptionKey] || '',
      amount: parseCurrency(row[creditKey]),
      sourceFile: fileName,
      category: (row[descriptionKey] || '').includes(cleanCompanyCnpj) ? 'non-taxable' : 'taxable',
    }));
};

const parseNubankCsv = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  return data.filter(row => parseCurrency(row['Valor']) > 0).map((row, index) => ({
    id: row['Identificador'] || `${fileName}-nubank-${index}`,
    date: normalizeDate(row['Data']),
    description: row['Descrição'] || '',
    amount: parseCurrency(row['Valor']),
    sourceFile: fileName,
    category: (row['Descrição'] || '').toLowerCase().includes('resgate') ? 'non-taxable' : 'taxable',
  }));
};

const parseC6Bank = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  return data.filter(row => parseCurrency(row['Entrada(R$)']) > 0).map((row, index) => ({
    id: `${fileName}-c6-${index}`,
    date: normalizeDate(row['Data Lançamento']),
    description: row['Título'] || '',
    amount: parseCurrency(row['Entrada(R$)']),
    sourceFile: fileName,
    category: 'taxable',
  }));
};

const parseMercadoPago = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  return data.filter(row => parseCurrency(row['TRANSACTION_NET_AMOUNT']) > 0).map((row, index) => ({
    id: `${fileName}-mp-${index}`,
    date: normalizeDate(row['RELEASE_DATE']),
    description: row['TRANSACTION_TYPE'] || '',
    amount: parseCurrency(row['TRANSACTION_NET_AMOUNT']),
    sourceFile: fileName,
    category: 'taxable',
  }));
};

const parseCora = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  return data.filter(row => row['Tipo'] === 'CRÉDITO').map((row, index) => ({
    id: `${fileName}-cora-${index}`,
    date: normalizeDate(row['Data']),
    description: row['Histórico'] || '',
    amount: parseCurrency(row['Valor (R$)']),
    sourceFile: fileName,
    category: 'taxable',
  }));
};

const parseBancoTradicional = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  return data.filter(row => row['Sinal'] === 'C').map((row, index) => ({
    id: `${fileName}-bb-${index}`,
    date: normalizeDate(row['Data']),
    description: row['Histórico'] || '',
    amount: parseCurrency(row['Valor']),
    sourceFile: fileName,
    category: 'taxable',
  }));
};

const parsePagBank = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  return data.filter(row => parseCurrency(row['Valor bruto']) > 0).map((row, index) => ({
    id: `${fileName}-pagbank-${index}`,
    date: normalizeDate(row['Data da transação']),
    description: row['Descrição'] || '',
    amount: parseCurrency(row['Valor bruto']),
    sourceFile: fileName,
    category: 'taxable',
  }));
};

const parseInter = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  return data.filter(row => row['Tipo Transação'] === 'CRÉDITO').map((row, index) => ({
    id: `${fileName}-inter-${index}`,
    date: normalizeDate(row['Data']),
    description: row['Transação'] || '',
    amount: parseCurrency(row['Valor']),
    sourceFile: fileName,
    category: 'taxable',
  }));
};

const parsePagSeguro = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  return data.filter(row => parseCurrency(row['VALOR']) > 0).map((row, index) => ({
    id: `${fileName}-pagseguro-${index}`,
    date: normalizeDate(row['DATA']),
    description: row['DESCRICAO'] || '',
    amount: parseCurrency(row['VALOR']),
    sourceFile: fileName,
    category: 'taxable',
  }));
};

const parseItau = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  return data.filter(row => parseCurrency(row['Valor (R$)']) > 0).map((row, index) => ({
    id: `${fileName}-itau-${index}`,
    date: normalizeDate(row['Data']),
    description: row['Lançamento'] || '',
    amount: parseCurrency(row['Valor (R$)']),
    sourceFile: fileName,
    category: 'taxable',
  }));
};

const hasHeaders = (actualHeaders: string[], requiredHeaders: string[]): boolean => {
  const lowercasedActual = actualHeaders.map(h => h.trim().toLowerCase());
  return requiredHeaders.every(rh => lowercasedActual.includes(rh.toLowerCase()));
};

const detectAndParse = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  if (!data || data.length === 0) return [];
  const headers = Object.keys(data[0] || {});
  if (hasHeaders(headers, ['Movimentação', 'Tipo', 'Valor', 'Origem Documento'])) return parseStone(data, fileName, companyCnpj, partnerCpf);
  if (hasHeaders(headers, ['Data', 'Lançamento', 'Crédito (R$)'])) return parseBradesco(data, fileName, companyCnpj, partnerCpf);
  if (hasHeaders(headers, ['Data', 'Valor', 'Identificador', 'Descrição'])) return parseNubankCsv(data, fileName, companyCnpj, partnerCpf);
  if (hasHeaders(headers, ['RELEASE_DATE', 'TRANSACTION_TYPE', 'TRANSACTION_NET_AMOUNT'])) return parseMercadoPago(data, fileName, companyCnpj, partnerCpf);
  if (hasHeaders(headers, ['Data Lançamento', 'Título', 'Entrada(R$)'])) return parseC6Bank(data, fileName, companyCnpj, partnerCpf);
  if (hasHeaders(headers, ['Data', 'Lançamento', 'Valor (R$)'])) return parseItau(data, fileName, companyCnpj, partnerCpf);
  if (hasHeaders(headers, ['Data', 'Histórico', 'Valor (R$)', 'Tipo'])) return parseCora(data, fileName, companyCnpj, partnerCpf);
  if (hasHeaders(headers, ['Data', 'Histórico', 'Valor', 'Sinal'])) return parseBancoTradicional(data, fileName, companyCnpj, partnerCpf);
  if (hasHeaders(headers, ['Data da transação', 'Descrição', 'Valor bruto'])) return parsePagBank(data, fileName, companyCnpj, partnerCpf);
  if (hasHeaders(headers, ['Data', 'Transação', 'Tipo Transação', 'Valor'])) return parseInter(data, fileName, companyCnpj, partnerCpf);
  if (hasHeaders(headers, ['DATA', 'TIPO', 'DESCRICAO', 'VALOR'])) return parsePagSeguro(data, fileName, companyCnpj, partnerCpf);
  return [];
};

export const parseFiles = (files: File[], companyCnpj: string, partnerCpf: string): Promise<Transaction[]> => {
  const promises = files.map(file => {
    return new Promise<Transaction[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        let content = event.target?.result as string;
        if (!content) return resolve([]);
        if (content.charCodeAt(0) === 0xFEFF) content = content.substring(1);

        if (file.name.toLowerCase().endsWith('.ofx')) {
          const txs = await parseOfxFile(content, file.name, companyCnpj, partnerCpf);
          resolve(txs);
        } else {
          let delimiter = undefined;
          if (content.includes('Movimentação,Tipo,Valor')) delimiter = ',';
          else if (content.includes(';Extrato de:')) delimiter = ';';

          Papa.parse(content, {
            header: true,
            skipEmptyLines: true,
            delimiter: delimiter,
            complete: (results) => resolve(detectAndParse(results.data, file.name, companyCnpj, partnerCpf)),
            error: (err) => reject(err),
          });
        }
      };
      reader.readAsText(file, 'UTF-8');
    });
  });
  return Promise.all(promises).then(results => results.flat());
};