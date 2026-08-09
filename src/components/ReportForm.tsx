import React, { useState } from 'react';
import { motion } from 'motion/react';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AlertCircle, Send, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { useLanguage } from '../lib/LanguageContext';

interface ReportFormProps {
  type: 'route' | 'stop' | 'driver';
  targetId: string;
  driverId?: string;
  onClose: () => void;
}

export default function ReportForm({ type, targetId, driverId, onClose }: ReportFormProps) {
  const { t } = useLanguage();
  const [reportTarget, setReportTarget] = useState<'route' | 'driver' | 'both'>(type === 'driver' ? 'driver' : 'route');
  const [reason, setReason] = useState<'drunk' | 'reckless' | 'bad_condition' | 'other'>('other');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUserId = auth.currentUser ? auth.currentUser.uid : (localStorage.getItem('localAuth') ? (localStorage.getItem('localAuth_id') || ('local-' + localStorage.getItem('localAuth'))) : null);
    const currentUserName = auth.currentUser 
      ? (auth.currentUser.displayName || auth.currentUser.email || 'Pasajero') 
      : (localStorage.getItem('localAuth') ? (localStorage.getItem('localAuth_name') || 'Pasajero Local') : null);

    if (!currentUserId || !currentUserName) return;

    setIsSubmitting(true);
    try {
      const reportPath = 'reports';
      await addDoc(collection(db, reportPath), {
        userId: currentUserId,
        userName: currentUserName,
        type: reportTarget === 'both' ? 'route' : reportTarget,
        reportTarget,
        targetId,
        driverId: driverId || (type === 'driver' ? targetId : null),
        reason,
        description,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setIsSuccess(true);
      setTimeout(onClose, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reports');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-zinc-900/80 backdrop-blur-md" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col p-6 sm:p-8"
      >
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all rounded-xl z-20"
        >
          <X size={20} />
        </button>

        <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-nic-red/10 rounded-2xl flex items-center justify-center text-nic-red shadow-inner shrink-0">
              <AlertCircle size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 leading-tight">Reportar Incidente</h2>
              <p className="text-xs font-medium text-zinc-500">Tu seguridad es nuestra prioridad</p>
            </div>
          </div>

          {isSuccess ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Send size={36} />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">¡Reporte Enviado!</h3>
            <p className="text-sm text-zinc-500 max-w-[240px] mx-auto">Gracias por ayudarnos. El administrador revisará tu reporte pronto.</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {driverId && (
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">¿Qué deseas reportar?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'route', label: 'Ruta' },
                    { id: 'driver', label: 'Chofer' },
                    { id: 'both', label: 'Ambos' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setReportTarget(t.id as any)}
                      className={cn(
                        "py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border",
                        reportTarget === t.id 
                          ? "bg-nic-blue text-white border-nic-blue shadow-lg shadow-blue-900/20" 
                          : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:border-zinc-300"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">Motivo del reporte</label>
              <select 
                value={reason}
                onChange={e => setReason(e.target.value as any)}
                className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-nic-red/5 focus:border-nic-red outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="drunk">Chofer en estado de ebriedad</option>
                <option value="reckless">Conducción Temeraria / Manejo imprudente</option>
                <option value="other">Chofer descuidado / Desatento o Irresponsable</option>
                <option value="bad_condition">Unidad en mal estado</option>
                <option value="other">Otro motivo</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 ml-1">Descripción detallada</label>
              <textarea 
                required
                placeholder="Describe lo sucedido con el mayor detalle posible..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-nic-red/5 focus:border-nic-red outline-none h-40 resize-none transition-all"
              />
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-nic-red text-white rounded-2xl font-bold text-sm hover:bg-red-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-red-900/20 active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Enviar Reporte
                </>
              )}
            </button>
          </form>
        )}
        </div>
      </motion.div>
    </div>
  );
}
