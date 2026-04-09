import { Transaction } from '@/types';
import Papa from 'papaparse';
import { categorizeTransaction, extractNumbers, normalizeText } from '../utils';

// Helper para converter moeda no formato "2.000,00 C"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value
    .replace(/\./g, '')      // remove separadores de milhar
    .replace(',', '.')      // troca vírgula decimal por ponto
    .replace(/[ a-zA-Z]/g, '') // remove letras (C/D) e espaços
    .trim();
  return parseFloat(cleanedValue) || 0;
};

export const parseBancoDoBrasil = (
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
        if (results.errors.length > 0) {
            console.error("Erros no parse do Banco do Brasil:", results.errors);
        }
        const transactions: Transaction[] = [];
        
        const headers = results.meta.fields || [];
        const dataHeader = headers.find(h => h.toLowerCase().includes('data')) || 'Data';
        const lancamentoHeader = headers.find(h => h.toLowerCase().includes('lan')) || 'Lançamento';
        const detalhesHeader = headers.find(h => h.toLowerCase().includes('detalhes')) || 'Detalhes';
        const valorHeader = headers.find(h => h.toLowerCase().includes('valor')) || 'Valor';

        results.data.forEach((row: any, index: number) => {
          const valorStr = row[valorHeader]?.trim();
          
          if (valorStr && valorStr.endsWith('C')) {
            const amount = parseCurrency(valorStr);

            if (amount > 0) {
              const lancamento = row[lancamentoHeader]?.trim() || '';
              const detalhes = row[detalhesHeader]?.trim() || '';
              
              // Exclui linhas de saldo
              if (lancamento.toLowerCase().includes('saldo total disponível') || 
                  lancamento.toLowerCase().includes('saldo anterior')) {
                return;
              }

              const description = detalhes ? `${lancamento}: ${detalhes}` : lancamento;
              
              // Categoriza usando a função centralizada
              const category = categorizeTransaction(
                description,
                companyCnpj,
                cpfList,
                nameList,
                amount
              );

              const transaction: Transaction = {
                id: `bb-${Date.now()}-${index}`,
                date: row[dataHeader]?.trim() || '',
                description: description || 'Descrição não informada',
                amount: amount,
                category,
              };
              
              if (transaction.date) {
                transactions.push(transaction);
              }
            }
          }
        });
        
        if (transactions.length === 0 && results.data.length > 1) {
            return reject(new Error('Nenhuma transação de crédito válida foi encontrada no arquivo do Banco do Brasil. Verifique o formato do arquivo.'));
        }

        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do Banco do Brasil: ${error.message}`));
      },
    });
  });
};