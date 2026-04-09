import { Transaction } from '@/types';

// Helper para converter moeda no formato "1.234,56" ou "-1.234,56"
const parseCurrency = (value: string | undefined): { amount: number, isDebit: boolean } => {
  if (!value) return { amount: 0, isDebit: false };
  
  const cleaned = value.trim().replace(/\./g, '').replace(',', '.');
  const isDebit = cleaned.startsWith('-');
  const amount = Math.abs(parseFloat(cleaned)) || 0;
  
  return { amount, isDebit };
};

export const parseItau3 = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    try {
      const lines = fileContent.split('\n').map(line => 
        line.replace(/^"|"$/g, '') // Remove quotes das extremidades
      );

      // Encontra a linha de header (contém "Data" e "Lançamentos")
      let headerIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Data') && lines[i].includes('Lançamentos')) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) {
        throw new Error('Não foi encontrada a linha de header esperada (Data, Lançamentos...)');
      }

      const transactions: Transaction[] = [];
      const dataLines = lines.slice(headerIndex + 1);

      // Reagrupa linhas que pertencem à mesma transação
      const groupedLines: string[][] = [];
      let currentGroup: string[] = [];

      const dateRegex = /^(\d{2}\/\d{2}\/\d{4})/;

      dataLines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return; // Pula linhas vazias

        if (dateRegex.test(trimmedLine)) {
          // Nova transação começando
          if (currentGroup.length > 0) {
            groupedLines.push(currentGroup);
          }
          currentGroup = [trimmedLine];
        } else if (currentGroup.length > 0) {
          // Continuação da transação anterior
          currentGroup.push(trimmedLine);
        }
      });

      // Adiciona o último grupo
      if (currentGroup.length > 0) {
        groupedLines.push(currentGroup);
      }

      // Processa cada grupo de linhas
      groupedLines.forEach(group => {
        if (group.length === 0) return;

        const firstLine = group[0];
        const dateMatch = firstLine.match(dateRegex);

        if (!dateMatch) return;

        const date = dateMatch[1];
        let fullText = group.join(' ');

        // Extrai valor (último padrão de moeda na linha)
        const amountRegex = /(-?\d{1,3}(?:\.\d{3})*,\d{2})/g;
        const matches = fullText.match(amountRegex);
        
        if (!matches || matches.length === 0) {
          return; // Pula se não encontrar valor
        }

        // O último valor é geralmente o correto (não é saldo)
        // Mas temos que ser cuidadoso: se houver dois valores, o primeiro é a transação, o segundo é saldo
        let amount = 0;
        let isDebit = false;
        let valueUsed = matches[0];

        if (matches.length >= 2) {
          // Se houver 2 valores, usa o primeiro (transação), não o segundo (saldo)
          valueUsed = matches[0];
        } else {
          valueUsed = matches[matches.length - 1];
        }

        const { amount: parsedAmount, isDebit: parsedIsDebit } = parseCurrency(valueUsed);
        amount = parsedAmount;
        isDebit = parsedIsDebit;

        // Limpa descrição removendo data, valores e espaços extras
        let description = firstLine.replace(dateRegex, '').trim();
        description = description.replace(amountRegex, '').trim();
        description = description.replace(/\s+/g, ' '); // Normaliza espaços

        // Adiciona linhas subsequentes à descrição
        for (let i = 1; i < group.length; i++) {
          let extraLine = group[i].replace(amountRegex, '').trim();
          if (extraLine && !extraLine.toLowerCase().includes('saldo')) {
            description += ' ' + extraLine;
          }
        }

        // Limpa descrição final
        description = description.replace(/\s+/g, ' ').trim();

        // Pula transações que são apenas "Saldo"
        if (description.toLowerCase().includes('saldo') && description.split(' ').length <= 3) {
          return;
        }

        const transaction: Transaction = {
          id: `itau3-${Date.now()}-${Math.random()}`,
          date,
          description,
          amount,
          category: 'taxable'
        };

        transactions.push(transaction);
      });

      // Pós-processamento: Classificação
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
    } catch (error) {
      reject(new Error(`Erro ao processar o CSV do Itaú (Formato 3): ${error instanceof Error ? error.message : String(error)}`));
    }
  });
};