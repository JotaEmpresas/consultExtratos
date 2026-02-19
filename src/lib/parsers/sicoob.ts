import { Transaction } from '@/types';

// Helper para formatar data ISO (2026-01-30T00:00:00Z) ou OFX (20260130...) para DD/MM/YYYY
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  
  // Tenta formato ISO (YYYY-MM-DD...)
  if (dateStr.includes('-')) {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  
  // Tenta formato OFX padrão (YYYYMMDD...)
  if (dateStr.length >= 8) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}/${month}/${year}`;
  }

  return dateStr;
};

export const parseSicoob = async (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve) => {
    try {
      const transactions: Transaction[] = [];
      
      // Regex para encontrar blocos de transação <STMTTRN>...</STMTTRN>
      // O flag 's' (dotAll) permite que o . case com quebras de linha
      const transactionRegex = /<STMTTRN>(.*?)<\/STMTTRN>/gs;
      
      let match;
      let index = 0;

      while ((match = transactionRegex.exec(fileContent)) !== null) {
        const block = match[1];

        // Extrai os campos individuais do bloco
        const typeMatch = /<TRNTYPE>(.*?)(\r|\n|<)/.exec(block);
        const type = typeMatch ? typeMatch[1].trim() : '';

        // Só queremos créditos
        if (type !== 'CREDIT') continue;

        const amtMatch = /<TRNAMT>(.*?)(\r|\n|<)/.exec(block);
        const amount = amtMatch ? parseFloat(amtMatch[1].trim()) : 0;

        if (amount <= 0) continue;

        const dateMatch = /<DTPOSTED>(.*?)(\r|\n|<)/.exec(block);
        const dateRaw = dateMatch ? dateMatch[1].trim() : '';
        const date = formatDate(dateRaw);

        const nameMatch = /<NAME>(.*?)(\r|\n|<)/.exec(block);
        const memoMatch = /<MEMO>(.*?)(\r|\n|<)/.exec(block);
        const fitidMatch = /<FITID>(.*?)(\r|\n|<)/.exec(block);

        // Sicoob geralmente coloca o nome de quem pagou em NAME e o tipo (PIX RECEBIDO) em MEMO
        // Vamos priorizar NAME para descrição, ou juntar os dois se necessário
        const nameVal = nameMatch ? nameMatch[1].trim() : '';
        const memoVal = memoMatch ? memoMatch[1].trim() : '';
        
        const description = nameVal || memoVal || 'Descrição não informada';
        const fitid = fitidMatch ? fitidMatch[1].trim() : `sicoob-${Date.now()}-${index}`;

        // Lógica de classificação (Tributável vs Não Tributável)
        const normalizedDesc = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const numbersOnlyDesc = normalizedDesc.replace(/[^0-9]/g, '');

        const cleanedCnpj = companyCnpj.replace(/\D/g, '');
        const cleanedCpfList = cpfList.map(cpf => cpf.replace(/\D/g, '')).filter(Boolean);
        const cleanedNameList = nameList.map(name => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()).filter(Boolean);

        const isOwnAccount = 
          (cleanedCnpj && numbersOnlyDesc.includes(cleanedCnpj)) ||
          cleanedCpfList.some(cpf => cpf && numbersOnlyDesc.includes(cpf)) ||
          cleanedNameList.some(name => name && normalizedDesc.includes(name));

        transactions.push({
          id: fitid,
          date: date,
          description: description,
          amount: amount,
          category: isOwnAccount ? 'non-taxable' : 'taxable',
          sourceFile: 'Sicoob OFX'
        });

        index++;
      }

      if (transactions.length === 0) {
         console.warn("Parser Sicoob: Nenhuma transação encontrada via Regex.");
      }

      resolve(transactions);

    } catch (error) {
      console.error(`Erro ao processar o arquivo OFX do Sicoob:`, error);
      // Retornamos array vazio em caso de erro fatal no parser manual, para não quebrar a Promise chain
      resolve([]);
    }
  });
};