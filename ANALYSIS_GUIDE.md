# Guia de Análise de Extrato - Categorização Bancária

## Visão Geral

A aplicação analisa extratos bancários e classifica automaticamente as transações em duas categorias:

- **Entradas Tributáveis**: Receitas que devem ser informadas à Receita Federal
- **Entradas Não-Tributáveis**: Transferências internas ou entre contas próprias

## Fluxo de Processamento

### 1️⃣ Etapa de Leitura

Cada banco tem um parser específico que:
- Identifica o formato do arquivo (CSV, OFX, etc.)
- Extrai campos: Data, Descrição, Valor
- Filtra apenas transações **positivas** (entradas, não saídas)
- Remove linhas de rodapé como "SALDO TOTAL DISPONÍVEL"

### 2️⃣ Etapa de Normalização

Antes de categorizar, a descrição é normalizada:

```typescript
// Exemplo: "PIX RECEBIDO - João da Silva 12345678901"
const normalized = text
  .toLowerCase()                    // "pix recebido - joão da silva 12345678901"
  .normalize('NFD')                 // Remove acentos
  .replace(/[\u0300-\u036f]/g, '')  // "pix recebido - joao da silva 12345678901"

// Também extrai números para comparação
const numbers = normalized.replace(/[^0-9]/g, '') // "12345678901"
```

### 3️⃣ Etapa de Classificação

A função `categorizeTransaction()` verifica se a transação contém identificadores da empresa ou sócios:

**Identificadores verificados:**
- CNPJ da empresa (ex: 31640099282)
- CPF dos sócios (ex: 12345678901)
- Nomes dos sócios (ex: João Silva)

**Lógica:**
```
SE a transação contém CNPJ ou CPF ou nome do sócio
  → Classificar como NÃO-TRIBUTÁVEL (transferência interna)
SENÃO
  → Classificar como TRIBUTÁVEL (receita externa)
```

## Exemplos Práticos

### Exemplo 1: Transferência Interna ❌ (Não-Tributável)

```
Descrição: "PIX RECEBIDO - JOÃO SILVA 12345678901"
CNPJ da empresa: 31.640.099/0001-82
CPF sócio: 123.456.789-01

Normalização:
- Descrição normalizada: "pix recebido joao silva 12345678901"
- Números extraídos: "12345678901"
- CPF dados: "12345678901"

Resultado: ✅ ENCONTA CORRESPONDÊNCIA COM CPF
→ Classificação: NÃO-TRIBUTÁVEL
```

### Exemplo 2: Receita de Cliente ✅ (Tributável)

```
Descrição: "PIX RECEBIDO - CLIENTE ABC LTDA 98765432000111"
Dados da empresa:
- CNPJ: 31.640.099/0001-82
- Sócios: João Silva (123.456.789-01)

Normalização:
- Descrição normalizada: "pix recebido cliente abc ltda 98765432000111"
- Números extraídos: "98765432000111"

Resultado: ❌ NÃO ENCONTRA O CNPJ/CPF/NOME
→ Classificação: TRIBUTÁVEL
```

### Exemplo 3: Saldo (Descartado)

```
Descrição: "SALDO TOTAL DISPONÍVEL DIA 12/04/2026"

Estrutura verifica padrões de exclusão:
- SALDO TOTAL DISPONÍVEL ✓ (encontrado)
- SALDO ANTERIOR ✓
- RESUMO MENSAL ✓

Resultado: ❌ DESCARTADO (não processado)
```

## Campos de Entrada Esperados

### AnalysisForm (Formulário Principal)

```typescript
interface AnalysisData {
  cnpj: string;              // "31.640.099/0001-82"
  cpf: string;               // CPFs separados por vírgula/quebra de linha
  partnerNames: string;      // Nomes dos sócios
  totalInvoices: string;     // Número de arquivos
  competenceDate: Date;      // Data de referência
  companyName: string;       // Nome da empresa
  manualRevenue?: number;    // Opcional: receita manual
}
```

### Exemplo de Entrada

```
CNPJ: 31.640.099/0001-82
CPF dos Sócios:
  123.456.789-01
  987.654.321-09
Nomes dos Sócios: João Silva, Maria Santos
Data de Competência: 04/2026
Nome da Empresa: Consultora XYZ LTDA
```

## Relatório de Saída

O relatório compara:

### Sua Análise Original
- Entradas Tributáveis (manual)
- Entradas Não-Tributáveis (manual)
- Total

### Análise Sugerida pela IA
- Entradas Tributáveis (automático)
- Entradas Não-Tributáveis (automático)
- Base de conhecimento utilizada

## Casos Especiais

### ⚠️ Nomes Parciais

Se o sócio se chama "João Silva" e a transação diz "João", **NÃO** faz match por padrão.
Recomendação: Use nomes completos ou únicos como "João Silva da Costa".

### ⚠️ CNPJ/CPF Sem Dígitos Verificadores

Os parsers removem caracteres especiais antes de comparar, então:
- `123.456.789-01` vira `12345678901` ✓
- `123456789-01` vira `12345678901` ✓
- Ambas funcionam

### ⚠️ Acentos e Maiúsculas

A normalização trata:
- `João` = `Joao`
- `JOÃO` = `Joao`
- `TRANSFERÊNCIA` = `TRANSFERENCIA`

## Filtros de Exclusão Padrão

Estas descrições **sempre** são descartadas:
- "SALDO TOTAL DISPONÍVEL"
- "SALDO ANTERIOR"
- "SALDO EM"
- "RESUMO MENSAL"

## Adicionando Novos Bancos

Para adicionar um novo banco:

1. **Criar parser em** `src/lib/parsers/novoBank.ts`
2. **Usar a função centralizada:**

```typescript
import { categorizeTransaction } from '../utils';

// Em seu parseador...
const category = categorizeTransaction(
  description,
  companyCnpj,
  cpfList,
  nameList
);
```

3. **Registrar em** `src/lib/parserRegistry.ts`

## Troubleshooting

### ❌ Transações aparecem como Tributáveis quando deveriam ser Não-Tributáveis

**Possível causa**: O nome/CPF/CNPJ não está sendo encontrado na descrição.

**Solução**:
- Verifique se a descrição contém de fato o identificador
- Use o DevTools para ver os dados capturados no parser
- Mude o padrão se o banco não inclui essa informação

### ❌ Muitas entradas descartadas

**Possível causa**: Formato de arquivo inesperado.

**Solução**:
- Verifique o padrão esperado do banco
- Compare com um arquivo de exemplo
- Edite o headers detection regex se necessário

### ✅ Teste seus parsers

```bash
# No console do navegador ou Node.js
import { parseBancoDoBrasil } from '@/lib/parsers/bancoDoBrasil'

const result = await parseBancoDoBrasil(fileContent, cnpj, cpfList, nameList)
console.log(result)
```

## Referências

- [Tipos TypeScript](src/types/index.ts)
- [Funções Utilitárias](src/lib/utils.ts)
- [Componente de Análise](src/components/AnalysisForm.tsx)
- [Relatório Comparativo](src/components/AIComparisonReport.tsx)
