import { Transaction, AnalysisData } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from './ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRightCircle, ArrowLeftCircle, Printer, Banknote } from 'lucide-react';
import { Badge } from './ui/badge';

interface AnalysisResultProps {
  transactions: Transaction[];
  analysisData: AnalysisData;
  onBack: () => void;
  onToggleCategory: (transactionId: string) => void;
}

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const InteractiveTransactionTable = ({ title, transactions, total, actionButton }: { title: string, transactions: Transaction[], total: number, actionButton: (t: Transaction) => React.ReactNode }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center gap-2 text-base">{title} <Badge variant="secondary">{transactions.length}</Badge></CardTitle>
    </CardHeader>
    <CardContent>
      <div className="max-h-[300px] overflow-y-auto relative">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead className="w-[100px]">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-xs">{t.date}</TableCell>
                <TableCell className="text-sm">{t.description}</TableCell>
                <TableCell className="text-right font-medium text-sm">{formatCurrency(t.amount)}</TableCell>
                <TableCell>{actionButton(t)}</TableCell>
              </TableRow>
            ))}
             {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground h-24">Nenhuma transação</TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-bold">Total</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </CardContent>
  </Card>
);

const PrintableTable = ({ title, transactions, total }: { title: string, transactions: Transaction[], total: number }) => (
  <div>
    <h3 className="text-lg font-semibold mb-2">{title} ({transactions.length})</h3>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead className="text-right">Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map(t => (
          <TableRow key={t.id}>
            <TableCell>{t.date}</TableCell>
            <TableCell>{t.description}</TableCell>
            <TableCell className="text-right">{formatCurrency(t.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2} className="font-bold">Total</TableCell>
          <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  </div>
);

const PrintableReport = ({ transactions, analysisData }: { transactions: Transaction[], analysisData: AnalysisData }) => {
  const totalTaxableAmount = transactions.filter(t => t.category === 'taxable').reduce((sum, t) => sum + t.amount, 0);
  const totalNonTaxableAmount = transactions.filter(t => t.category === 'non-taxable').reduce((sum, t) => sum + t.amount, 0);
  const totalInvoices = parseFloat(analysisData.totalInvoices.replace(',', '.')) || 0;
  const difference = totalTaxableAmount - totalInvoices;

  const groupedByBank = transactions.reduce((acc, t) => {
    const key = t.sourceFile;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Transaction[]>);

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

      <div className="space-y-8">
        {Object.entries(groupedByBank).map(([bankName, bankTransactions]) => {
          const taxable = bankTransactions.filter(t => t.category === 'taxable');
          const nonTaxable = bankTransactions.filter(t => t.category === 'non-taxable');
          const totalTaxable = taxable.reduce((sum, t) => sum + t.amount, 0);
          const totalNonTaxable = nonTaxable.reduce((sum, t) => sum + t.amount, 0);

          return (
            <div key={bankName} className="p-4 border rounded-lg break-inside-avoid">
              <h2 className="text-xl font-bold mb-4 border-b pb-2">{bankName}</h2>
              <div className="space-y-6">
                {taxable.length > 0 && <PrintableTable title="Entradas Tributáveis" transactions={taxable} total={totalTaxable} />}
                {nonTaxable.length > 0 && <PrintableTable title="Entradas Não Tributáveis" transactions={nonTaxable} total={totalNonTaxable} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const AnalysisResult = ({ transactions, analysisData, onBack, onToggleCategory }: AnalysisResultProps) => {
  const totalTaxableAmount = transactions.filter(t => t.category === 'taxable').reduce((sum, t) => sum + t.amount, 0);
  const totalNonTaxableAmount = transactions.filter(t => t.category === 'non-taxable').reduce((sum, t) => sum + t.amount, 0);
  const totalInvoices = parseFloat(analysisData.totalInvoices.replace(',', '.')) || 0;
  const difference = totalTaxableAmount - totalInvoices;

  const groupedByBank = transactions.reduce((acc, t) => {
    const key = t.sourceFile;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Transaction[]>);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="no-print">
        <Card className="shadow-lg border-indigo-100 dark:border-indigo-900">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-semibold">Resultado da Análise Geral</CardTitle>
                <CardDescription>
                  Análise para <strong>{analysisData.cnpj}</strong> referente a <strong>{format(analysisData.competenceDate, "MMMM 'de' yyyy", { locale: ptBR })}</strong>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => window.print()} variant="outline"><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
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
        
        <div className="space-y-8">
          {Object.entries(groupedByBank).map(([bankName, bankTransactions]) => {
            const taxable = bankTransactions.filter(t => t.category === 'taxable');
            const nonTaxable = bankTransactions.filter(t => t.category === 'non-taxable');
            const totalTaxable = taxable.reduce((sum, t) => sum + t.amount, 0);
            const totalNonTaxable = nonTaxable.reduce((sum, t) => sum + t.amount, 0);

            return (
              <Card key={bankName} className="shadow-lg border-gray-200 dark:border-gray-700 overflow-hidden">
                <CardHeader className="bg-gray-50 dark:bg-gray-900/50">
                  <CardTitle className="flex items-center gap-3 text-lg font-semibold text-indigo-700 dark:text-indigo-400">
                    <Banknote className="h-6 w-6" /> {bankName}
                  </CardTitle>
                  <CardDescription>
                    Total do extrato: <span className="font-semibold text-foreground">{formatCurrency(totalTaxable + totalNonTaxable)}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <InteractiveTransactionTable title="Entradas Tributáveis" transactions={taxable} total={totalTaxable} actionButton={(t) => (<Button variant="ghost" size="icon" onClick={() => onToggleCategory(t.id)} title="Mover para Não Tributável"><ArrowRightCircle className="h-5 w-5 text-yellow-600" /></Button>)} />
                  <InteractiveTransactionTable title="Entradas Não Tributáveis" transactions={nonTaxable} total={totalNonTaxable} actionButton={(t) => (<Button variant="ghost" size="icon" onClick={() => onToggleCategory(t.id)} title="Mover para Tributável"><ArrowLeftCircle className="h-5 w-5 text-green-600" /></Button>)} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <PrintableReport transactions={transactions} analysisData={analysisData} />
    </div>
  );
};