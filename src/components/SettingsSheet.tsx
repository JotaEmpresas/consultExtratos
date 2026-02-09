"use client";

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { showSuccess } from '@/utils/toast';

export function SettingsSheet() {
  const [prodWebhook, setProdWebhook] = useState('https://jota-empresas-n8n.ubjifz.easypanel.host/webhook/bd95e5ce-4ebf-48c9-b823-ad8b57429c7e');
  const [testWebhook, setTestWebhook] = useState('https://jota-empresas-n8n.ubjifz.easypanel.host/webhook-test/bd95e5ce-4ebf-48c9-b823-ad8b57429c7e');

  useEffect(() => {
    const savedProdWebhook = localStorage.getItem('prodWebhookUrl');
    const savedTestWebhook = localStorage.getItem('testWebhookUrl');
    if (savedProdWebhook) setProdWebhook(savedProdWebhook);
    if (savedTestWebhook) setTestWebhook(savedTestWebhook);
  }, []);

  const handleSave = () => {
    localStorage.setItem('prodWebhookUrl', prodWebhook);
    localStorage.setItem('testWebhookUrl', testWebhook);
    showSuccess('Configurações salvas com sucesso!');
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
          <span className="sr-only">Configurações</span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Configurações</SheetTitle>
          <SheetDescription>
            Configure os webhooks para integração. Para testar, use o webhook de "Teste". Para operações reais, use o de "Produção".
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="prod-webhook">
              Produção
            </Label>
            <Input
              id="prod-webhook"
              value={prodWebhook}
              onChange={(e) => setProdWebhook(e.target.value)}
            />
            <p className="text-xs text-muted-foreground break-all">
              Use: https://jota-empresas-n8n.ubjifz.easypanel.host/webhook/bd95e5ce-4ebf-48c9-b823-ad8b57429c7e
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-webhook">
              Teste
            </Label>
            <Input
              id="test-webhook"
              value={testWebhook}
              onChange={(e) => setTestWebhook(e.target.value)}
            />
             <p className="text-xs text-muted-foreground break-all">
              Use: https://jota-empresas-n8n.ubjifz.easypanel.host/webhook-test/bd95e5ce-4ebf-48c9-b823-ad8b57429c7e
            </p>
          </div>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button type="submit" onClick={handleSave}>Salvar</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}