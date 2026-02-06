import { AnalysisForm } from "@/components/AnalysisForm";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      <header className="py-4">
        <h1 className="text-3xl font-bold text-center text-indigo-600 dark:text-indigo-400">
          Analisador de Extratos
        </h1>
      </header>
      <main className="flex-grow container mx-auto p-4 md:p-8">
        <AnalysisForm />
      </main>
      <footer className="py-4">
        <MadeWithDyad />
      </footer>
    </div>
  );
};

export default Index;