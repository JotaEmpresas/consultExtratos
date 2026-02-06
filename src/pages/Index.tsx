import { useState } from "react";
import { AnalysisForm } from "@/components/AnalysisForm";
import { AnalysisResult } from "@/components/AnalysisResult";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { parseCsvFiles } from "@/lib/csvParser";
import { showError, showSuccess } from "@/utils/toast";
import { Transaction, AnalysisData } from "@/types";

type AnalysisStep = 'input' | 'result';

const Index = () => {
  const [step, setStep] = useState<AnalysisStep>('input');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcessAnalysis = async (data: AnalysisData, files: File[]) => {
    setIsProcessing(true);
    try {
      const parsedTransactions = await parseCsvFiles(files);
      
      parsedTransactions.sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('');
        const dateB = b.date.split('/').reverse().join('');
        return dateA.localeCompare(dateB);
      });

      setTransactions(parsedTransactions);
      setAnalysisData(data);
      setStep('result');
      showSuccess("Análise concluída com sucesso!");
    } catch (error) {
      console.error("Erro ao processar arquivos:", error);
      showError("Ocorreu um erro ao processar os arquivos.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleTransactionCategory = (transactionId: string) => {
    setTransactions(prevTransactions =>
      prevTransactions.map(t =>
        t.id === transactionId
          ? { ...t, category: t.category === 'taxable' ? 'non-taxable' : 'taxable' }
          : t
      )
    );
  };

  const handleNewAnalysis = () => {
    setStep('input');
    setTransactions([]);
    setAnalysisData(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      <header className="py-4">
        <h1 className="text-3xl font-bold text-center text-indigo-600 dark:text-indigo-400">
          Analisador de Extratos
        </h1>
      </header>
      <main className="flex-grow container mx-auto p-4 md:p-8">
        {step === 'input' && (
          <AnalysisForm onSubmit={handleProcessAnalysis} isProcessing={isProcessing} />
        )}
        {step === 'result' && analysisData && (
          <AnalysisResult 
            transactions={transactions} 
            analysisData={analysisData}
            onBack={handleNewAnalysis}
            onToggleCategory={handleToggleTransactionCategory}
          />
        )}
      </main>
      <footer className="py-4">
        <MadeWithDyad />
      </footer>
    </div>
  );
};

export default Index;