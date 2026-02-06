"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/FileUpload";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnalysisData } from '@/types';

interface AnalysisFormProps {
  onSubmit: (data: AnalysisData, files: File[]) => void;
  isProcessing: boolean;
}

export const AnalysisForm = ({ onSubmit, isProcessing }: AnalysisFormProps) => {
  const [cnpj, setCnpj] = useState('');
  const [cpf, setCpf] = useState('');
  const [totalInvoices, setTotalInvoices] = useState('');
  const [competenceDate, setCompetenceDate] = useState<Date | undefined>(new Date());
  const [files, setFiles] = useState<File[]>([]);

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
    const value = e.target.value.replace(/\D/g, '');
    const maskedValue = value
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .slice(0, 14);
    setCpf(maskedValue);
  };
  
  const handleTotalInvoicesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = value.replace(/[^0-9,]/g, '').replace(/(,.*?),/g, '$1');
    setTotalInvoices(numericValue);
  };

  const isFormValid = cnpj.length === 18 && cpf.length === 14 && files.length > 0 && competenceDate && !isProcessing;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !competenceDate) return;
    
    onSubmit({
      cnpj,
      cpf,
      totalInvoices: totalInvoices || '0',
      competenceDate,
    }, files);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-lg border-indigo-100 dark:border-indigo-900 bg-white dark:bg-gray-950">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Informações da Análise</CardTitle>
        <CardDescription>Preencha os dados e importe os extratos para iniciar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ da Empresa</Label>
              <Input id="cnpj" placeholder="00.000.000/0000-00" value={cnpj} onChange={handleCnpjChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF do Sócio</Label>
              <Input id="cpf" placeholder="000.000.000-00" value={cpf} onChange={handleCpfChange} required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="total-invoices">Valor Total das Notas (R$)</Label>
              <Input id="total-invoices" placeholder="0,00" value={totalInvoices} onChange={handleTotalInvoicesChange} />
            </div>
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
          
          <div className="space-y-2">
            <Label>Extratos Bancários (.csv)</Label>
            <FileUpload files={files} setFiles={setFiles} />
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