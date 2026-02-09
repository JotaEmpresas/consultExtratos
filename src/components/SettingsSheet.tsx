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
  const [prodWebhook, setProdWebhook] = useState('');
  const [testWebhook, setTestWebhook] = useState('');

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
            Configure os webhooks para integração com serviços externos como o n8n.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="prod-webhook" className="text-right">
              Produção
            </Label>
            <Input
              id="prod-webhook"
              value={prodWebhook}
              onChange={(e) => setProdWebhook(e.target.value)}
              placeholder="https://.../webhook/..."
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="test-webhook" className="text-right">
              Teste
            </Label>
            <Input
              id="test-webhook"
              value={testWebhook}
              onChange={(e) => setTestWebhook(e.target.value)}
              placeholder="https://.../webhook-test/..."
              className="col-span-3"
            />
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