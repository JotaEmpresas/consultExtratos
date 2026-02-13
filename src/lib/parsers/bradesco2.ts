import { Transaction } from '@/types';
import Papa from 'papaparse';

// Helper para converter moeda no formato "10.000,00"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value.replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(cleanedValue) || 0;
};

// Helper to normalize strings, removing accents and converting to lowercase
const normalize = (str: string) =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const parseBradesco2 = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        let headerFound = false;
        let dateIndex = -1;
        let descriptionIndex = -1;
        let creditIndex = -1;
        let valueIndex = -1;
        let debitIndex = -1;

        const headerRowIndex = results.data.findIndex((row: any) => {
            if (!Array.isArray(row)) return false;
            const normalizedRow = row.map(c => normalize(String(c || '')));
            return normalizedRow.some(c => c.includes('data')) && normalizedRow.some(c => c.includes('lan'));
        });

        if (headerRowIndex !== -1) {
            const header: string[] = results.data[headerRowIndex].map((h: any) => normalize(String(h || '')));
            headerFound = true;
            dateIndex = header.findIndex(h => h.includes('data'));
            descriptionIndex = header.findIndex(h => h.includes('lan'));
            creditIndex = header.findIndex(h => h.includes('credit'));
            debitIndex = header.findIndex(h => h.includes('debit'));
            valueIndex = header.findIndex(h => h.includes('valor'));
        } else {
            dateIndex = 0;
            descriptionIndex = 1;
            creditIndex = 3;
            debitIndex = 2;
        }

        const dataToParse = headerFound ? results.data.slice(headerRowIndex + 1) : results.data;

        dataToParse.forEach((row: any, index: number) => {
          if (!Array.isArray(row) || dateIndex === -1 || descriptionIndex === -1) {
            return;
          }

          const dateStr = row[dateIndex]?.trim();
          const description = row[descriptionIndex]?.trim() || '';
          
          if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr) || normalize(description).includes('saldo anterior')) {
            return;
          }

          let amount = 0;

          if (creditIndex !== -1 && row[creditIndex]) {
            amount = parseCurrency(row[creditIndex]);
          } else if (valueIndex !== -1 && row[valueIndex]) {
            const parsed = parseCurrency(row[valueIndex]);
            if (parsed > 0) {
              amount = parsed;
            }
          }

          if (amount > 0) {
            const normalizedDesc = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const numbersOnlyDesc = normalizedDesc.replace(/[^0-9]/g, '');

            const cleanedCnpj = companyCnpj.replace(/\D/g, '');
            const cleanedCpfList = cpfList.map(cpf => cpf.replace(/\D/g, '')).filter(Boolean);
            const cleanedNameList = nameList.map(name => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()).filter(Boolean);

            const isOwnAccount = 
              (cleanedCnpj && numbersOnlyDesc.includes(cleanedCnpj)) ||
              cleanedCpfList.some(cpf => cpf && numbersOnlyDesc.includes(cpf)) ||
              cleanedNameList.some(name => name && normalizedDesc.includes(name));

            const transaction: Transaction = {
              id: `bradesco2-${Date.now()}-${index}`,
              date: dateStr,
              description: description,
              amount: amount,
              category: isOwnAccount ? 'non-taxable' : 'taxable',
            };
            
            transactions.push(transaction);
          }
        });
        
        if (transactions.length === 0 && results.data.length > 5) {
            return reject(new Error('Nenhuma transação de crédito foi encontrada no arquivo do Bradesco (Formato 2). Verifique se o arquivo é um extrato válido.'));
        }

        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do Bradesco (Formato 2): ${error.message}`));
      },
    });
  });
};