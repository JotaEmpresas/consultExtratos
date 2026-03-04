import { Transaction } from '@/types';
import Papa from 'papaparse';

// Helper para converter moeda no formato "1.234,56" ou "-1.234,56"
const parseCurrency = (value: string | undefined): { amount: number, isDebit: boolean } => {
  if (!value) return { amount: 0, isDebit: false };
  
  const cleaned = value.trim().replace(/\./g, '').replace(',', '.');
  const isDebit = cleaned.startsWith('-');
  const amount = Math.abs(parseFloat(cleaned)) || 0;
  
  return { amount, isDebit };
};

export const parseItau2 = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        let currentTx: Partial<Transaction> & { isDebit?: boolean } | null = null;

        const dateRegex = /^(\d{2}\/\d{2}\/\d{4})/;
        const amountRegex = /(-?\d{1,3}(?:\.\d{3})*,\d{2})$/;
        const cnpjRegex = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;

        results.data.forEach((row: any) => {
          const cells = row.map((c: any) => String(c || '').trim()).filter(Boolean);
          if (cells.length === 0) return;

          // Verifica se a primeira célula começa com uma data
          const dateMatch = cells[0].match(dateRegex);

          if (dateMatch) {
            // Se já tínhamos uma transação pendente, salva se for crédito
            if (currentTx && currentTx.date && !currentTx.isDebit && currentTx.amount && currentTx.amount > 0) {
              if (!currentTx.description?.toLowerCase().includes('saldo')) {
                transactions.push(currentTx as Transaction);
              }
            }

            const date = dateMatch[1];
            let initialDesc = cells[0].replace(date, '').trim();
            
            currentTx = {
              id: `itau2-${Date.now()}-${Math.random()}`,
              date,
              description: initialDesc,
              amount: 0,
              isDebit: false,
              category: 'taxable'
            };

            // Tenta achar o valor nas outras células desta mesma linha
            for (let i = 1; i < cells.length; i++) {
              const cell = cells[i];
              const amtMatch = cell.match(amountRegex);
              if (amtMatch) {
                const { amount, isDebit } = parseCurrency(amtMatch[1]);
                currentTx.amount = amount;
                currentTx.isDebit = isDebit;
                // Remove o valor da descrição se ele estiver lá
                if (i === 0) currentTx.description = initialDesc.replace(amtMatch[1], '').trim();
                break;
              }
            }
          } else if (currentTx) {
            // Se não é uma nova data, é continuação da descrição ou o valor final
            cells.forEach((cell: string) => {
              const amtMatch = cell.match(amountRegex);
              if (amtMatch) {
                const { amount, isDebit } = parseCurrency(amtMatch[1]);
                currentTx!.amount = amount;
                currentTx!.isDebit = isDebit;
                
                // Se o valor estava colado num CNPJ, limpa a descrição
                let cleanPart = cell.replace(amtMatch[1], '').trim();
                if (cleanPart) currentTx!.description += ' ' + cleanPart;
              } else {
                currentTx!.description += ' ' + cell;
              }
            });
          }
        });

        // Salva a última transação
        if (currentTx && currentTx.date && !currentTx.isDebit && currentTx.amount && currentTx.amount > 0) {
          if (!currentTx.description?.toLowerCase().includes('saldo')) {
            transactions.push(currentTx as Transaction);
          }
        }

        // Pós-processamento: Classificação e limpeza de descrição
        const finalTransactions = transactions.map(t => {
          const normalizedDesc = t.description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const numbersOnlyDesc = normalizedDesc.replace(/[^0-9]/g, '');

          const cleanedCnpj = companyCnpj.replace(/\D/g, '');
          const cleanedCpfList = cpfList.map(cpf => cpf.replace(/\D/g, '')).filter(Boolean);
          const cleanedNameList = nameList.map(name => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()).filter(Boolean);

          const isOwnAccount = 
            (cleanedCnpj && numbersOnlyDesc.includes(cleanedCnpj)) ||
            cleanedCpfList.some(cpf => cpf && numbersOnlyDesc.includes(cpf)) ||
            cleanedNameList.some(name => name && normalizedDesc.includes(name));

          return {
            ...t,
            category: isOwnAccount ? 'non-taxable' : 'taxable'
          };
        });

        resolve(finalTransactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do Itaú (Formato 2): ${error.message}`));
      },
    });
  });
};