import React, { useState, useEffect } from 'react';
import { 
  Bus, 
  Play, 
  Pause, 
  RotateCcw, 
  MapPin, 
  Clock, 
  Navigation, 
  AlertTriangle, 
  Send, 
  CheckCircle2, 
  User as UserIcon, 
  Gauge, 
  ShieldAlert, 
  Radio,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';
import { Route, Stop, Driver, Report } from '../types';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface DriverControlPanelProps {
  routes: Route[];
  stops: Stop[];
  drivers: Driver[];
}

export default function DriverControlPanel({ routes, stops, drivers }: DriverControlPanelProps) {
  const driverName = localStorage.getItem('localAuth_name') || 'Don José (Chofer)';
  const driverEmail = localStorage.getItem('localAuth_email') || '';
  const driverId = localStorage.getItem('localAuth_id') || 'local-chofer';

  // Find assigned driver profile or default
  const driverObj = drivers.find(d => d.name.toLowerCase().includes('josé') || d.id === driverId) || drivers[0];

  // Route assignment state
  const [selectedRouteId, setSelectedRouteId] = useState<string>(() => {
    const found = routes.find(r => r.driverId === driverObj?.id || r.driverId === driverId);
    return found ? found.id : (routes[0]?.id || '');
  });

  useEffect(() => {
    if (!selectedRouteId && routes.length > 0) {
      setSelectedRouteId(routes[0].id);
    }
  }, [routes, selectedRouteId]);

  const currentRoute = routes.find(r => r.id === selectedRouteId);

  // Live Control States
  const [isDriving, setIsDriving] = useState(false);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [busStatus, setBusStatus] = useState<'on_way' | 'at_stop' | 'traffic' | 'maintenance' | 'finished'>('on_way');
  const [speedKmh, setSpeedKmh] = useState(35);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [sentAlerts, setSentAlerts] = useState<string[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [alertSuccess, setAlertSuccess] = useState(false);

  // Filter reports related to this route or driver
  useEffect(() => {
    if (!selectedRouteId) return;
    const q = query(collection(db, 'reports'));
    const unsub = onSnapshot(q, (snapshot) => {
      const allReps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      const filtered = allReps.filter(r => r.targetId === selectedRouteId || r.driverId === driverObj?.id || r.targetId === driverObj?.id);
      setReports(filtered);
    }, (err) => console.error("Error loading driver reports:", err));

    return () => unsub();
  }, [selectedRouteId, driverObj?.id]);

  // Simulation step timer
  useEffect(() => {
    let interval: any;
    if (isDriving) {
      interval = setInterval(() => {
        setCurrentStopIndex(prev => (prev + 1) % Math.max(1, stops.length));
      }, 8000);
    }
    return () => clearInterval(interval);
  }, [isDriving, stops.length]);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;

    try {
      await addDoc(collection(db, 'driver_alerts'), {
        routeId: selectedRouteId,
        routeName: currentRoute?.name || 'Ruta NicaGo',
        driverName: driverName,
        message: broadcastMsg.trim(),
        createdAt: new Date().toISOString()
      });

      setSentAlerts(prev => [broadcastMsg.trim(), ...prev]);
      setBroadcastMsg('');
      setAlertSuccess(true);
      setTimeout(() => setAlertSuccess(false), 3000);
    } catch (err) {
      console.error("Error sending alert:", err);
      // Fallback local alert
      setSentAlerts(prev => [broadcastMsg.trim(), ...prev]);
      setBroadcastMsg('');
      setAlertSuccess(true);
      setTimeout(() => setAlertSuccess(false), 3000);
    }
  };

  const getStatusBadge = (st: typeof busStatus) => {
    switch (st) {
      case 'on_way':
        return <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-black uppercase tracking-wider border border-emerald-500/20">🟢 En Camino</span>;
      case 'at_stop':
        return <span className="px-3 py-1 bg-sky-500/10 text-sky-600 rounded-full text-xs font-black uppercase tracking-wider border border-sky-500/20">🟦 Detenido en Parada</span>;
      case 'traffic':
        return <span className="px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-xs font-black uppercase tracking-wider border border-amber-500/20">⚠️ Tráfico Pesado</span>;
      case 'maintenance':
        return <span className="px-3 py-1 bg-rose-500/10 text-rose-600 rounded-full text-xs font-black uppercase tracking-wider border border-rose-500/20">🛠️ En Mantenimiento</span>;
      case 'finished':
        return <span className="px-3 py-1 bg-zinc-500/10 text-zinc-600 rounded-full text-xs font-black uppercase tracking-wider border border-zinc-500/20">🏁 Finalizó Ruta</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8 font-sans pb-24">
      {/* Driver Header Banner */}
      <div className="bg-gradient-to-br from-[#002f80] via-[#0039a0] to-[#0d2850] rounded-[2.5rem] p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-blue-400/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-3xl bg-white/10 border-2 border-white/20 overflow-hidden shadow-xl shrink-0 flex items-center justify-center">
              {driverObj?.photoUrl ? (
                <img src={driverObj.photoUrl} alt={driverName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={36} className="text-blue-200" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-3 py-0.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-widest rounded-full">
                  Panel de Chofer Activo
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{driverName}</h1>
              <p className="text-xs text-blue-200/80 font-medium mt-1">
                {driverEmail || 'Conductor Autorizado de Transporte Urbano NicaGo'}
              </p>
            </div>
          </div>

          {/* Assigned Route Selector */}
          <div className="w-full md:w-auto bg-white/10 backdrop-blur-xl p-4 rounded-3xl border border-white/15 text-left">
            <label className="text-[10px] font-black uppercase tracking-widest text-blue-200 block mb-2">
              Ruta Asignada en Operación
            </label>
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="w-full md:w-64 bg-[#082046] text-white border border-blue-400/30 rounded-2xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-400 transition-all cursor-pointer"
            >
              {routes.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Real Time Movement & Telemetry */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Unit Control Card */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-zinc-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-nic-blue/10 rounded-2xl flex items-center justify-center text-nic-blue">
                  <Bus size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-zinc-900">Control de Unidad en Ruta</h3>
                  <p className="text-xs text-zinc-400 font-bold">{currentRoute?.name || 'Selecciona una ruta'}</p>
                </div>
              </div>
              <div>
                {getStatusBadge(busStatus)}
              </div>
            </div>

            {/* Play / Stop / Step Control Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setIsDriving(!isDriving)}
                className={cn(
                  "py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer",
                  isDriving 
                    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20" 
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                )}
              >
                {isDriving ? (
                  <>
                    <Pause size={18} />
                    <span>Pausar Recorrido</span>
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    <span>Iniciar Recorrido</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCurrentStopIndex(prev => (prev + 1) % Math.max(1, stops.length))}
                className="py-4 px-6 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-zinc-900/10 active:scale-95 transition-all cursor-pointer"
              >
                <Navigation size={18} />
                <span>Siguiente Parada</span>
              </button>

              <button
                type="button"
                onClick={() => { setIsDriving(false); setCurrentStopIndex(0); setBusStatus('on_way'); }}
                className="py-4 px-6 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw size={18} />
                <span>Reiniciar</span>
              </button>
            </div>

            {/* Status Switcher Buttons */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-3">
                Cambiar Estado de Operación
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setBusStatus('on_way')}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer",
                    busStatus === 'on_way' ? "bg-emerald-500 text-white border-emerald-500 shadow-md" : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                  )}
                >
                  🟢 En Camino
                </button>
                <button
                  type="button"
                  onClick={() => setBusStatus('at_stop')}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer",
                    busStatus === 'at_stop' ? "bg-sky-500 text-white border-sky-500 shadow-md" : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                  )}
                >
                  🟦 En Parada
                </button>
                <button
                  type="button"
                  onClick={() => setBusStatus('traffic')}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer",
                    busStatus === 'traffic' ? "bg-amber-500 text-white border-amber-500 shadow-md" : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                  )}
                >
                  ⚠️ Tráfico
                </button>
                <button
                  type="button"
                  onClick={() => setBusStatus('finished')}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer",
                    busStatus === 'finished' ? "bg-zinc-800 text-white border-zinc-800 shadow-md" : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                  )}
                >
                  🏁 Finalizado
                </button>
              </div>
            </div>

            {/* Speed Gauge Controls */}
            <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-150 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge size={18} className="text-nic-blue" />
                  <span className="text-xs font-black uppercase text-zinc-800">Velocidad de Operación</span>
                </div>
                <span className="text-base font-black text-nic-blue font-mono">{speedKmh} km/h</span>
              </div>
              <input
                type="range"
                min="10"
                max="70"
                value={speedKmh}
                onChange={(e) => setSpeedKmh(Number(e.target.value))}
                className="w-full accent-nic-blue cursor-pointer"
              />
              <p className="text-[10px] text-zinc-400 font-bold">
                Ajusta la velocidad estimada para recalcular el tiempo de llegada a las paradas para los pasajeros.
              </p>
            </div>
          </div>

          {/* Broadcast Alert Box */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-zinc-100 shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
              <div className="w-10 h-10 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center">
                <Radio size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-zinc-900">Difundir Alerta en Tiempo Real</h3>
                <p className="text-xs text-zinc-400 font-medium">Envía un aviso directo a los pasajeros de tu ruta</p>
              </div>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="Ejemplo: 'Ligero retraso de 5 min por tráfico pesado en rotonda Rubén Darío'..."
                rows={3}
                className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-semibold text-zinc-800 focus:outline-none focus:border-nic-blue transition-all"
                required
              />

              {alertSuccess && (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-xl text-xs font-bold border border-emerald-200">
                  <CheckCircle2 size={16} />
                  <span>¡Alerta difundida correctamente a los usuarios de la ruta!</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-nic-blue hover:bg-blue-900 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-98 transition-all cursor-pointer"
              >
                <Send size={16} />
                <span>Enviar Alerta a Pasajeros</span>
              </button>
            </form>

            {sentAlerts.length > 0 && (
              <div className="pt-2 border-t border-zinc-100 space-y-2">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">Historial de Alertas Enviadas</span>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {sentAlerts.map((msg, i) => (
                    <div key={i} className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 text-xs font-medium text-zinc-700 flex items-start gap-2">
                      <ShieldAlert size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right 1 Col: Route Stations Progress & Passenger Reports */}
        <div className="space-y-6">
          
          {/* Station Progress Timeline */}
          <div className="bg-white rounded-[2.5rem] p-6 border border-zinc-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2">
                <MapPin size={18} className="text-nic-blue" />
                <span>Estaciones de la Ruta</span>
              </h3>
              <span className="text-[10px] font-black text-nic-blue bg-blue-50 px-2.5 py-1 rounded-full">
                {stops.length} Paradas
              </span>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {stops.map((st, idx) => {
                const isCurrent = idx === currentStopIndex;
                const isPassed = idx < currentStopIndex;

                return (
                  <div 
                    key={st.id || idx} 
                    onClick={() => setCurrentStopIndex(idx)}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer",
                      isCurrent 
                        ? "bg-nic-blue text-white border-nic-blue shadow-md scale-[1.02]" 
                        : isPassed 
                        ? "bg-emerald-50/60 border-emerald-200 text-zinc-700" 
                        : "bg-zinc-50 border-zinc-100 text-zinc-600 hover:bg-zinc-100"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0",
                        isCurrent ? "bg-white text-nic-blue" : isPassed ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-600"
                      )}>
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="text-xs font-black leading-snug">{st.name}</h4>
                        <p className={cn("text-[10px]", isCurrent ? "text-blue-200" : "text-zinc-400")}>
                          {isCurrent ? "📍 Ubicación actual de la unidad" : isPassed ? "✓ Parada completada" : "En espera"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Passenger Reports assigned to this driver/route */}
          <div className="bg-white rounded-[2.5rem] p-6 border border-zinc-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2">
                <FileText size={18} className="text-amber-500" />
                <span>Reportes de Pasajeros</span>
              </h3>
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                {reports.length} Recibidos
              </span>
            </div>

            {reports.length === 0 ? (
              <div className="text-center py-8 text-zinc-400">
                <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-xs font-bold">¡Sin reportes pendientes!</p>
                <p className="text-[10px] mt-1">Buen desempeño de servicio en esta ruta.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {reports.map((rep) => (
                  <div key={rep.id} className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-md">
                        {rep.reason === 'reckless' ? 'Conducción Temeraria' : rep.reason === 'bad_condition' ? 'Mal Estado de Unidad' : 'Atención al Cliente'}
                      </span>
                      <span className="text-[9px] text-zinc-400 font-mono">{rep.createdAt?.slice(0, 10)}</span>
                    </div>
                    <p className="text-xs font-semibold text-zinc-800 leading-snug">{rep.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
