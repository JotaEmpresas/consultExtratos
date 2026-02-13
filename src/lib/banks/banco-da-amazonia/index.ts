
import { z } from 'zod';
import { TransactionSchema } from '@/types';

const BancoDaAmazoniaTransactionSchema = z.object({
  DATA: z.string(),
  DESCRICAO_HISTORICO: z.string(),
  VALOR: z.string(),
  DC: z.string(),
});

type BancoDaAmazoniaTransaction = z.infer<typeof BancoDaAmazoniaTransactionSchema>;

function parseAmount(value: string, dc: string): number {
  const cleanedValue = value.replace(/\./g, '').replace(',', '.');
  const amount = parseFloat(cleanedValue);
  return dc === 'D' ? -amount : amount;
}

export const bancoDaAmazoniaParser = {
  name: 'Banco da Amazônia',
  test: (content: string): boolean => {
    return content.includes('SALDO_DISPONIVEL_INIC');
  },
  parse: (content: string): z.infer<typeof TransactionSchema>[] => {
    const lines = content.trim().split('
');
    const header = lines.shift()?.split(',') ?? [];
    
    const requiredColumns = ['DATA', 'DESCRICAO_HISTORICO', 'VALOR', 'DC', 'SALDO_DISPONIVEL_INIC'];
    if (!requiredColumns.every(col => header.includes(col))) {
      throw new Error('Arquivo CSV do Banco da Amazônia inválido. Colunas esperadas não encontradas.');
    }

    const dataIndex = header.indexOf('DATA');
    const descriptionIndex = header.indexOf('DESCRICAO_HISTORICO');
    const valueIndex = header.indexOf('VALOR');
    const dcIndex = header.indexOf('DC');

    const transactions: BancoDaAmazoniaTransaction[] = lines.map(line => {
      const values = line.split(',');
      return {
        DATA: values[dataIndex],
        DESCRICAO_HISTORICO: values[descriptionIndex],
        VALOR: values[valueIndex],
        DC: values[dcIndex],
      };
    }).filter(t => t.DATA && t.DESCRICAO_HISTORICO && t.VALOR && t.DC);

    return transactions.map(t => ({
      date: t.DATA,
      description: t.DESCRICAO_HISTORICO,
      amount: parseAmount(t.VALOR, t.DC),
    }));
  },
};
