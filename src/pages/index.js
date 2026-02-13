import { BancoAmazoniaParser } from './BancoAmazonia/parser';
import { BradescoParser } from './Bradesco/parser';
import { BancoDoBrasilParser } from './BancoDoBrasil/parser';

// Mapeamento dos parsers disponíveis por código
const parsers = {
  [BancoAmazoniaParser.code]: BancoAmazoniaParser,
  [BradescoParser.code]: BradescoParser,
  [BancoDoBrasilParser.code]: BancoDoBrasilParser
};

// Função para listar os bancos disponíveis para o seu Select no Dashboard
export const getAvailableBanks = () => {
  return Object.values(parsers).map(p => ({
    code: p.code,
    name: p.name
  }));
};

// A função agora recebe o conteúdo do arquivo E o código do banco selecionado
export const parseBankStatement = (fileContent, bankCode) => {
  return new Promise((resolve, reject) => {
    const parser = parsers[bankCode];

    if (!parser) {
      reject(new Error(`Banco não selecionado ou parser não implementado para o código: ${bankCode}`));
      return;
    }

    console.log(`Iniciando processamento exclusivo para: ${parser.name}`);
    
    // Chama diretamente o parser específico, sem tentar adivinhar ou validar outros bancos
    parser.parse(fileContent)
      .then(resolve)
      .catch(error => {
        console.error(`Erro ao processar arquivo do ${parser.name}:`, error);
        reject(error);
      });
  });
};