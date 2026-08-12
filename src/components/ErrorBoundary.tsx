import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public handleReset = () => {
    (this as any).setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if ((this as any).state?.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 text-center font-sans">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-zinc-200 shadow-2xl space-y-6">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mx-auto border border-amber-100">
              <AlertTriangle size={32} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-black text-zinc-900 tracking-tight">
                Se detectó un inconveniente
              </h2>
              <p className="text-xs text-zinc-500 leading-relaxed">
                La aplicación NicaGo ha recuperado el estado para evitar el cierre involuntario. Puedes continuar presionando el botón.
              </p>
            </div>

            {(this as any).state?.error && (
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 text-[10px] text-zinc-400 font-mono text-left max-h-24 overflow-y-auto truncate">
                {(this as any).state.error.message}
              </div>
            )}

            <button
              type="button"
              onClick={this.handleReset}
              className="w-full py-3.5 bg-[#0033a0] hover:bg-blue-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={16} />
              Reintentar / Recargar NicaGo
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props?.children;
  }
}
