import { Transaction } from '@/types';
import Papa from 'papaparse';

// Helper para converter moeda no formato "1.234,56"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value
    .replace(/\./g, '')      // remove separadores de milhar
    .replace(',', '.')      // troca a vírgula decimal por ponto
    .trim();
  return parseFloat(cleanedValue) || 0;
};

export const parseInfinitPay3 = (
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
        
        // Os cabeçalhos podem variar, então tentamos encontrá-los de forma flexível
        const headers = results.meta.fields || [];
        const dateHeader = headers.find(h => h.toLowerCase().includes('data')) || 'Data';
        const descriptionHeader = headers.find(h => h.toLowerCase().includes('descri') || h.toLowerCase().includes('hist')) || 'Descrição';
        const valueHeader = headers.find(h => h.toLowerCase().includes('valor') || h.toLowerCase().includes('crédito')) || 'Valor';

        results.data.forEach((row: any, index: number) => {
          const amount = parseCurrency(row[valueHeader]);

          // Processar apenas transações de crédito (valores positivos)
          if (amount > 0) {
            const description = row[descriptionHeader]?.trim() || 'Descrição não informada';
            
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
              id: `infinitpay3-${Date.now()}-${index}`,
              date: row[dateHeader]?.trim() || '',
              description: description,
              amount: amount,
              category: isOwnAccount ? 'non-taxable' : 'taxable',
            };
            
            if (transaction.date) {
              transactions.push(transaction);
            }
          }
        });
        
        if (transactions.length === 0 && results.data.length > 1) {
            return reject(new Error('Nenhuma transação de crédito válida foi encontrada no arquivo do InfinitPay (Formato 3). Verifique o formato do arquivo.'));
        }

        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do InfinitPay (Formato 3): ${error.message}`));
      },
    });
  });
};