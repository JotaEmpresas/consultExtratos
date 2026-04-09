import { Transaction } from '@/types';
import Papa from 'papaparse';
import { categorizeTransaction, extractNumbers, normalizeText } from '../utils';

// Helper para converter moeda no formato "10.000,00"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value.replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(cleanedValue) || 0;
};

export const parseBradesco = (
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
        
        results.data.forEach((row: any, index: number) => {
          // O CSV do Bradesco pode ter linhas de cabeçalho/rodapé. Uma linha de transação válida começa com uma data.
          const dateStr = Array.isArray(row) ? row[0]?.trim() : undefined;
          if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            return; // Ignora a linha se a primeira coluna não for uma data no formato DD/MM/YYYY
          }

          // Índices das colunas: 0:Data, 1:Lançamento, 3:Crédito
          const creditStr = Array.isArray(row) ? row[3] : undefined;
          const amount = parseCurrency(creditStr);

          // Processa apenas transações de crédito (valores positivos)
          if (amount > 0) {
            const description = (Array.isArray(row) ? row[1]?.trim() : '') || 'Descrição não informada';

            // Categoriza usando a função centralizada
            const category = categorizeTransaction(
              description,
              companyCnpj,
              cpfList,
              nameList,
              amount
            );

            const transaction: Transaction = {
              id: `bradesco-${Date.now()}-${index}`,
              date: dateStr,
              description: description,
              amount: amount,
              category,
            };
            
            transactions.push(transaction);
          }
        });
        
        if (transactions.length === 0 && results.data.length > 0) {
            return reject(new Error('Nenhuma transação de crédito foi encontrada no arquivo do Bradesco. Verifique se o arquivo é um extrato válido e se as colunas estão na ordem esperada (Data, Lançamento, ..., Crédito).'));
        }

        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do Bradesco: ${error.message}`));
      },
    });
  });
};