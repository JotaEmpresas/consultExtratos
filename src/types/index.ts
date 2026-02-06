export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  sourceFile: string;
}

export interface AnalysisData {
  cnpj: string;
  cpf: string;
  totalInvoices: string;
  competenceDate: Date;
}