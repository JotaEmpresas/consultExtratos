import { Transaction, AnalysisData } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from './ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRightCircle, ArrowLeftCircle, Printer } from 'lucide-react';
import { Badge } from './ui/badge';

interface AnalysisResultProps {
  transactions: Transaction[];
  analysisData: AnalysisData;
  onBack: () => void;
  onToggleCategory: (transactionId: string) => void;
}

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const InteractiveTransactionTable = ({ title, transactions, total, actionButton }: { title: string, transactions: Transaction[], total: number, actionButton: (t: Transaction) => React.ReactNode }) => (
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
                <TableCell className="text-right font-medium">{formatCurrency(t.amount)}</TableCell>
                <TableCell>{actionButton(t)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="font-bold">Total</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </CardContent>
  </Card>
);

const PrintableReport = ({ transactions, analysisData }: { transactions: Transaction[], analysisData: AnalysisData }) => {
  const taxableTransactions = transactions.filter(t => t.category === 'taxable');
  const nonTaxableTransactions = transactions.filter(t => t.category === 'non-taxable');
  const totalTaxableAmount = taxableTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalNonTaxableAmount = nonTaxableTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalInvoices = parseFloat(analysisData.totalInvoices.replace(',', '.')) || 0;
  const difference = totalTaxableAmount - totalInvoices;

  return (
    <div className="hidden print-only">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Relatório de Análise Financeira</h1>
        <p><strong>Empresa (CNPJ):</strong> {analysisData.cnpj}</p>
        <p><strong>Mês de Competência:</strong> {format(analysisData.competenceDate, "MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>

      <div className="grid grid-cols-4 gap-4 text-center mb-8 border p-4 rounded-lg">
        <div><p className="text-sm">Total das Notas</p><p className="font-bold">{formatCurrency(totalInvoices)}</p></div>
        <div><p className="text-sm">Entradas Tributáveis</p><p className="font-bold">{formatCurrency(totalTaxableAmount)}</p></div>
        <div><p className="text-sm">Entradas Não Tributáveis</p><p className="font-bold">{formatCurrency(totalNonTaxableAmount)}</p></div>
        <div><p className="text-sm">Diferença</p><p className="font-bold">{formatCurrency(difference)}</p></div>
      </div>

      <div className="space-y-6">
        <div className="print-card"><CardHeader><CardTitle>Entradas Tributáveis ({taxableTransactions.length})</CardTitle></CardHeader><CardContent><Table>{/* Table content */}</Table></CardContent></div>
        <div className="print-card"><CardHeader><CardTitle>Entradas Não Tributáveis ({nonTaxableTransactions.length})</CardTitle></CardHeader><CardContent><Table>{/* Table content */}</Table></CardContent></div>
      </div>
    </div>
  );
};

export const AnalysisResult = ({ transactions, analysisData, onBack, onToggleCategory }: AnalysisResultProps) => {
  const taxableTransactions = transactions.filter(t => t.category === 'taxable');
  const nonTaxableTransactions = transactions.filter(t => t.category === 'non-taxable');
  const totalTaxableAmount = taxableTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalNonTaxableAmount = nonTaxableTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalInvoices = parseFloat(analysisData.totalInvoices.replace(',', '.')) || 0;
  const difference = totalTaxableAmount - totalInvoices;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="no-print">
        <Card className="shadow-lg border-indigo-100 dark:border-indigo-900">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-semibold">Resultado da Análise</CardTitle>
                <CardDescription>
                  Análise para <strong>{analysisData.cnpj}</strong> referente a <strong>{format(analysisData.competenceDate, "MMMM 'de' yyyy", { locale: ptBR })}</strong>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => window.print()} variant="outline">
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir Relatório
                </Button>
                <Button onClick={onBack} variant="outline">Nova Análise</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg"><p className="text-sm text-muted-foreground">Total das Notas</p><p className="text-2xl font-bold">{formatCurrency(totalInvoices)}</p></div>
            <div className="p-4 bg-green-100 dark:bg-green-900/50 rounded-lg"><p className="text-sm text-muted-foreground">Entradas Tributáveis</p><p className="text-2xl font-bold text-green-600">{formatCurrency(totalTaxableAmount)}</p></div>
            <div className="p-4 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg"><p className="text-sm text-muted-foreground">Entradas Não Tributáveis</p><p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalNonTaxableAmount)}</p></div>
            <div className={`p-4 rounded-lg ${difference > 0 ? 'bg-red-100 dark:bg-red-900/50' : 'bg-blue-100 dark:bg-blue-900/50'}`}><p className="text-sm text-muted-foreground">Diferença</p><p className={`text-2xl font-bold ${difference > 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatCurrency(difference)}</p></div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InteractiveTransactionTable title="Entradas Tributáveis" transactions={taxableTransactions} total={totalTaxableAmount} actionButton={(t) => (<Button variant="ghost" size="icon" onClick={() => onToggleCategory(t.id)} title="Mover para Não Tributável"><ArrowRightCircle className="h-5 w-5 text-yellow-600" /></Button>)} />
          <InteractiveTransactionTable title="Entradas Não Tributáveis" transactions={nonTaxableTransactions} total={totalNonTaxableAmount} actionButton={(t) => (<Button variant="ghost" size="icon" onClick={() => onToggleCategory(t.id)} title="Mover para Tributável"><ArrowLeftCircle className="h-5 w-5 text-green-600" /></Button>)} />
        </div>
      </div>
      <PrintableReport transactions={transactions} analysisData={analysisData} />
    </div>
  );
};