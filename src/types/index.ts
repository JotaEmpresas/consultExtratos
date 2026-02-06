export type TransactionCategory = 'taxable' | 'non-taxable';

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  sourceFile: string;
  category: TransactionCategory;
}

export interface AnalysisData {
  cnpj: string;
  cpf: string;
  totalInvoices: string;
  competenceDate: Date;
}