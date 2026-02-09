import Papa from 'papaparse';
import { Transaction } from '@/types';
import { parseOfxFile } from './ofxParser';

// Helper para converter moeda para número, tratando formatos brasileiros e internacionais.
const parseCurrency = (value: string): number => {
  if (typeof value !== 'string' || !value) {
    return 0;
  }
  // Remove currency symbols, spaces, etc. but keep comma, dot, and minus sign
  let cleanedValue = value.replace(/[^0-9,.-]/g, '').trim();

  const hasComma = cleanedValue.includes(',');
  const hasDot = cleanedValue.includes('.');

  // Check if it's a Brazilian format (e.g., "1.234,56") where comma is the decimal separator
  if (hasComma && (!hasDot || cleanedValue.lastIndexOf(',') > cleanedValue.lastIndexOf('.'))) {
    cleanedValue = cleanedValue.replace(/\./g, '').replace(',', '.');
  } else {
    // It's likely US/international format (e.g., "1,234.56"). Remove thousand separators.
    cleanedValue = cleanedValue.replace(/,/g, '');
  }
  
  return parseFloat(cleanedValue) || 0;
};

// Parser para o formato Nubank CSV
const parseNubankCsv = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
  const cleanPartnerCpf = partnerCpf.replace(/\D/g, '');

  return data
    .filter(row => row['Valor'] && parseCurrency(row['Valor']) > 0)
    .map((row) => {
      const description = row['Descrição'] || '';
      const isOwnAccount = description.includes(cleanCompanyCnpj) || description.includes(cleanPartnerCpf);
      const isInvestmentRedemption = description.toLowerCase().includes('resgate');

      return {
        id: row['Identificador'] || `${fileName}-nubank-csv-${Math.random()}`,
        date: row['Data'],
        description: description,
        amount: parseCurrency(row['Valor']),
        sourceFile: fileName,
        category: (isOwnAccount || isInvestmentRedemption) ? 'non-taxable' : 'taxable',
      };
    });
};

// Parser para o formato C6 Bank
const parseC6Bank = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
  const cleanPartnerCpf = partnerCpf.replace(/\D/g, '');

  return data
    .filter(row => row['Entrada(R$)'] && parseCurrency(row['Entrada(R$)']) > 0)
    .map((row, index) => {
      const description = row['Título'] || '';
      const isOwnAccount = description.includes(cleanCompanyCnpj) || description.includes(cleanPartnerCpf);

      return {
        id: `${fileName}-c6-${index}`,
        date: row['Data Lançamento'],
        description: description,
        amount: parseCurrency(row['Entrada(R$)']),
        sourceFile: fileName,
        category: isOwnAccount ? 'non-taxable' : 'taxable',
      };
    });
};

// Parser para o formato Mercado Pago
const parseMercadoPago = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
  const cleanPartnerCpf = partnerCpf.replace(/\D/g, '');

  return data
    .filter(row => row['TRANSACTION_NET_AMOUNT'] && parseCurrency(row['TRANSACTION_NET_AMOUNT']) > 0)
    .map((row, index) => {
      const description = row['TRANSACTION_TYPE'] || '';
      const isOwnAccount = description.includes(cleanCompanyCnpj) || description.includes(cleanPartnerCpf);
      
      let formattedDate = row['RELEASE_DATE'];
      // Convert DD-MM-YYYY to DD/MM/YYYY
      if (formattedDate && /^\d{2}-\d{2}-\d{4}$/.test(formattedDate)) {
        formattedDate = formattedDate.replace(/-/g, '/');
      }

      return {
        id: `${fileName}-mercadopago-${index}`,
        date: formattedDate,
        description: description,
        amount: parseCurrency(row['TRANSACTION_NET_AMOUNT']),
        sourceFile: fileName,
        category: isOwnAccount ? 'non-taxable' : 'taxable',
      };
    });
};

// Parser para o formato Cora (original)
const parseCora = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
  const cleanPartnerCpf = partnerCpf.replace(/\D/g, '');

  return data
    .filter(row => row['Tipo'] === 'CRÉDITO' && row['Valor (R$)'])
    .map((row, index) => {
      const description = row['Histórico'] || '';
      const isOwnAccount = description.includes(cleanCompanyCnpj) || description.includes(cleanPartnerCpf);
      
      return {
        id: `${fileName}-cora-${index}`,
        date: row['Data'],
        description: description,
        amount: parseCurrency(row['Valor (R$)']),
        sourceFile: fileName,
        category: isOwnAccount ? 'non-taxable' : 'taxable',
      };
    });
};

// Parser para o formato "Banco Tradicional" (ex: Banco do Brasil)
const parseBancoTradicional = (data: any[], fileName:string, companyCnpj: string, partnerCpf: string): Transaction[] => {
    const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
    const cleanPartnerCpf = partnerCpf.replace(/\D/g, '');

    return data
      .filter(row => row['Sinal'] === 'C' && row['Valor'])
      .map((row, index) => {
        const description = row['Histórico'] || '';
        const isOwnAccount = description.includes(cleanCompanyCnpj) || description.includes(cleanPartnerCpf);

        return {
          id: `${fileName}-bb-${index}`,
          date: row['Data'],
          description: description,
          amount: parseCurrency(row['Valor']),
          sourceFile: fileName,
          category: isOwnAccount ? 'non-taxable' : 'taxable',
        };
      });
}

// Parser para o formato PagBank
const parsePagBank = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
  const cleanPartnerCpf = partnerCpf.replace(/\D/g, '');

  return data
    .filter(row => row['Valor bruto'] && parseCurrency(row['Valor bruto']) > 0)
    .map((row, index) => {
      const description = row['Descrição'] || '';
      const isOwnAccount = description.includes(cleanCompanyCnpj) || description.includes(cleanPartnerCpf);

      return {
        id: `${fileName}-pagbank-${index}`,
        date: row['Data da transação'],
        description: description,
        amount: parseCurrency(row['Valor bruto']),
        sourceFile: fileName,
        category: isOwnAccount ? 'non-taxable' : 'taxable',
      };
    });
};

// Parser para o formato Inter (cora_01_a31_Janeiro.csv)
const parseInter = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
  const cleanPartnerCpf = partnerCpf.replace(/\D/g, '');

  return data
    .filter(row => row['Tipo Transação'] === 'CRÉDITO' && row['Valor'])
    .map((row, index) => {
      const description = row['Identificação'] || row['Transação'] || '';
      const isOwnAccount = description.includes(cleanCompanyCnpj) || description.includes(cleanPartnerCpf);

      return {
        id: `${fileName}-inter-${index}`,
        date: row['Data'],
        description: description,
        amount: parseCurrency(row['Valor']),
        sourceFile: fileName,
        category: isOwnAccount ? 'non-taxable' : 'taxable',
      };
    });
};

// Parser para o formato PagSeguro (2026-01-01_2026-01-31W.csv)
const parsePagSeguro = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
    const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
    const cleanPartnerCpf = partnerCpf.replace(/\D/g, '');

    return data
      .filter(row => row['VALOR'] && parseCurrency(row['VALOR']) > 0)
      .map((row, index) => {
        const description = row['DESCRICAO'] || row['TIPO'] || '';
        const isOwnAccount = description.includes(cleanCompanyCnpj) || description.includes(cleanPartnerCpf);

        return {
          id: `${fileName}-pagseguro-${index}`,
          date: row['DATA'],
          description: description,
          amount: parseCurrency(row['VALOR']),
          sourceFile: fileName,
          category: isOwnAccount ? 'non-taxable' : 'taxable',
        };
      });
};

// Parser para o formato Itaú
const parseItau = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
  const cleanPartnerCpf = partnerCpf.replace(/\D/g, '');

  return data
    .filter(row => row['Valor (R$)'] && parseCurrency(row['Valor (R$)']) > 0)
    .map((row, index) => {
      const sourceCnpjCpf = row['CNPJ/CPF']?.replace(/\D/g, '');
      const description = row['Lançamento'] || '';
      
      const isOwnAccountByCnpjCpfColumn = sourceCnpjCpf && (sourceCnpjCpf === cleanCompanyCnpj || sourceCnpjCpf === cleanPartnerCpf);
      const isOwnAccountByDescription = description.includes(cleanCompanyCnpj) || description.includes(cleanPartnerCpf);

      const isOwnAccount = isOwnAccountByCnpjCpfColumn || isOwnAccountByDescription;
      
      return {
        id: `${fileName}-itau-${index}`,
        date: row['Data'],
        description: description,
        amount: parseCurrency(row['Valor (R$)']),
        sourceFile: fileName,
        category: isOwnAccount ? 'non-taxable' : 'taxable',
      };
    });
};

// Helper to check for headers case-insensitively
const hasHeaders = (actualHeaders: string[], requiredHeaders: string[]): boolean => {
  const lowercasedActual = actualHeaders.map(h => h.trim().toLowerCase());
  return requiredHeaders.every(rh => lowercasedActual.includes(rh.toLowerCase()));
};

const detectAndParse = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  if (!data || data.length === 0) {
    return [];
  }
  const headers = Object.keys(data[0] || {});
  
  // Detecção do Nubank CSV
  if (hasHeaders(headers, ['Data', 'Valor', 'Identificador', 'Descrição'])) {
    return parseNubankCsv(data, fileName, companyCnpj, partnerCpf);
  }

  // Detecção do Mercado Pago
  if (hasHeaders(headers, ['RELEASE_DATE', 'TRANSACTION_TYPE', 'TRANSACTION_NET_AMOUNT'])) {
    return parseMercadoPago(data, fileName, companyCnpj, partnerCpf);
  }

  // Detecção do C6 Bank
  if (hasHeaders(headers, ['Data Lançamento', 'Título', 'Entrada(R$)'])) {
    return parseC6Bank(data, fileName, companyCnpj, partnerCpf);
  }

  // Detecção do Itaú
  if (hasHeaders(headers, ['Data', 'Lançamento', 'Valor (R$)'])) {
    return parseItau(data, fileName, companyCnpj, partnerCpf);
  }

  // Detecção do Cora (original)
  if (hasHeaders(headers, ['Data', 'Histórico', 'Valor (R$)', 'Tipo'])) {
    return parseCora(data, fileName, companyCnpj, partnerCpf);
  }

  // Detecção do Banco Tradicional
  if (hasHeaders(headers, ['Data', 'Histórico', 'Valor', 'Sinal'])) {
    return parseBancoTradicional(data, fileName, companyCnpj, partnerCpf);
  }

  // Detecção do PagBank
  if (hasHeaders(headers, ['Data da transação', 'Descrição', 'Valor bruto'])) {
    return parsePagBank(data, fileName, companyCnpj, partnerCpf);
  }

  // Detecção do Inter (cora_01_a31_Janeiro.csv)
  if (hasHeaders(headers, ['Data', 'Transação', 'Tipo Transação', 'Valor'])) {
    return parseInter(data, fileName, companyCnpj, partnerCpf);
  }

  // Detecção do PagSeguro (2026-01-01_2026-01-31W.csv)
  if (hasHeaders(headers, ['DATA', 'TIPO', 'DESCRICAO', 'VALOR'])) {
    return parsePagSeguro(data, fileName, companyCnpj, partnerCpf);
  }

  console.warn(`Formato de arquivo não reconhecido para: ${fileName}`);
  console.log('Cabeçalhos detectados:', headers);
  return [];
};

export const parseFiles = (files: File[], companyCnpj: string, partnerCpf: string): Promise<Transaction[]> => {
  const promises = files.map(file => {
    return new Promise<Transaction[]>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
        const fileContent = event.target?.result as string;
        
        if (file.name.toLowerCase().endsWith('.ofx')) {
          try {
            const transactions = await parseOfxFile(fileContent, file.name, companyCnpj, partnerCpf);
            resolve(transactions);
          } catch (error) {
            console.error(`Erro ao processar o arquivo OFX ${file.name}:`, error);
            reject(error);
          }
        } else if (file.name.toLowerCase().endsWith('.csv')) {
          let processedContent = fileContent;
          let delimiter: string | undefined = undefined;

          const normalizeHeaderLine = (line: string) => line.replace(/["\s]/g, '');
          const lines = processedContent.split(/\r?\n/);

          const nubankHeaderKeyword = 'Data,Valor,Identificador,Descrição';
          const normalizedNubankKeyword = normalizeHeaderLine(nubankHeaderKeyword);
          const nubankHeaderIndex = lines.findIndex(line => normalizeHeaderLine(line.trim()) === normalizedNubankKeyword);

          if (nubankHeaderIndex !== -1) {
            processedContent = lines.slice(nubankHeaderIndex).join('\n');
            delimiter = ',';
          } else {
            const c6HeaderKeyword = 'Data Lançamento,Data Contábil,Título';
            if (processedContent.includes(c6HeaderKeyword)) {
              const c6lines = processedContent.split(/\r?\n/);
              const headerIndex = c6lines.findIndex(line => line.trim().startsWith(c6HeaderKeyword));
              if (headerIndex !== -1) {
                processedContent = c6lines.slice(headerIndex).join('\n');
              }
            }

            const mpHeaderKeyword = 'RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID';
            if (processedContent.includes(mpHeaderKeyword)) {
              delimiter = ';';
              const mpLines = processedContent.split(/\r?\n/);
              const headerIndex = mpLines.findIndex(line => line.trim().startsWith(mpHeaderKeyword));
              if (headerIndex !== -1) {
                processedContent = mpLines.slice(headerIndex).join('\n');
              }
            }
          }

          Papa.parse(processedContent, {
            header: true,
            skipEmptyLines: true,
            delimiter: delimiter,
            complete: (results) => {
              try {
                const transactions = detectAndParse(results.data, file.name, companyCnpj, partnerCpf);
                resolve(transactions);
              } catch (error) {
                console.error(`Erro ao processar o arquivo ${file.name}:`, error);
                reject(error);
              }
            },
            error: (error) => {
              console.error(`Erro ao ler o arquivo ${file.name}:`, error);
              reject(error);
            },
          });
        } else {
          console.warn(`Tipo de arquivo não suportado: ${file.name}`);
          resolve([]);
        }
      };

      reader.onerror = (error) => {
        console.error(`Erro ao ler o arquivo ${file.name}:`, error);
        reject(error);
      };

      reader.readAsText(file, 'UTF-8');
    });
  });

  return Promise.all(promises).then(results => results.flat());
};