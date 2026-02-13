import { Transaction } from '@/types';
import Papa from 'papaparse';

// Helper para converter o formato de moeda do Nubank (ex: "75.00")
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  // O CSV do Nubank usa '.' como separador decimal.
  return parseFloat(value) || 0;
};

export const parseNubank = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any) => {
          const amount = parseCurrency(row['Valor']);

          // Estamos interessados apenas nas entradas (valores positivos)
          if (amount > 0) {
            const description = row['Descrição']?.trim() || 'Descrição não informada';

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
              id: row['Identificador']?.trim() || `nubank-${Date.now()}-${Math.random()}`,
              date: row['Data']?.trim() || '',
              description: description,
              amount: amount,
              category: isOwnAccount ? 'non-taxable' : 'taxable',
            };
            
            // Validação básica
            if (transaction.date && transaction.description) {
              transactions.push(transaction);
            }
          }
        });
        
        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do Nubank: ${error.message}`));
      },
    });
  });
};