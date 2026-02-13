import { Transaction } from '@/types';
import Papa from 'papaparse';

// Helper para converter moeda no formato "+R$ 1.234,56"
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

export const parseInter = (
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
        
        results.data.forEach((row: any, index: number) => {
          const amountStr = row['Valor']?.trim();

          // Estamos interessados apenas nas entradas (valores positivos)
          if (amountStr && amountStr.startsWith('+')) {
            const amount = parseCurrency(amountStr);

            if (amount > 0) {
              const description = `${row['Tipo de transação']?.trim()}: ${row['Nome']?.trim()}` || 'Descrição não informada';

              const fullTextForCheck = `${description} ${row['Detalhe']?.trim()}`.toLowerCase();
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
                id: `inter-${Date.now()}-${index}`,
                date: formatDate(row['Data']?.trim()),
                description: description,
                amount: amount,
                category: isOwnAccount ? 'non-taxable' : 'taxable',
              };
              
              if (transaction.date && transaction.description) {
                transactions.push(transaction);
              }
            }
          }
        });
        
        if (transactions.length === 0 && results.data.length > 1) {
            return reject(new Error('Nenhuma transação de crédito válida foi encontrada no arquivo do Inter. Verifique o formato do arquivo.'));
        }

        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do Inter: ${error.message}`));
      },
    });
  });
};