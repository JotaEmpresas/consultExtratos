import { Transaction } from '@/types';
import Papa from 'papaparse';

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
        
        results.data.forEach((row: string[], index: number) => {
          // O CSV do Bradesco pode ter linhas de cabeçalho/rodapé. Uma linha de transação válida começa com uma data.
          const dateStr = row[0]?.trim();
          if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            return; // Ignora a linha se a primeira coluna não for uma data no formato DD/MM/YYYY
          }

          // Índices das colunas: 0:Data, 1:Lançamento, 3:Crédito
          const creditStr = row[3];
          const amount = parseCurrency(creditStr);

          // Processa apenas transações de crédito (valores positivos)
          if (amount > 0) {
            const description = row[1]?.trim() || 'Descrição não informada';

            const normalizedDesc = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const numbersOnlyDesc = normalizedDesc.replace(/[^0-9]/g, '');

            const cleanedCnpj = companyCnpj.replace(/\D/g, '');
            const cleanedCpfList = cpfList.map(cpf => cpf.replace(/\D/g, '').filter(Boolean));
            const cleanedNameList = nameList.map(name => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()).filter(Boolean);

            const isOwnAccount = 
              (cleanedCnpj && numbersOnlyDesc.includes(cleanedCnpj)) ||
              cleanedCpfList.some(cpf => cpf && numbersOnlyDesc.includes(cpf)) ||
              cleanedNameList.some(name => name && normalizedDesc.includes(name));

            const transaction: Transaction = {
              id: `bradesco-${Date.now()}-${index}`,
              date: dateStr,
              description: description,
              amount: amount,
              category: isOwnAccount ? 'non-taxable' : 'taxable',
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