
import { z } from 'zod';
import { Transaction, TransactionSchema } from '@/types';
import { bancoDaAmazoniaParser } from './banks';

const parsers = [bancoDaAmazoniaParser];

export function parseFileContent(content: string): z.infer<typeof TransactionSchema>[] {
  const parser = parsers.find(p => p.test(content));

  if (!parser) {
    // Retornar um array vazio se nenhum parser for encontrado? 
    // Ou lançar um erro? Por enquanto, vamos retornar vazio.
    console.warn("Nenhum parser encontrado para o conteúdo do arquivo.");
    return [];
  }

  try {
    return parser.parse(content);
  } catch (error) {
    console.error(`Erro ao processar o arquivo com o parser '${parser.name}':`, error);
    // Em caso de erro no parser, retorna vazio para não quebrar a aplicação
    return [];
  }
}
