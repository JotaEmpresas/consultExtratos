import { Transaction } from '@/types';
import Papa from 'papaparse';
import { categorizeTransaction, extractNumbers, normalizeText } from '../utils';

// Helper para converter moeda no formato "1234,56"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value
    .replace(/\./g, '')      // remove separadores de milhar
    .replace(',', '.')      // troca a vírgula decimal por ponto
    .trim();
  return parseFloat(cleanedValue) || 0;
};

export const parseItau = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const lines = fileContent.split('\n');
    const headerRowIndex = lines.findIndex(line => 
      line.startsWith('Data;Lançamento;')
    );

    if (headerRowIndex === -1) {
      return reject(new Error('Cabeçalho do CSV do Itaú não encontrado. Verifique o arquivo.'));
    }

    const csvContent = lines.slice(headerRowIndex).join('\n');

    Papa.parse(csvContent, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const amount = parseCurrency(row['Valor (R$)']);

          const lancamento = row['Lançamento']?.trim() || '';
          const razaoSocial = row['Razão Social']?.trim() || '';
          const doc = row['CPF/CNPJ']?.trim() || '';

          // Ignorar linhas de resumo de saldo
          if (lancamento.toLowerCase().includes('saldo total disponível')) {
            return;
          }

          const description = razaoSocial ? `${lancamento} - ${razaoSocial}` : lancamento;
          
          // Categoriza usando a função centralizada
          const category = categorizeTransaction(
            description,
            companyCnpj,
            cpfList,
            nameList,
            amount
          );

          const transaction: Transaction = {
            id: `itau-${Date.now()}-${index}`,
            date: row['Data']?.trim() || '',
            description: description || 'Descrição não informada',
            amount: amount,
            category,
          };
          
          if (transaction.date) {
            transactions.push(transaction);
          }
        });
        
        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do Itaú: ${error.message}`));
      },
    });
  });
};