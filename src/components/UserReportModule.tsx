import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Stop, Route } from '../types';
import { useLanguage } from '../lib/LanguageContext';
import { MapPin, Bus, AlertTriangle, Send, CheckCircle, ChevronDown, ShieldAlert, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';

interface UserReportModuleProps {
  stops: Stop[];
  routes: Route[];
}

type ReportType = 'stop' | 'route' | null;

export default function UserReportModule({ stops, routes }: UserReportModuleProps) {
  const { t } = useLanguage();
  
  // Selection States
  const [reportType, setReportType] = useState<ReportType>(null);
  const [selectedStopId, setSelectedStopId] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [stopSearchText, setStopSearchText] = useState<string>('');
  const [routeSearchText, setRouteSearchText] = useState<string>('');
  const [isStopDropdownOpen, setIsStopDropdownOpen] = useState<boolean>(false);
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState<boolean>(false);
  
  // Predefined and additional options
  const [stopProblem, setStopProblem] = useState<'dirty' | 'damaged' | 'other' | ''>('');
  const [routeProblem, setRouteProblem] = useState<'drunk' | 'reckless' | 'careless' | 'other' | ''>('');
  const [description, setDescription] = useState<string>('');
  
  // UX Feedback States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setReportType(null);
    setSelectedStopId('');
    setSelectedRouteId('');
    setStopSearchText('');
    setRouteSearchText('');
    setStopProblem('');
    setRouteProblem('');
    setDescription('');
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUserId = auth.currentUser ? auth.currentUser.uid : (localStorage.getItem('localAuth') ? (localStorage.getItem('localAuth_id') || ('local-' + localStorage.getItem('localAuth'))) : null);
    const currentUserName = auth.currentUser 
      ? (auth.currentUser.displayName || auth.currentUser.email || 'Pasajero') 
      : (localStorage.getItem('localAuth') ? (localStorage.getItem('localAuth_name') || 'Pasajero Local') : null);

    if (!currentUserId || !currentUserName) {
      setErrorMessage('Debes iniciar sesión para enviar un reporte.');
      return;
    }

    if (reportType === 'stop' && !selectedStopId) {
      setErrorMessage('Por favor, selecciona una bahía para reportar.');
      return;
    }
    if (reportType === 'route' && !selectedRouteId) {
      setErrorMessage('Por favor, selecciona una ruta para reportar.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let finalReason: 'drunk' | 'reckless' | 'bad_condition' | 'other' = 'other';
      let finalDescription = '';
      let targetId = '';
      let resolvedDriverId: string | null = null;
      
      if (reportType === 'stop') {
        targetId = selectedStopId;
        const selectedStopName = stops.find(s => s.id === selectedStopId)?.name || (selectedStopId.startsWith('custom:') ? selectedStopId.substring(7) : selectedStopId || 'Bahía personalizada');
        
        let problemText = '';
        if (stopProblem === 'dirty') {
          finalReason = 'bad_condition';
          problemText = 'Bahía sucia';
        } else if (stopProblem === 'damaged') {
          finalReason = 'bad_condition';
          problemText = 'Infraestructura en mal estado';
        } else {
          finalReason = 'other';
          problemText = 'Otro problema';
        }

        finalDescription = `[Reporte de Bahía: ${selectedStopName}] Tipo: ${problemText}. Detalles: ${description || 'Sin comentarios adicionales.'}`;
      } else {
        targetId = selectedRouteId;
        const routeObj = routes.find(r => r.id === selectedRouteId);
        const selectedRouteName = routeObj ? `${routeObj.code ? `[${routeObj.code}] ` : ''}${routeObj.name}` : (selectedRouteId.startsWith('custom:') ? selectedRouteId.substring(7) : selectedRouteId || 'Ruta personalizada');
        if (routeObj?.driverId) {
          resolvedDriverId = routeObj.driverId;
        }
        
        let problemText = '';
        if (routeProblem === 'drunk') {
          finalReason = 'drunk';
          problemText = 'Conductor ebrio';
        } else if (routeProblem === 'reckless') {
          finalReason = 'reckless';
          problemText = 'Conductor imprudente / Conducción Temeraria';
        } else if (routeProblem === 'careless') {
          finalReason = 'reckless'; // map to reckless/attention for DB compatibility
          problemText = 'Chofer descuidado / Desatento en vía';
        } else {
          finalReason = 'other';
          problemText = 'Otro incidente';
        }

        finalDescription = `[Reporte de Ruta: ${selectedRouteName}] Tipo: ${problemText}. Detalles: ${description || 'Sin comentarios adicionales.'}`;
      }

      await addDoc(collection(db, 'reports'), {
        userId: currentUserId,
        userName: currentUserName,
        type: reportType,
        targetId,
        driverId: resolvedDriverId,
        reason: finalReason,
        description: finalDescription,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setSuccessMessage('¡Tu reporte ha sido enviado correctamente! Los administradores revisarán el incidente.');
      setTimeout(() => {
        resetForm();
      }, 3500);

    } catch (err: any) {
      console.error('Error saving report: ', err);
      setErrorMessage(err.message || 'Error al conectar con la base de datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStops = stops.filter(s => 
    s.name.toLowerCase().includes(stopSearchText.toLowerCase()) ||
    (s.generalInfo && s.generalInfo.toLowerCase().includes(stopSearchText.toLowerCase()))
  );

  const filteredRoutes = routes.filter(r => 
    r.name.toLowerCase().includes(routeSearchText.toLowerCase()) ||
    (r.code && r.code.toLowerCase().includes(routeSearchText.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-xl overflow-hidden p-8 max-w-2xl mx-auto">
      {/* Header of Module */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-nic-red/10 rounded-2xl flex items-center justify-center text-nic-red shadow-inner">
          <ShieldAlert size={24} />
        </div>
        <div>
          <h2 className="text-xl font-black text-zinc-900 tracking-tight">Módulo de Reportes de Pasajeros</h2>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">Ayúdanos a mantener un viaje seguro y limpio</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {successMessage ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center py-12 px-4"
          >
            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-emerald-100">
              <CheckCircle size={40} className="animate-bounce" />
            </div>
            <h3 className="text-xl font-extrabold text-zinc-900 mb-2">¡Reporte Registrado!</h3>
            <p className="text-sm font-medium text-zinc-500 max-w-md mx-auto leading-relaxed">{successMessage}</p>
            <button
              onClick={resetForm}
              className="mt-8 px-6 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              Crear otro reporte
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="form-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Step 1: Select Type of Report */}
            {!reportType ? (
              <div className="space-y-6">
                <p className="text-sm font-medium text-zinc-500 text-center mb-4">Selecciona el elemento que deseas reportar:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option Bay (Bahía) */}
                  <button
                    onClick={() => setReportType('stop')}
                    className="flex flex-col items-center gap-4 p-8 bg-zinc-50 rounded-2xl border border-zinc-200/60 hover:border-nic-blue hover:bg-nic-blue/5 hover:shadow-lg hover:shadow-blue-500/5 transition-all text-center group cursor-pointer"
                  >
                    <div className="w-16 h-16 bg-blue-100 text-nic-blue rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MapPin size={28} />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-zinc-900">Reportar una Bahía</h4>
                      <p className="text-xs text-zinc-400 mt-1 max-w-[200px]">Bahías sucias, infraestructura dañada o problemas físicos en la parada.</p>
                    </div>
                  </button>

                  {/* Option Route (Ruta) */}
                  <button
                    onClick={() => setReportType('route')}
                    className="flex flex-col items-center gap-4 p-8 bg-zinc-50 rounded-2xl border border-zinc-200/60 hover:border-nic-red hover:bg-nic-red/5 hover:shadow-lg hover:shadow-red-500/5 transition-all text-center group cursor-pointer"
                  >
                    <div className="w-16 h-16 bg-red-100 text-nic-red rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Bus size={28} />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-zinc-900">Reportar una Ruta</h4>
                      <p className="text-xs text-zinc-400 mt-1 max-w-[200px]">Conducción imprudente, exceso de velocidad u choferes bajo efectos del alcohol.</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Back button */}
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
                >
                  &larr; Volver a tipos de reporte
                </button>

                {/* Selected Title Label */}
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100/80 flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-sm",
                    reportType === 'stop' ? "bg-nic-blue" : "bg-nic-red"
                  )}>
                    {reportType === 'stop' ? <MapPin size={16} /> : <Bus size={16} />}
                  </div>
                  <div>
                    <span className="text-[10px] font-black tracking-wider uppercase text-zinc-400">Reporte Seleccionado</span>
                    <h3 className="text-sm font-extrabold text-zinc-900">
                      {reportType === 'stop' ? 'Especificaciones de Bahía (Parada)' : 'Especificaciones de Ruta / Chofer'}
                    </h3>
                  </div>
                </div>

                {/* Dropdowns based on choice */}
                {reportType === 'stop' ? (
                  <div className="space-y-4">
                    {/* Search and write stops */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">
                        Escribe o busca la Bahía afectada *
                      </label>
                      <div className="relative">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                          <MapPin size={18} />
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="Escribe la parada (ej. Bahía 15, Parada Metrocentro, etc.)"
                          value={stopSearchText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setStopSearchText(val);
                            setSelectedStopId(val ? `custom:${val}` : '');
                            setIsStopDropdownOpen(true);
                          }}
                          onFocus={() => setIsStopDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setIsStopDropdownOpen(false), 250)}
                          className="w-full pl-12 pr-12 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-nic-blue/5 focus:border-nic-blue outline-none transition-all text-zinc-800 placeholder-zinc-400"
                        />
                        {stopSearchText && (
                          <button
                            type="button"
                            onClick={() => {
                              setStopSearchText('');
                              setSelectedStopId('');
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-all"
                          >
                            <span className="text-xs font-bold font-mono">X</span>
                          </button>
                        )}

                        {/* Suggestions Dropdown */}
                        {isStopDropdownOpen && (
                          <div className="absolute left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto py-2 animate-fadeIn divide-y divide-zinc-50">
                            {filteredStops.length > 0 ? (
                              <>
                                <div className="px-4 py-1.5 bg-zinc-50/50 text-[9px] font-black uppercase tracking-wider text-nic-blue border-b border-zinc-100 flex justify-between items-center">
                                  <span>Paradas oficiales sugeridas</span>
                                  <span className="text-[8px] text-zinc-400 normal-case font-bold">Haz clic para seleccionar</span>
                                </div>
                                {filteredStops.map((stop) => (
                                  <button
                                    key={stop.id}
                                    type="button"
                                    onMouseDown={() => {
                                      setSelectedStopId(stop.id);
                                      setStopSearchText(stop.name);
                                      setIsStopDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-5 py-3 hover:bg-zinc-50 transition-colors flex flex-col gap-0.5 cursor-pointer"
                                  >
                                    <span className="text-xs font-bold text-zinc-800">{stop.name}</span>
                                    {stop.generalInfo && (
                                      <span className="text-[10px] text-zinc-400 font-semibold">{stop.generalInfo}</span>
                                    )}
                                  </button>
                                ))}
                              </>
                            ) : (
                              <div className="px-5 py-4 text-center">
                                <p className="text-xs font-bold text-zinc-500">No encontramos paradas oficiales que coincidan.</p>
                                <p className="text-[10px] text-zinc-400 mt-1">Se registrará como un lugar personalizado: <strong className="text-nic-blue font-extrabold">"{stopSearchText}"</strong></p>
                              </div>
                            )}
                            {stopSearchText && filteredStops.length > 0 && (
                              <div className="p-2 bg-zinc-50/50 border-t border-zinc-100 text-center">
                                <button
                                  type="button"
                                  onMouseDown={() => {
                                    setSelectedStopId(`custom:${stopSearchText}`);
                                    setIsStopDropdownOpen(false);
                                  }}
                                  className="text-[10px] font-extrabold text-zinc-500 hover:text-zinc-800 py-1 px-3 bg-white border border-zinc-200 rounded-lg shadow-sm"
                                >
                                  Usar mi texto personalizado: "{stopSearchText}"
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Badge if selected verified stop */}
                      {selectedStopId && !selectedStopId.startsWith('custom:') && (
                        <div className="mt-2 ml-1 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 animate-fadeIn">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>✓ Parada oficial verificada</span>
                        </div>
                      )}
                    </div>

                    {/* Problem options */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">
                        ¿Cuál es el inconveniente? (Opcional)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { id: 'dirty', label: '🧹 Bahía sucia' },
                          { id: 'damaged', label: '🏚️ Infraestructura dañada' },
                          { id: 'other', label: '❓ Otro motivo' }
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            type="button"
                            onClick={() => setStopProblem(btn.id as any)}
                            className={cn(
                              "py-3 px-4 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer",
                              stopProblem === btn.id
                                ? "bg-nic-blue text-white border-nic-blue shadow-lg shadow-blue-500/10"
                                : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-300"
                            )}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Search and write routes */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">
                        Escribe o busca la Ruta *
                      </label>
                      <div className="relative">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                          <Bus size={18} />
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="Escribe la ruta (ej. Ruta 110, Ruta 105, etc.)"
                          value={routeSearchText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRouteSearchText(val);
                            setSelectedRouteId(val ? `custom:${val}` : '');
                            setIsRouteDropdownOpen(true);
                          }}
                          onFocus={() => setIsRouteDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setIsRouteDropdownOpen(false), 250)}
                          className="w-full pl-12 pr-12 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-nic-red/5 focus:border-nic-red outline-none transition-all text-zinc-800 placeholder-zinc-400"
                        />
                        {routeSearchText && (
                          <button
                            type="button"
                            onClick={() => {
                              setRouteSearchText('');
                              setSelectedRouteId('');
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-all"
                          >
                            <span className="text-xs font-bold font-mono">X</span>
                          </button>
                        )}

                        {/* Suggestions Dropdown */}
                        {isRouteDropdownOpen && (
                          <div className="absolute left-0 right-0 mt-2 bg-white border border-zinc-200 rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto py-2 animate-fadeIn divide-y divide-zinc-50">
                            {filteredRoutes.length > 0 ? (
                              <>
                                <div className="px-4 py-1.5 bg-zinc-50/50 text-[9px] font-black uppercase tracking-wider text-nic-red border-b border-zinc-100 flex justify-between items-center">
                                  <span>Rutas oficiales sugeridas</span>
                                  <span className="text-[8px] text-zinc-400 normal-case font-bold">Haz clic para seleccionar</span>
                                </div>
                                {filteredRoutes.map((route) => (
                                  <button
                                    key={route.id}
                                    type="button"
                                    onMouseDown={() => {
                                      setSelectedRouteId(route.id);
                                      setRouteSearchText(`${route.code} - ${route.name}`);
                                      setIsRouteDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-5 py-3 hover:bg-zinc-50 transition-colors flex flex-col gap-0.5 cursor-pointer"
                                  >
                                    <span className="text-xs font-bold text-zinc-800">{route.name}</span>
                                    {route.code && (
                                      <span className="text-[10px] text-zinc-400 font-semibold">Placa/Código: {route.code}</span>
                                    )}
                                  </button>
                                ))}
                              </>
                            ) : (
                              <div className="px-5 py-4 text-center">
                                <p className="text-xs font-bold text-zinc-500">No encontramos rutas oficiales que coincidan.</p>
                                <p className="text-[10px] text-zinc-400 mt-1">Se registrará como una ruta personalizada: <strong className="text-nic-red font-extrabold">"{routeSearchText}"</strong></p>
                              </div>
                            )}
                            {routeSearchText && filteredRoutes.length > 0 && (
                              <div className="p-2 bg-zinc-50/50 border-t border-zinc-100 text-center">
                                <button
                                  type="button"
                                  onMouseDown={() => {
                                    setSelectedRouteId(`custom:${routeSearchText}`);
                                    setIsRouteDropdownOpen(false);
                                  }}
                                  className="text-[10px] font-extrabold text-zinc-500 hover:text-zinc-800 py-1 px-3 bg-white border border-zinc-200 rounded-lg shadow-sm"
                                >
                                  Usar mi texto personalizado: "{routeSearchText}"
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Badge if selected verified route */}
                      {selectedRouteId && !selectedRouteId.startsWith('custom:') && (
                        <div className="mt-2 ml-1 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 animate-fadeIn">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>✓ Ruta oficial verificada</span>
                        </div>
                      )}
                    </div>

                    {/* Predefined route options */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">
                        Reporte predeterminado (Opcional)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {[
                          { id: 'drunk', label: '🍺 Conductor ebrio' },
                          { id: 'reckless', label: '⚠️ Conducción Temeraria' },
                          { id: 'careless', label: '🚨 Chofer descuidado' },
                          { id: 'other', label: '❓ Otro motivo' }
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            type="button"
                            onClick={() => setRouteProblem(btn.id as any)}
                            className={cn(
                              "py-3 px-3 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer",
                              routeProblem === btn.id
                                ? "bg-nic-red text-white border-nic-red shadow-lg shadow-red-500/10"
                                : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-300"
                            )}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Description details input (Opcional or requested) */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 ml-1">
                    Detalles o descripción (Opcional)
                  </label>
                  <textarea
                    placeholder="Describe los detalles del reporte para que podamos tomar medidas apropiadas de manera inmediata..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-nic-blue/5 focus:border-nic-blue outline-none h-32 resize-none transition-all text-zinc-800"
                  />
                </div>

                {errorMessage && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold">{errorMessage}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-4 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-600 rounded-2xl text-sm font-bold transition-all cursor-pointer text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      "flex-[2] py-4 text-white rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg",
                      reportType === 'stop' 
                        ? "bg-nic-blue hover:bg-blue-600 shadow-blue-500/10" 
                        : "bg-nic-red hover:bg-red-600 shadow-red-500/10"
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Enviando reporte...</span>
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        <span>Enviar Reporte Oficial</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
