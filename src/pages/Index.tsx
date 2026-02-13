import { useState } from "react";
import { AnalysisForm } from "@/components/AnalysisForm";
import { AnalysisResult } from "@/components/AnalysisResult";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { parsers } from "@/lib/parserRegistry";
import { readFilesForWebhook } from "@/lib/fileReader";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { Transaction, AnalysisData, AiProcessingResponse } from "@/types";
import { SettingsSheet } from "@/components/SettingsSheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type AnalysisStep = 'input' | 'result';

const Index = () => {
  const [step, setStep] = useState<AnalysisStep>('input');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiAnalysisText, setAiAnalysisText] = useState<string>("");
  const [corsError, setCorsError] = useState(false);

  const getWebhookUrl = (type: 'prod' | 'test') => {
    const prodUrl = localStorage.getItem('prodWebhookUrl') || 'https://jota-empresas-n8n.ubjifz.easypanel.host/webhook/bd95e5ce-4ebf-48c9-b823-ad8b57429c7e';
    const testUrl = localStorage.getItem('testWebhookUrl') || 'https://jota-empresas-n8n.ubjifz.easypanel.host/webhook-test/bd95e5ce-4ebf-48c9-b823-ad8b57429c7e';
    return type === 'test' ? testUrl : prodUrl;
  };

  const handleProcessAnalysis = async (data: AnalysisData, files: File[]) => {
    setIsProcessing(true);
    setCorsError(false);
    let toastId = showLoading("Processando arquivos...");

    try {
      const parser = parsers[data.bank];
      if (!parser) {
        throw new Error(`Parser para o banco selecionado (${data.bank}) não foi encontrado.`);
      }

      const filesContent = await readFilesForWebhook(files);
      if (filesContent.length === 0) throw new Error("Nenhum arquivo pôde ser lido.");

      const cpfList = data.cpf.split(',').map(s => s.trim()).filter(Boolean);
      const nameList = data.partnerNames.split(',').map(s => s.trim()).filter(Boolean);

      let allTransactions: Transaction[] = [];
      for (const file of filesContent) {
        try {
          const parsedTransactions = await parser(file.content, data.cnpj, cpfList, nameList);
          // Add source file info to each transaction
          const transactionsWithSource = parsedTransactions.map((t, i) => ({ ...t, id: t.id || `${file.fileName}-${i}`, sourceFile: file.fileName }));
          allTransactions.push(...transactionsWithSource);
        } catch (error) {
          showError(`Erro ao processar o arquivo ${file.fileName}: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
        }
      }

      if (allTransactions.length === 0) {
        throw new Error("Nenhuma transação de crédito válida foi encontrada nos arquivos. Verifique o formato e o conteúdo.");
      }
      
      setTransactions(allTransactions);
      setAnalysisData(data);
      setAiAnalysisText("Análise local concluída. Os dados abaixo foram extraídos e classificados automaticamente.");
      
      setStep('result');
      dismissToast(toastId);
      showSuccess("Processamento local concluído!");

    } catch (error) {
      console.error("Erro no processo de análise:", error);
      dismissToast(toastId);
      showError(error instanceof Error ? error.message : "Ocorreu um erro desconhecido.");
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
    setAiAnalysisText("");
    setCorsError(false);
  };

  const handleReanalyzeAi = async (type: 'prod' | 'test') => {
     showError("A funcionalidade de reanálise com IA será implementada futuramente.");
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      <header className="py-4 px-4 md:px-8 no-print flex justify-between items-center bg-white dark:bg-gray-950 shadow-sm">
        <h1 className="text-2xl md:text-3xl font-bold text-center text-indigo-600 dark:text-indigo-400">
          Analisador Financeiro
        </h1>
        <SettingsSheet />
      </header>
      
      <main className="flex-grow container mx-auto p-4 md:p-8 print-container">
        {step === 'input' && (
          <div className="space-y-6">
            {corsError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro de Configuração (CORS)</AlertTitle>
                <AlertDescription className="mt-2">
                  <p className="mb-2">O navegador bloqueou a conexão com o n8n. Isso ocorre por segurança quando o servidor não permite explicitamente a origem.</p>
                  <p className="font-semibold">Como resolver:</p>
                  <ol className="list-decimal list-inside ml-2">
                    <li>No seu workflow n8n, abra o nó <strong>Webhook</strong>.</li>
                    <li>Vá em <strong>Options</strong>.</li>
                    <li>Encontre a opção <strong>Allowed Origins (CORS)</strong>.</li>
                    <li>Defina o valor como <code>*</code>.</li>
                  </ol>
                </AlertDescription>
              </Alert>
            )}

            <AnalysisForm onSubmit={handleProcessAnalysis} isProcessing={isProcessing} />
          </div>
        )}
        
        {step === 'result' && analysisData && (
          <div className="space-y-6">
            {aiAnalysisText && (
               <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-indigo-100 dark:border-indigo-900 no-print">
                  <h3 className="text-lg font-semibold mb-2 text-indigo-600 dark:text-indigo-400">Status da Análise</h3>
                  <div className="prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap">
                    {aiAnalysisText}
                  </div>
               </div>
            )}

            <AnalysisResult 
              transactions={transactions} 
              analysisData={analysisData}
              onBack={handleNewAnalysis}
              onToggleCategory={handleToggleTransactionCategory}
              onAiAnalysis={handleReanalyzeAi}
              isAiProcessing={false}
            />
          </div>
        )}
      </main>
      
      <footer className="py-4 no-print border-t mt-auto">
        <MadeWithDyad />
      </footer>
    </div>
  );
};

export default Index;