import { Transaction } from '@/types';
import Papa from 'papaparse';

// Helper para converter moeda no formato "+R$ 23,05"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value
    .replace(/[+R$\s"]/g, '') // remove +, R$, espaços e aspas
    .replace(/\./g, '')       // remove separadores de milhar
    .replace(',', '.')       // troca a vírgula decimal por ponto
    .trim();
  return parseFloat(cleanedValue) || 0;
};

// Helper para formatar data de YYYY-MM-DD para DD/MM/YYYY
const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
}

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
        if (results.errors.length > 0) {
            console.error("Erros no parse do InfinitPay (Formato 3):", results.errors);
        }
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const valorStr = row['Valor']?.trim();

          // Processar apenas transações de crédito (que começam com '+')
          if (valorStr && valorStr.startsWith('+')) {
            const amount = parseCurrency(valorStr);

            if (amount > 0) {
              const tipo = row['Tipo de transação']?.trim() || '';
              const nome = row['Nome']?.trim() || '';
              const detalhe = row['Detalhe']?.trim() || '';
              
              let description = tipo;
              if (nome) description += `: ${nome}`;
              if (detalhe) description += ` (${detalhe})`;
              if (!description) description = 'Descrição não informada';

              const fullTextForCheck = `${description}`.toLowerCase();
              const normalizedDesc = fullTextForCheck.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
                date: formatDate(row['Data']?.trim()),
                description: description,
                amount: amount,
                category: isOwnAccount ? 'non-taxable' : 'taxable',
              };
              
              if (transaction.date) {
                transactions.push(transaction);
              }
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