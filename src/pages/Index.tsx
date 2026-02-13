import { useState } from "react";
import { AnalysisForm } from "@/components/AnalysisForm";
import { AnalysisResult } from "@/components/AnalysisResult";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { readFilesForWebhook } from "@/lib/fileParser";
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

  const getWebhookUrl = () => {
     return localStorage.getItem('prodWebhookUrl') || 'https://jota-empresas-n8n.ubjifz.easypanel.host/webhook/bd95e5ce-4ebf-48c9-b823-ad8b57429c7e';
  };

  const handleProcessAnalysis = async (data: AnalysisData, files: File[]) => {
    setCorsError(false);
    const webhookUrl = getWebhookUrl();
    
    if (!webhookUrl) {
      showError("URL do Webhook não configurada. Verifique as configurações.");
      return;
    }

    // Validação de tamanho (limite seguro de ~4MB para evitar timeout/payload error em servidores padrão)
    const MAX_SIZE_MB = 4;
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > MAX_SIZE_MB * 1024 * 1024) {
      showError(`Os arquivos somam ${(totalSize / 1024 / 1024).toFixed(2)}MB. O limite recomendado é ${MAX_SIZE_MB}MB para garantir o envio.`);
      return;
    }

    setIsProcessing(true);
    const toastId = showLoading('Lendo arquivos e enviando para a IA processar...');

    try {
      const filesContent = await readFilesForWebhook(files);
      
      if (filesContent.length === 0) {
        throw new Error("Falha ao ler o conteúdo dos arquivos.");
      }

      const payload = {
        analysisData: {
          ...data,
          competenceDate: data.competenceDate.toISOString()
        },
        files: filesContent
      };

      console.log("Enviando payload para:", webhookUrl);
      
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            // 'Accept': 'application/json' 
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          if (response.status === 413) {
            throw new Error("Os arquivos são muito grandes para o servidor aceitar (Erro 413).");
          }
          throw new Error(`Erro no servidor da IA: ${response.status} ${response.statusText}`);
        }

        const result: AiProcessingResponse = await response.json();
        console.log("Resposta da IA recebida:", result);

        if (!result.transacoesTributaveis && !result.transacoesNaoTributaveis) {
          throw new Error("A IA respondeu, mas não retornou as listas de transações esperadas. Verifique o formato de saída no n8n.");
        }

        const taxable = (result.transacoesTributaveis || []).map((t, i) => ({
          ...t,
          id: t.id || `ai-tax-${i}`,
          category: 'taxable' as const,
          amount: typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount
        }));

        const nonTaxable = (result.transacoesNaoTributaveis || []).map((t, i) => ({
          ...t,
          id: t.id || `ai-nontax-${i}`,
          category: 'non-taxable' as const,
          amount: typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount
        }));

        setTransactions([...taxable, ...nonTaxable]);
        setAnalysisData(data);
        setAiAnalysisText(result.analise || "Análise processada com sucesso.");
        
        setStep('result');
        dismissToast(toastId);
        showSuccess("Processamento da IA concluído!");

      } catch (fetchError) {
        // Tratamento específico para erro de rede/CORS
        if (fetchError instanceof TypeError && fetchError.message.includes("Failed to fetch")) {
          setCorsError(true);
          throw new Error("Erro de conexão (CORS). O navegador bloqueou a solicitação. Verifique o alerta na tela.");
        }
        throw fetchError;
      }

    } catch (error) {
      console.error("Erro no processo:", error);
      dismissToast(toastId);
      showError(error instanceof Error ? error.message : "Erro desconhecido ao processar com a IA.");
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
     showSuccess("A análise já foi feita pela IA no processamento inicial.");
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      <header className="py-4 px-4 md:px-8 no-print flex justify-between items-center bg-white dark:bg-gray-950 shadow-sm">
        <h1 className="text-2xl md:text-3xl font-bold text-center text-indigo-600 dark:text-indigo-400">
          Analisador Financeiro AI
        </h1>
        <SettingsSheet />
      </header>
      
      <main className="flex-grow container mx-auto p-4 md:p-8 print-container">
        {step === 'input' && (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold mb-1">Processamento via IA Ativo</p>
              Os extratos serão enviados para o seu n8n. Certifique-se de que o Webhook permite conexões externas (CORS configurado com <code>*</code>).
            </div>
            
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
                  <h3 className="text-lg font-semibold mb-2 text-indigo-600 dark:text-indigo-400">Parecer da IA</h3>
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