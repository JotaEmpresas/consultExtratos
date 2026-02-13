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
  partnerNames: string;
  totalInvoices: string;
  competenceDate: Date;
}

export interface AiAnalysisResult {
  analise: string;
  "lista de Valores Tributados": Transaction[];
  "Lista de Valores Possíveis não Tributáveis": Transaction[];
  "legislação bse de conhecimento": string;
}