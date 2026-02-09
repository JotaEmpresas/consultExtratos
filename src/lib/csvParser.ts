import Papa from 'papaparse';
import { Transaction } from '@/types';

// Helper para converter moeda para número, tratando formatos brasileiros e internacionais.
const parseCurrency = (value: string): number => {
  if (typeof value !== 'string' || !value) {
    return 0;
  }

  const cleanedValue = value.trim();

  // Se contém vírgula, assume que é o separador decimal (formato brasileiro)
  // e que pontos são separadores de milhar. Ex: "1.234,56"
  if (cleanedValue.includes(',')) {
    const numericString = cleanedValue.replace(/\./g, '').replace(',', '.');
    return parseFloat(numericString) || 0;
  }

  // Se não contém vírgula, assume que o ponto é o separador decimal (se existir).
  // Ex: "1234.56"
  // Remove caracteres não numéricos, exceto o ponto decimal e o sinal de menos.
  const numericString = cleanedValue.replace(/[^0-9.-]/g, '');
  return parseFloat(numericString) || 0;
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
  const lowercasedActual = actualHeaders.map(h => h.toLowerCase());
  return requiredHeaders.every(rh => lowercasedActual.includes(rh.toLowerCase()));
};

const detectAndParse = (data: any[], fileName: string, companyCnpj: string, partnerCpf: string): Transaction[] => {
  if (!data || data.length === 0) {
    return [];
  }
  const headers = Object.keys(data[0] || {});
  
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
  return [];
};

export const parseCsvFiles = (files: File[], companyCnpj: string, partnerCpf: string): Promise<Transaction[]> => {
  const promises = files.map(file => {
    return new Promise<Transaction[]>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        let fileContent = event.target?.result as string;

        // Pre-process content to remove extra headers, specifically for C6 Bank format
        const headerKeyword = 'Data Lançamento,Data Contábil,Título';
        if (fileContent.includes(headerKeyword)) {
          const lines = fileContent.split(/\r?\n/);
          const headerIndex = lines.findIndex(line => line.trim().startsWith(headerKeyword));
          if (headerIndex !== -1) {
            fileContent = lines.slice(headerIndex).join('\n');
          }
        }

        Papa.parse(fileContent, {
          header: true,
          skipEmptyLines: true,
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