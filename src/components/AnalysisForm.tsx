"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/FileUpload";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar as CalendarIcon, Loader2, PlusCircle, X, ChevronsUpDown, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnalysisData } from '@/types';
import { bankOptions } from '@/lib/parserRegistry';
import { cn } from '@/lib/utils';

interface BankEntry {
  id: number;
  bank: string;
  files: File[];
}

interface AnalysisFormProps {
  onSubmit: (data: Omit<AnalysisData, 'totalInvoices'>, bankFiles: { bank: string, files: File[] }[], invoiceFiles: File[]) => void;
  isProcessing: boolean;
}

export const AnalysisForm = ({ onSubmit, isProcessing }: AnalysisFormProps) => {
  const [companyName, setCompanyName] = useState('');
  const [companyNames, setCompanyNames] = useState<string[]>([]);
  const [openCompanyCombobox, setOpenCompanyCombobox] = useState(false);
  const [cnpj, setCnpj] = useState('');
  const [cpf, setCpf] = useState('');
  const [partnerNames, setPartnerNames] = useState('');
  const [competenceDate, setCompetenceDate] = useState<Date | undefined>(new Date());
  const [bankEntries, setBankEntries] = useState<BankEntry[]>([{ id: Date.now(), bank: '', files: [] }]);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [revenueMode, setRevenueMode] = useState<'manual' | 'import'>('import');
  const [manualRevenue, setManualRevenue] = useState('');

  useEffect(() => {
    const savedCompanyNames = localStorage.getItem('companyNames');
    if (savedCompanyNames) {
      setCompanyNames(JSON.parse(savedCompanyNames));
    }
  }, []);

  const updateCompanyNames = (newNames: string[]) => {
    setCompanyNames(newNames);
    localStorage.setItem('companyNames', JSON.stringify(newNames));
  };

  const handleSelectCompany = (name: string) => {
    setCompanyName(name);
    setOpenCompanyCombobox(false);
  };

  const handleRemoveCompany = (nameToRemove: string) => {
    const newNames = companyNames.filter(name => name !== nameToRemove);
    updateCompanyNames(newNames);
    if (companyName === nameToRemove) {
      setCompanyName('');
    }
  };

  const handleCreateCompany = (name: string) => {
    if (name && !companyNames.includes(name)) {
      const newNames = [...companyNames, name];
      updateCompanyNames(newNames);
      handleSelectCompany(name);
    }
  };

  const handleAddBank = () => {
    setBankEntries([...bankEntries, { id: Date.now(), bank: '', files: [] }]);
  };

  const handleRemoveBank = (id: number) => {
    setBankEntries(bankEntries.filter(entry => entry.id !== id));
  };

  const handleBankChange = (id: number, value: string) => {
    setBankEntries(bankEntries.map(entry => entry.id === id ? { ...entry, bank: value } : entry));
  };

  const handleFilesChange = (id: number, newFiles: File[]) => {
    setBankEntries(bankEntries.map(entry => entry.id === id ? { ...entry, files: newFiles } : entry));
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    const maskedValue = value
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
    setCnpj(maskedValue);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCpf(value);
  };

  const isFormValid = companyName &&
    cnpj.length === 18 &&
    competenceDate &&
    (revenueMode === 'manual' ? manualRevenue && !isNaN(parseFloat(manualRevenue)) && parseFloat(manualRevenue) > 0 : invoiceFiles.length > 0) &&
    bankEntries.length > 0 &&
    bankEntries.every(entry => entry.bank && entry.files.length > 0) &&
    !isProcessing;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !competenceDate) return;
    
    const bankFiles = bankEntries.map(({ bank, files }) => ({ bank, files }));
    const filesToSubmit = revenueMode === 'manual' ? [] : invoiceFiles;

    onSubmit({
      companyName,
      cnpj,
      cpf,
      partnerNames,
      competenceDate,
      ...(revenueMode === 'manual' && { manualRevenue: parseFloat(manualRevenue) }),
    }, bankFiles, filesToSubmit);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-lg border-indigo-100 dark:border-indigo-900 bg-white dark:bg-gray-950">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Informações da Análise</CardTitle>
        <CardDescription>Preencha os dados da empresa e adicione os extratos de cada banco.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nome da Empresa</Label>
              <Popover open={openCompanyCombobox} onOpenChange={setOpenCompanyCombobox}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={openCompanyCombobox} className="w-full justify-between font-normal">
                    {companyName || "Selecione ou crie uma empresa"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar ou criar empresa..." onValueChange={setCompanyName} />
                    <CommandList>
                      <CommandEmpty>
                        <Button className="w-full" onClick={() => handleCreateCompany(companyName)}>
                          Criar e selecionar "{companyName}"
                        </Button>
                      </CommandEmpty>
                      <CommandGroup>
                        {companyNames.map((name) => (
                          <CommandItem
                            key={name}
                            value={name}
                            onSelect={() => handleSelectCompany(name)}
                            className="flex justify-between items-center"
                          >
                            <div className="flex items-center">
                              <Check className={cn("mr-2 h-4 w-4", companyName === name ? "opacity-100" : "opacity-0")} />
                              {name}
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleRemoveCompany(name); }}>
                              <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ da Empresa</Label>
              <Input id="cnpj" placeholder="00.000.000/0000-00" value={cnpj} onChange={handleCnpjChange} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf">CPFs dos Sócios (separado por vírgula)</Label>
            <Input id="cpf" placeholder="000.000.000-00, 111.111.111-11" value={cpf} onChange={handleCpfChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="partner-names">Nomes dos Sócios (separado por vírgula)</Label>
            <Input id="partner-names" placeholder="Nome Sobrenome, Outro Nome" value={partnerNames} onChange={(e) => setPartnerNames(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Mês de Competência</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {competenceDate ? format(competenceDate, "MMMM 'de' yyyy", { locale: ptBR }) : <span>Selecione o mês</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={competenceDate}
                    onSelect={setCompetenceDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-medium">Receita de Vendas</Label>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="revenue-manual"
                  name="revenue-mode"
                  value="manual"
                  checked={revenueMode === 'manual'}
                  onChange={(e) => setRevenueMode(e.target.value as 'manual' | 'import')}
                  className="w-4 h-4"
                />
                <Label htmlFor="revenue-manual" className="font-normal cursor-pointer">Informar manualmente</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="revenue-import"
                  name="revenue-mode"
                  value="import"
                  checked={revenueMode === 'import'}
                  onChange={(e) => setRevenueMode(e.target.value as 'manual' | 'import')}
                  className="w-4 h-4"
                />
                <Label htmlFor="revenue-import" className="font-normal cursor-pointer">Importar notas fiscais</Label>
              </div>
            </div>
          </div>

          {revenueMode === 'manual' && (
            <div className="space-y-2">
              <Label htmlFor="manual-revenue">Valor da Receita (R$)</Label>
              <Input
                id="manual-revenue"
                type="number"
                placeholder="0.00"
                value={manualRevenue}
                onChange={(e) => setManualRevenue(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>
          )}

          {revenueMode === 'import' && (
            <div className="space-y-4">
              <Label className="text-base font-medium">Notas Fiscais de Venda (.xml)</Label>
              <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/50">
                <FileUpload 
                  files={invoiceFiles} 
                  setFiles={setInvoiceFiles}
                  accept={{ 'application/xml': ['.xml'], 'text/xml': ['.xml'] }}
                  fileTypeDescription="Apenas arquivos .xml são permitidos"
                />
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <Label className="text-base font-medium">Extratos Bancários</Label>
            <div className="space-y-6">
              {bankEntries.map((entry, index) => (
                <div key={entry.id} className="p-4 border rounded-lg relative bg-gray-50 dark:bg-gray-900/50">
                  {bankEntries.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveBank(entry.id)}
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remover banco</span>
                    </Button>
                  )}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Banco {index + 1}</Label>
                      <Select onValueChange={(value) => handleBankChange(entry.id, value)} value={entry.bank}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o banco do extrato" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Extratos (.csv, .ofx)</Label>
                      <FileUpload files={entry.files} setFiles={(newFiles) => handleFilesChange(entry.id, newFiles)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={handleAddBank} className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar outro banco
            </Button>
          </div>

          <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3" disabled={!isFormValid}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Processar Análise'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};