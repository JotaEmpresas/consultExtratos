import { parse } from 'ofx-js';
import { Transaction } from '@/types';

// Helper to format OFX date (YYYYMMDD...) to DD/MM/YYYY
const formatDate = (ofxDate: string): string => {
  if (!ofxDate || ofxDate.length < 8) {
    return '';
  }
  const year = ofxDate.substring(0, 4);
  const month = ofxDate.substring(4, 6);
  const day = ofxDate.substring(6, 8);
  return `${day}/${month}/${year}`;
};

export const parseSicoob = async (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  try {
    const ofxData = await parse(fileContent);
    const statement = ofxData.OFX.BANKMSGSRSV1?.STMTTRNRS?.STMTRS;
    const transactions = statement?.BANKTRANLIST?.STMTTRN;

    if (!transactions || !Array.isArray(transactions)) {
      throw new Error('Formato de arquivo Sicoob inválido: transações não encontradas.');
    }

    // Filtra apenas créditos e mapeia
    const parsedTransactions: Transaction[] = [];

    transactions.forEach((t: any, index: number) => {
      if (t.TRNTYPE !== 'CREDIT') return;

      const amount = parseFloat(t.TRNAMT);
      if (amount <= 0) return;

      // Sicoob usa NAME para o nome do remetente/descrição detalhada e MEMO para o tipo de transação genérico
      const description = t.NAME || t.MEMO || 'Descrição não informada';
      const date = formatDate(t.DTPOSTED);

      const normalizedDesc = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const numbersOnlyDesc = normalizedDesc.replace(/[^0-9]/g, '');

      const cleanedCnpj = companyCnpj.replace(/\D/g, '');
      const cleanedCpfList = cpfList.map(cpf => cpf.replace(/\D/g, '')).filter(Boolean);
      const cleanedNameList = nameList.map(name => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()).filter(Boolean);

      const isOwnAccount = 
        (cleanedCnpj && numbersOnlyDesc.includes(cleanedCnpj)) ||
        cleanedCpfList.some(cpf => cpf && numbersOnlyDesc.includes(cpf)) ||
        cleanedNameList.some(name => name && normalizedDesc.includes(name));

      parsedTransactions.push({
        id: t.FITID || `sicoob-${Date.now()}-${index}`,
        date: date,
        description: description,
        amount: amount,
        category: isOwnAccount ? 'non-taxable' : 'taxable',
        sourceFile: 'Sicoob OFX'
      });
    });

    if (parsedTransactions.length === 0) {
       // Se não encontrou créditos, mas o arquivo foi lido, pode ser apenas que não haja créditos.
       // Mas retornamos array vazio normalmente.
    }

    return parsedTransactions;

  } catch (error) {
    console.error(`Erro ao processar o arquivo OFX do Sicoob:`, error);
    throw new Error(`Erro ao processar o arquivo do Sicoob: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
};
