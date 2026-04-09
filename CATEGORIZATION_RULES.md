# Regras de Categorização de Transações Bancárias

## Implementação Centralizada

Uma função centralizada `categorizeTransaction()` foi criada em `src/lib/utils.ts` para padronizar a categorização de todas as transações bancárias em todos os parsers.

## Regras de Categorização

### Entradas Tributáveis (taxable)
- **Descrição**: Entradas positivas que **NÃO** contêm referências à empresa ou sócios
- **Critérios de Exclusão Automática**:
  - `SALDO TOTAL DISPONÍVEL`
  - `SALDO ANTERIOR`
  - `SALDO EM`
  - `RESUMO MENSAL`
- **Lógica**: Se a descrição não contenha CNPJ da empresa, CPF dos sócios ou nome dos sócios, é tributável

### Entradas Não-Tributáveis (non-taxable)
- **Descrição**: Entradas positivas que contêm **identificadores internos** (transferências entre contas próprias)
- **Critérios de Identificação**:
  - ✅ Contém CNPJ da empresa
  - ✅ Contém CPF de qualquer sócio
  - ✅ Contém nome de qualquer sócio

## Normalização de Dados

Toda a comparação é feita com:
1. **Remoção de acentos**: `normalize("NFD").replace(/[\u0300-\u036f]/g, "")`
2. **Conversão para lowercase**: `.toLowerCase()`
3. **Extração de números**: Removes all non-numeric characters para comparação com CNPJ/CPF
4. **Trimming**: Remove espaços em branco desnecessários

## Parsers Atualizados ✅

**TODOS os parsers foram atualizados para usar a função centralizada:**

✅ Banco do Brasil (`bancoDoBrasil.ts`)
✅ Banco da Amazônia (`bancoDaAmazonia.ts`)
✅ Itaú (`itau.ts`)
✅ Itaú 2 (`itau2.ts`)
✅ Itaú 3 (`itau3.ts`)
✅ Itaú OFX (`itauOfx.ts`)
✅ Nubank (`nubank.ts`)
✅ Bradesco (`bradesco.ts`)
✅ Santander (`santander.ts`)
✅ Santander 2 (`santander2.ts`)
✅ Inter (`inter.ts`)
✅ Cora (`cora.ts`)
✅ Mercado Pago (`mercadoPago.ts`)
✅ Stone (`stone.ts`)
✅ PagBank (`pagbank.ts`)
✅ SiCredi (`sicredi.ts`)
✅ SiCredi OFX (`sicrediOfx.ts`)
✅ Sicoob (`sicoob.ts`)
✅ C6 Bank (`c6bank.ts`)
✅ InfinitPay (`infinitPay.ts`)
✅ InfinitPay 2 (`infinitPay2.ts`)
✅ InfinitPay 3 (`infinitPay3.ts`)
✅ InfinitPay 4 (`infinitPay4.ts`)

## Exemplo de Uso

```typescript
import { categorizeTransaction } from '@/lib/utils';

const category = categorizeTransaction(
  'PIX RECEBIDO - JOÃO SILVA 12345678901234',
  '12.345.678/0001-90', // CNPJ da empresa
  ['12345678901'],       // CPF dos sócios
  ['João Silva']         // Nomes dos sócios
);

// Retorna: 'non-taxable' (porque contém CPF)
```

## Benefícios

- 🎯 **Consistência**: Mesma lógica em todos os parsers
- 🔄 **Manutenibilidade**: Mudanças centralizadas em um único arquivo
- 📊 **Rastreabilidade**: Fácil entender e auditar as regras
- ✨ **Escalabilidade**: Fácil adicionar novas regras no futuro
