import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';

interface AuthScreenProps {
  onSignInGoogle: () => Promise<void>;
  onEnterDemo: () => void;
  errorMsg: string | null;
}

const CAPABILITIES = [
  'Centralize saldos e extratos de LATAM Pass, Smiles, Azul, Livelo, Esfera e TAP em um único painel.',
  'Receba alertas automáticos de pontos e milhas próximos do vencimento para nunca perder saldo.',
  'Acompanhe o histórico de acúmulo dos últimos 6 meses e o custo médio do milheiro (CPM) da carteira.',
  'Gerencie contas de familiares e amigos com controle anual de CPFs emitidos por companhia.',
];

export function AuthScreen({ onSignInGoogle, onEnterDemo, errorMsg }: AuthScreenProps) {
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    try {
      await onSignInGoogle();
    } catch {
      // handled in parent state
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <span className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
            PontoPlus
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loadingGoogle}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap disabled:opacity-60"
            >
              {loadingGoogle ? 'Conectando...' : 'Entrar com Google'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <p className="text-sm font-medium text-teal-700">
              Gestão completa de programas de fidelidade · Brasil e Exterior
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]">
              Todos os seus pontos e milhas em um só painel.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              Acompanhe o saldo, o extrato unificado e a validade das suas contas e das contas de familiares
              para nunca deixar pontos expirarem sem controle.
            </p>

            <ul className="space-y-3 pt-2">
              {CAPABILITIES.map((text) => (
                <li key={text} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="mt-0.5 w-5 h-5 rounded-md bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 text-teal-700" />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Acesse sua carteira
                </h2>
                <p className="text-sm text-slate-500">
                  Entre com sua conta Google para salvar suas contas e alertas na nuvem,
                  ou explore o ambiente completo com dados de demonstração.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loadingGoogle}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors disabled:opacity-60"
                >
                  <span>{loadingGoogle ? 'Autenticando...' : 'Continuar com Google'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onEnterDemo}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <span>Explorar Demonstração Interativa</span>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
                <p>Ao entrar com Google pela primeira vez, uma carteira inicial editável é criada para você testar todas as funções.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>PontoPlus · Controle unificado de fidelidade e passagens</span>
          <span>Valores de milheiro e tarifas calculados em tempo real</span>
        </div>
      </footer>
    </div>
  );
}
