import { Transaction, AnalysisData } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from './ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRightCircle, ArrowLeftCircle } from 'lucide-react';
import { Badge } from './ui/badge';

interface AnalysisResultProps {
  transactions: Transaction[];
  analysisData: AnalysisData;
  onBack: () => void;
  onToggleCategory: (transactionId: string) => void;
}

const TransactionTable = ({ title, transactions, actionButton }: { title: string, transactions: Transaction[], actionButton: (t: Transaction) => React.ReactNode }) => (
  <Card className="shadow-lg border-indigo-100 dark:border-indigo-900">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">{title} <Badge variant="secondary">{transactions.length}</Badge></CardTitle>
    </CardHeader>
    <CardContent>
      <div className="max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.date}</TableCell>
                <TableCell>{t.description}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.sourceFile}</TableCell>
                <TableCell className="text-right font-medium">{t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                <TableCell>{actionButton(t)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
);

export const AnalysisResult = ({ transactions, analysisData, onBack, onToggleCategory }: AnalysisResultProps) => {
  const taxableTransactions = transactions.filter(t => t.category === 'taxable');
  const nonTaxableTransactions = transactions.filter(t => t.category === 'non-taxable');

  const totalTaxableAmount = taxableTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalNonTaxableAmount = nonTaxableTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalInvoices = parseFloat(analysisData.totalInvoices.replace(',', '.')) || 0;
  const difference = totalTaxableAmount - totalInvoices;

  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <Card className="shadow-lg border-indigo-100 dark:border-indigo-900">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl font-semibold">Resultado da Análise</CardTitle>
            <CardDescription>
              Análise para {analysisData.cnpj} referente a {format(analysisData.competenceDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </CardDescription>
          </div>
          <Button onClick={onBack} variant="outline">Nova Análise</Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-muted-foreground">Total das Notas</p>
            <p className="text-2xl font-bold">{formatCurrency(totalInvoices)}</p>
          </div>
          <div className="p-4 bg-green-100 dark:bg-green-900/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Entradas Tributáveis</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalTaxableAmount)}</p>
          </div>
          <div className="p-4 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Entradas Não Tributáveis</p>
            <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalNonTaxableAmount)}</p>
          </div>
          <div className={`p-4 rounded-lg ${difference > 0 ? 'bg-red-100 dark:bg-red-900/50' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
            <p className="text-sm text-muted-foreground">Diferença</p>
            <p className={`text-2xl font-bold ${difference > 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatCurrency(difference)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TransactionTable 
          title="Entradas Tributáveis"
          transactions={taxableTransactions}
          actionButton={(t) => (
            <Button variant="ghost" size="icon" onClick={() => onToggleCategory(t.id)} title="Mover para Não Tributável">
              <ArrowRightCircle className="h-5 w-5 text-yellow-600" />
            </Button>
          )}
        />
        <TransactionTable 
          title="Entradas Não Tributáveis"
          transactions={nonTaxableTransactions}
          actionButton={(t) => (
            <Button variant="ghost" size="icon" onClick={() => onToggleCategory(t.id)} title="Mover para Tributável">
              <ArrowLeftCircle className="h-5 w-5 text-green-600" />
            </Button>
          )}
        />
      </div>
    </div>
  );
};