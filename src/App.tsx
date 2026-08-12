/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Search, 
  Settings, 
  Navigation as NavIcon, 
  Bus, 
  Clock, 
  ChevronRight,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Map as MapIcon,
  LogOut,
  Bell,
  Navigation,
  Info,
  Globe,
  ChevronDown,
  Menu,
  X,
  AlertCircle,
  User as UserIcon
} from 'lucide-react';
import { Route, Stop, RouteOption, Driver, Schedule, isBoatRoute } from './types';
import { RouteService } from './services/routeService';
import { cn } from './lib/utils';
import AdminPanel from './components/AdminPanel';
import RouteSearch from './components/RouteSearch';
import MapView from './components/MapView';
import UserProfile from './components/UserProfile';
import Login from './components/Login';
import { seedDatabase, clearDatabase } from './services/seedService';
import { auth, db } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firestoreErrorHandler';
import { useLanguage } from './lib/LanguageContext';
import UserReportModule from './components/UserReportModule';

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Persistent States (Prevents updates/refresh from resetting view back to the search page)
  const [activeTab, setActiveTabState] = useState<'search' | 'map' | 'reports' | 'profile' | 'admin'>(() => {
    const saved = localStorage.getItem('app_activeTab');
    return (saved as any) || 'search';
  });

  const [selectedRoute, setSelectedRouteState] = useState<RouteOption | null>(() => {
    try {
      const saved = localStorage.getItem('app_selectedRoute');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [origin, setOriginState] = useState<{ lat: number; lng: number; address: string } | null>(() => {
    try {
      const saved = localStorage.getItem('app_origin');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [destination, setDestinationState] = useState<{ lat: number; lng: number; address: string } | null>(() => {
    try {
      const saved = localStorage.getItem('app_destination');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [navMode, setNavModeState] = useState<'real-time' | 'static' | null>(() => {
    const saved = localStorage.getItem('app_navMode');
    return (saved as any) || null;
  });

  // Safe wrapping setters to keep localStorage and Browser History synchronized
  const setActiveTab = (tab: 'search' | 'map' | 'reports' | 'profile' | 'admin') => {
    localStorage.setItem('app_activeTab', tab);
    setActiveTabState(tab);

    const state = { tab, hasRoute: !!selectedRoute, navMode: navMode };
    const current = window.history.state;
    if (!current || current.tab !== tab || current.hasRoute !== !!selectedRoute || current.navMode !== navMode) {
      window.history.pushState(state, '');
    }
  };

  const setSelectedRoute = (route: RouteOption | null) => {
    if (route) {
      localStorage.setItem('app_selectedRoute', JSON.stringify(route));
    } else {
      localStorage.removeItem('app_selectedRoute');
    }
    setSelectedRouteState(route);

    const state = { tab: activeTab, hasRoute: !!route, navMode: route ? navMode : null };
    const current = window.history.state;
    if (!current || current.tab !== activeTab || current.hasRoute !== !!route || current.navMode !== (route ? navMode : null)) {
      window.history.pushState(state, '');
    }
  };

  const setOrigin = (or: { lat: number; lng: number; address: string } | null) => {
    if (or) {
      localStorage.setItem('app_origin', JSON.stringify(or));
    } else {
      localStorage.removeItem('app_origin');
    }
    setOriginState(or);
    setSelectedRoute(null);
    setNavMode(null);
  };

  const setDestination = (dest: { lat: number; lng: number; address: string } | null) => {
    if (dest) {
      localStorage.setItem('app_destination', JSON.stringify(dest));
    } else {
      localStorage.removeItem('app_destination');
    }
    setDestinationState(dest);
    setSelectedRoute(null);
    setNavMode(null);
  };

  const setNavMode = (mode: 'real-time' | 'static' | null) => {
    if (mode) {
      localStorage.setItem('app_navMode', mode);
    } else {
      localStorage.removeItem('app_navMode');
    }
    setNavModeState(mode);

    const state = { tab: activeTab, hasRoute: !!selectedRoute, navMode: mode };
    const current = window.history.state;
    if (!current || current.tab !== activeTab || current.hasRoute !== !!selectedRoute || current.navMode !== mode) {
      window.history.pushState(state, '');
    }
  };

  // Synchronize history states on mount and popstate events
  useEffect(() => {
    // Replace initial state so we have a clean anchor
    window.history.replaceState({
      tab: activeTab,
      hasRoute: !!selectedRoute,
      navMode: navMode
    }, '');

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      if (state) {
        if (state.tab) {
          setActiveTabState(state.tab);
          localStorage.setItem('app_activeTab', state.tab);
        }
        if (!state.hasRoute) {
          setSelectedRouteState(null);
          localStorage.removeItem('app_selectedRoute');
          setNavModeState(null);
          localStorage.removeItem('app_navMode');
        }
        if (state.navMode !== undefined) {
          setNavModeState(state.navMode);
          if (state.navMode) {
            localStorage.setItem('app_navMode', state.navMode);
          } else {
            localStorage.removeItem('app_navMode');
          }
        }
      } else {
        // Fallback to default search view
        setActiveTabState('search');
        localStorage.setItem('app_activeTab', 'search');
        setSelectedRouteState(null);
        localStorage.removeItem('app_selectedRoute');
        setNavModeState(null);
        localStorage.removeItem('app_navMode');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, selectedRoute, navMode]);

  const [showNavChoice, setShowNavChoice] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showArrivalToast, setShowArrivalToast] = useState(false);

  // New states for real-time mobile responsive layouts
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMapTab, setMobileMapTab] = useState<'steps' | 'map'>('map');

  const [realTimeEtaToBoard, setRealTimeEtaToBoard] = useState<number>(0);
  const [realTimeEtaToDest, setRealTimeEtaToDest] = useState<number>(0);

  useEffect(() => {
    if (selectedRoute) {
      setRealTimeEtaToBoard(selectedRoute.etaToBoardMinutes ?? 5);
      setRealTimeEtaToDest(selectedRoute.estimatedTimeMinutes ?? 15);
    }
  }, [selectedRoute]);

  useEffect(() => {
    if (!selectedRoute) return;
    const interval = setInterval(() => {
      setRealTimeEtaToBoard(prev => {
        if (prev > 1) return prev - 1;
        return 1;
      });
      setRealTimeEtaToDest(prev => {
        if (prev > 2) return prev - 1;
        return 2;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedRoute]);

  useEffect(() => {
    const checkDevice = () => {
      const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileUA = /android|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od|ad)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(ua);
      const isSmallScreen = window.innerWidth <= 1024;
      setIsMobile(isMobileUA || isSmallScreen);
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // World Context
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        // Todos los que inicien sesión de Google entran como pasajeros (user)
        setUserRole('user');
        localStorage.removeItem('localAuth');
      } else {
        const storedRole = localStorage.getItem('localAuth');
        if (storedRole === 'admin' || storedRole === 'user') {
          setUserRole(storedRole as 'admin' | 'user');
        } else {
          setUserRole(null);
        }
      }
      setIsInitializing(false);
    });

    // Real-time feeds for system context
    const unsubRoutes = onSnapshot(collection(db, 'routes'), async (s) => {
      const docs = s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route));
      setRoutes(docs);
      if (s.empty) {
        console.log("Database empty. Auto-seeding 5 connection points dataset...");
        await seedDatabase();
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'routes'));
    const unsubDrivers = onSnapshot(collection(db, 'drivers'), s => setDrivers(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver))), (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));
    const unsubStops = onSnapshot(collection(db, 'stops'), s => {
      const docs = s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stop));
      setStops(docs);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'stops'));
    const unsubSchedules = onSnapshot(collection(db, 'schedules'), s => setSchedules(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule))), (error) => handleFirestoreError(error, OperationType.GET, 'schedules'));

    return () => {
      unsubAuth();
      unsubRoutes();
      unsubDrivers();
      unsubStops();
      unsubSchedules();
    };
  }, []);

  const handleLogin = (role: 'admin' | 'user') => {
    localStorage.setItem('localAuth', role);
    setUserRole(role);
  };

  const handleRouteSelect = (route: RouteOption) => {
    setSelectedRoute(route);
    setMobileMapTab('map');
    setActiveTab('map');
    setShowNavChoice(true);
  };

  const startNavigation = (mode: 'real-time' | 'static') => {
    setNavMode(mode);
    setShowNavChoice(false);
    setActiveTab('map');
  };

  const handleArrival = () => {
    setSelectedRoute(null);
    setOrigin(null);
    setDestination(null);
    setNavMode(null);
    setShowArrivalToast(true);
    setTimeout(() => {
      setShowArrivalToast(false);
    }, 6000);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-nic-blue flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center text-white"
        >
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-nic-blue shadow-lg mx-auto mb-6 animate-bounce">
            <Bus size={32} />
          </div>
          <h2 className="text-xl font-bold">{t('app.loading')}</h2>
          <p className="text-blue-100/60 text-sm mt-2">{t('app.loadingSub')}</p>
        </motion.div>
      </div>
    );
  }

  if (!userRole) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-nic-blue/10 selection:text-nic-blue">
      {/* Header */}
      <header className="sticky top-0 z-[4000] bg-white/80 backdrop-blur-xl border-b border-zinc-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setActiveTab('search'); setIsMobileMenuOpen(false); }}>
            <div className="w-11 h-11 bg-nic-blue rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-900/20 group-hover:scale-105 transition-transform">
              <Bus size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-zinc-900 leading-none">
                Nica<span className="text-nic-blue">Go</span>
              </h1>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-1">{t('app.subtitle')}</p>
            </div>
          </div>
          
          {/* Unifed Clean Navigation bar, visible ONLY on desktop */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-100/80 p-1.5 rounded-2xl border border-zinc-200/50">
            <button 
              onClick={() => setActiveTab('search')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                activeTab === 'search' ? "bg-white text-nic-blue shadow-sm font-extrabold" : "text-zinc-500 hover:text-zinc-800"
              )}
            >
              Buscar
            </button>
            <button 
              onClick={() => setActiveTab('map')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                activeTab === 'map' ? "bg-white text-nic-blue shadow-sm font-extrabold" : "text-zinc-500 hover:text-zinc-800"
              )}
            >
              Mapa {selectedRoute && <span className="inline-block w-2 h-2 rounded-full bg-rose-500 ml-1.5 animate-pulse" />}
            </button>
            <button 
              onClick={() => setActiveTab('reports')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                activeTab === 'reports' ? "bg-white text-nic-blue shadow-sm font-extrabold" : "text-zinc-500 hover:text-zinc-800"
              )}
            >
              Reportar
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                activeTab === 'profile' ? "bg-white text-nic-blue shadow-sm font-extrabold" : "text-zinc-500 hover:text-zinc-800"
              )}
            >
              Perfil
            </button>
            {userRole === 'admin' && (
              <button 
                onClick={() => setActiveTab('admin')}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                  activeTab === 'admin' ? "bg-white text-nic-blue shadow-sm font-extrabold" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                Admin
              </button>
            )}
          </nav>

          {/* Hamburger button, visible ONLY on mobile */}
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2.5 text-zinc-700 hover:text-nic-blue bg-white hover:bg-zinc-50 rounded-2xl border border-zinc-200/80 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.08),0_4px_12px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.1),0_4px_12px_-2px_rgba(0,0,0,0.05)] hover:border-nic-blue/30 focus:outline-none focus:ring-2 focus:ring-nic-blue/20 cursor-pointer transition-all duration-300 active:scale-95 flex items-center justify-center"
            title="Abrir menú"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      <main className={cn("max-w-7xl mx-auto p-4 md:p-6 pb-20", activeTab === 'map' && "p-2 sm:p-4 md:p-6 pb-12 sm:pb-20")}>
        <AnimatePresence mode="wait">
          {activeTab === 'admin' ? (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="w-full"
            >
              <AdminPanel />
            </motion.div>
          ) : activeTab === 'reports' ? (
            <motion.div
              key="reports"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="w-full"
            >
              <UserReportModule stops={stops} routes={routes} />
            </motion.div>
          ) : activeTab === 'profile' ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="w-full"
            >
              <UserProfile onLogout={() => { setUserRole(null); setActiveTab('search'); }} />
            </motion.div>
          ) : activeTab === 'search' ? (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <RouteSearch 
                onRouteSelect={handleRouteSelect} 
                onOriginChange={setOrigin}
                onDestinationChange={setDestination}
              />
            </motion.div>
          ) : (
            <motion.div
              key="map"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full text-left"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
                  {/* Responsive mobile controller for route tracking */}
                  {isMobile && selectedRoute && (
                    <div className="col-span-1 flex bg-white p-1 rounded-2xl border border-zinc-200/80 shadow-sm gap-1">
                      <button
                        type="button"
                        onClick={() => setMobileMapTab('steps')}
                        className={cn(
                          "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5",
                          mobileMapTab === 'steps' ? "bg-nic-blue text-white shadow-md font-extrabold" : "text-zinc-500 hover:text-zinc-800"
                        )}
                      >
                        📋 {language === 'es' ? 'Ver Pasos' : 'View Steps'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileMapTab('map')}
                        className={cn(
                          "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5",
                          mobileMapTab === 'map' ? "bg-nic-blue text-white shadow-md font-extrabold" : "text-zinc-500 hover:text-zinc-800"
                        )}
                      >
                        🗺️ {language === 'es' ? 'Ver Mapa' : 'View Map'}
                        {selectedRoute && <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse ml-1" />}
                      </button>
                    </div>
                  )}

                  {/* Left Navigation Details Panel */}
                  {selectedRoute && (
                    <div className={cn(
                      "lg:col-span-4 space-y-6",
                      isMobile && mobileMapTab !== 'steps' && "hidden lg:block"
                    )}>
                  <div className="bg-white rounded-3xl shadow-md border border-zinc-200/80 overflow-hidden flex flex-col justify-between h-auto lg:h-full min-h-[400px] lg:min-h-[500px]">
                    <div className="p-4 bg-nic-blue text-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => { setSelectedRoute(null); setNavMode(null); }} 
                          className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                          title="Volver al mapa general"
                        >
                          <ArrowLeft size={18} />
                        </button>
                        <h2 className="font-extrabold text-white text-sm">
                          {navMode === 'real-time' ? t('nav.titleReal') : t('nav.titleStatic')}
                        </h2>
                      </div>
                      <div className="px-2 py-0.5 bg-white/20 rounded text-[9px] font-black uppercase tracking-wider">
                        {navMode === 'real-time' ? t('nav.live') : t('nav.static')}
                      </div>
                    </div>

                    <div className="p-6 space-y-6 flex-1 overflow-y-auto max-h-[58vh] lg:max-h-[480px] custom-scrollbar">
                      {/* Driver Info Card */}
                      {selectedRoute?.steps && selectedRoute.steps.some(s => s.routeId) && (() => {
                        const routeId = selectedRoute.steps.find(s => s.routeId)?.routeId;
                        const route = routes.find(r => r.id === routeId);
                        let driver = drivers.find(d => d.id === route?.driverId);
                        const isBoat = route ? isBoatRoute(route.name) : false;
                        
                        if (!driver && isBoat) {
                          driver = {
                            id: 'captain-default',
                            name: 'Capitán Humberto Rostrán',
                            age: 44,
                            photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400',
                            idCardPhotoUrl: '',
                            licensePhotoUrl: '',
                            phoneNumber: '+505 8812-4455',
                            experience: '12 años de navegación lacustre',
                            generalInfo: 'Capitán certificado para tránsito en el Lago Xolotlán.'
                          };
                        }
                        
                        if (!driver) return null;
                        return (
                          <div className="p-4 bg-zinc-50 border border-zinc-150 rounded-2xl flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl overflow-hidden border border-zinc-200 shrink-0">
                              <img src={driver.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-black text-nic-blue uppercase tracking-widest">
                                {isBoat ? 'Capitán Registrado' : t('nav.assignedDriver')}
                              </p>
                              <h4 className="text-sm font-bold text-zinc-900 truncate">{driver.name}</h4>
                              <p className="text-[10px] text-zinc-400 italic truncate">"{driver.generalInfo}"</p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* DETALLE COMPLETO DEL VIAJE (TRIP COMPREHENSIVE DETAILS) */}
                      <div className="p-5 bg-gradient-to-br from-indigo-50/70 to-blue-50/40 border border-blue-200/50 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-150/40">
                          <Info size={16} className="text-nic-blue" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">Resumen Oficial de Tu Viaje</h4>
                        </div>
                        
                        <div className="space-y-3.5 text-xs text-zinc-700 text-left">
                          {/* Boarding Info ("a dónde se agarra") */}
                          <div className="flex items-start gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-nic-blue mt-1 shrink-0 shadow-sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-black uppercase text-zinc-400">¿Dónde se agarra? (Abordaje)</p>
                              <p className="font-extrabold text-zinc-900 truncate">
                                {stops.find(s => s.id === selectedRoute?.steps?.[0]?.stopId)?.name || 'Punto de Inicio'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Landing Info ("a dónde se baja") */}
                          <div className="flex items-start gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0 shadow-sm" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-black uppercase text-zinc-400">¿Dónde se baja? (Desembarque)</p>
                              <p className="font-extrabold text-zinc-900 truncate">
                                {stops.find(s => s.id === selectedRoute?.steps?.[(selectedRoute?.steps?.length || 1) - 1]?.stopId)?.name || 'Punto de Destino'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pb-1">
                            {/* Total stops ("cuántas paradas") */}
                            <div className="bg-white/80 border border-zinc-150/40 p-2.5 rounded-xl">
                              <p className="text-[9px] font-black uppercase text-zinc-400">Total Paradas</p>
                              <p className="text-sm font-black text-zinc-950 mt-0.5">
                                {selectedRoute.totalStops} paradas
                              </p>
                            </div>

                            {/* Direct vs transfer ("si es directo, si hay transbordo") */}
                            <div className="bg-white/80 border border-zinc-150/40 p-2.5 rounded-xl">
                              <p className="text-[9px] font-black uppercase text-zinc-400">Tipo de Viaje</p>
                              <p className="text-xs font-black text-zinc-950 mt-1 leading-none">
                                {selectedRoute?.steps?.some(s => s.type === 'transfer') ? (
                                  <span className="text-indigo-600 block">Con Transbordo</span>
                                ) : (
                                  <span className="text-emerald-600 block">Directo</span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Live counters ("a cuánto tiempo llega esa ruta / tiempo real") */}
                          <div className="bg-white border border-sky-200/50 p-3 rounded-xl shadow-inner mt-1 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-bold uppercase text-zinc-500 flex items-center gap-1">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                                </span>
                                Llega a la parada de inicio:
                              </span>
                              <span className="text-xs font-black text-nic-blue">
                                {realTimeEtaToBoard > 1 ? `${realTimeEtaToBoard} min` : '¡Llegando ahora!'}
                              </span>
                            </div>

                            <div className="flex justify-between items-center border-t border-zinc-150/40 pt-2">
                              <span className="text-[9px] font-bold uppercase text-zinc-500 flex items-center gap-1">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                Tiempo total de viaje estimado:
                              </span>
                              <span className="text-xs font-black text-emerald-600">
                                {realTimeEtaToDest} min
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {navMode === 'static' ? (
                        <div className="space-y-4">
                          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 flex gap-3">
                            <Bell className="text-nic-blue shrink-0" size={18} />
                            <div>
                              <p className="text-xs font-bold text-zinc-900">{t('nav.guideCenter')}</p>
                              <p className="text-[11px] text-zinc-500 leading-tight">{t('nav.guideCenterDesc')}</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {(selectedRoute?.steps || []).map((step, idx) => {
                              const stop = stops.find(s => s.id === step.stopId);
                              const schedule = schedules.find(s => s.routeId === step.routeId && s.stopId === step.stopId);
                              return (
                                <div key={idx} className="p-4 bg-white border border-zinc-100 rounded-xl shadow-sm flex gap-3 items-start group hover:border-nic-blue/20 transition-all">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                    step.type === 'board' ? "bg-nic-blue/10 text-nic-blue" : 
                                    step.type === 'transfer' ? "bg-indigo-100 text-indigo-600" : "bg-zinc-100 text-zinc-600"
                                  )}>
                                    {step.type === 'board' ? <Bus size={16} /> : 
                                     step.type === 'transfer' ? <ArrowLeft className="rotate-180" size={16} /> : <MapPin size={16} />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <p className="text-xs font-bold text-zinc-900 truncate">{stop?.name || step.description}</p>
                                      {schedule && (
                                        <span className="text-[9px] font-black text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full shrink-0">
                                          {schedule.arrivalTime}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                                      {step.type === 'board' ? t('nav.boardInstructions') : 
                                       step.type === 'transfer' ? `${t('nav.transferInstructions')} ${idx === 1 ? '5-10' : t('nav.nextOne')}` : 
                                       t('nav.arriveInstructions')}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="relative h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: "0%" }}
                              animate={{ width: "35%" }}
                              className="absolute top-0 left-0 h-full bg-nic-blue"
                            />
                          </div>
                          <div className="flex justify-between text-[9px] font-black text-zinc-400 uppercase tracking-wider">
                            <span>{t('nav.start')}</span>
                            <span>35% {t('nav.completed')}</span>
                            <span>{t('nav.end')}</span>
                          </div>

                          <div className="space-y-6">
                            {(selectedRoute?.steps || []).map((step, idx) => {
                              const stop = stops.find(s => s.id === step.stopId);
                              const schedule = schedules.find(s => s.routeId === step.routeId && s.stopId === step.stopId);
                              const totalStepsLength = selectedRoute?.steps?.length || 0;
                              return (
                                <div key={idx} className="flex gap-4 relative">
                                  {idx !== totalStepsLength - 1 && (
                                    <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-zinc-100" />
                                  )}
                                  <div className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10",
                                    idx === 0 ? "bg-nic-blue text-white shadow-lg shadow-nic-blue/20" : "bg-zinc-100 text-zinc-400"
                                  )}>
                                    {step.type === 'board' ? <Bus size={12} /> : 
                                     step.type === 'transfer' ? <ArrowLeft className="rotate-180" size={12} /> : <MapPin size={12} />}
                                  </div>
                                  <div className="pb-6 flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <p className={cn(
                                        "text-xs font-semibold truncate",
                                        idx === 0 ? "text-zinc-900 font-extrabold" : "text-zinc-400"
                                      )}>{stop?.name || step.description}</p>
                                      {schedule && (
                                        <span className="text-[9px] font-black text-sky-600 rounded-full shrink-0">
                                          {schedule.arrivalTime}
                                        </span>
                                      )}
                                    </div>
                                    {idx === 0 && (
                                      <p className="text-[9px] text-nic-blue font-black uppercase tracking-wider mt-0.5">{t('nav.nextUnit')}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Clock size={16} />
                        <span className="text-xs font-semibold">{t('nav.arrivePrefix')} {selectedRoute.estimatedTimeMinutes} {t('nav.arriveSuffix')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { 
                            setNavMode(null); 
                            setSelectedRoute(null); 
                            setOrigin(null);
                            setDestination(null);
                          }}
                          className="px-3 py-2 bg-nic-red text-white rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider hover:bg-nic-red/90 transition-colors cursor-pointer"
                        >
                          {t('nav.finish')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Right Panel: Full screen map container */}
              <div className={cn(
                selectedRoute ? "lg:col-span-8 h-[550px] lg:h-auto min-h-[480px]" : "lg:col-span-12 h-[600px] lg:h-[680px] w-full min-h-[500px]",
                "rounded-2xl sm:rounded-3xl overflow-hidden border border-zinc-200/80 shadow-md relative bg-zinc-100 w-full",
                isMobile && selectedRoute && mobileMapTab !== 'map' && "hidden lg:block",
                isMobile && !selectedRoute && "h-[calc(100dvh-130px)] min-h-[450px] max-h-[850px]",
                isMobile && selectedRoute && mobileMapTab === 'map' && "h-[calc(100dvh-180px)] min-h-[450px] max-h-[850px]"
              )}>
                <MapView 
                  origin={origin} 
                  destination={destination} 
                  selectedRoute={selectedRoute}
                  onArrival={handleArrival}
                />
              </div>
            </div>
        </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Choice Modal */}
      <AnimatePresence>
        {showNavChoice && (
          <div className="fixed inset-0 z-[14000] overflow-y-auto flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNavChoice(false)}
              className="fixed inset-0 bg-zinc-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl z-10 my-auto p-6 sm:p-8 text-center"
            >
              <div className="w-16 h-16 bg-nic-blue/10 rounded-2xl flex items-center justify-center text-nic-blue mx-auto mb-5 shadow-inner">
                <Navigation size={32} />
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 mb-2 tracking-tight">{t('nav.howToTravel')}</h2>
              <p className="text-zinc-500 text-xs mb-5 leading-relaxed">{t('nav.travelDesc')}</p>
              
              {selectedRoute && (
                <div className="mb-6 p-5 bg-gradient-to-br from-zinc-50 to-zinc-100 border border-zinc-200 rounded-2xl text-left space-y-3.5 shadow-sm">
                  <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/60">
                    <Bus size={16} className="text-nic-blue shrink-0" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900">Resumen Oficial del Viaje</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-zinc-700">
                    <div className="space-y-1">
                      <p className="font-bold text-[9px] text-zinc-400 uppercase tracking-wider leading-none">🛫 ¿Dónde se agarra? (Abordaje)</p>
                      <p className="font-extrabold text-zinc-900">
                        {stops.find(s => s.id === selectedRoute?.steps?.[0]?.stopId)?.name || 'Punto de Inicio'}
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="font-bold text-[9px] text-zinc-400 uppercase tracking-wider leading-none">🛬 ¿Dónde se baja? (Desembarque)</p>
                      <p className="font-extrabold text-zinc-900">
                        {stops.find(s => s.id === selectedRoute?.steps?.[(selectedRoute?.steps?.length || 1) - 1]?.stopId)?.name || 'Punto de Destino'}
                      </p>
                    </div>

                    <div className="space-y-1 bg-white p-2.5 rounded-xl border border-zinc-150/50 shadow-sm">
                      <p className="font-bold text-[9px] text-zinc-400 uppercase tracking-wider leading-none">📋 Recorrido</p>
                      <p className="font-black text-zinc-900">
                        {selectedRoute.totalStops} paradas en total
                      </p>
                    </div>

                    <div className="space-y-1 bg-white p-2.5 rounded-xl border border-zinc-150/50 shadow-sm">
                      <p className="font-bold text-[9px] text-zinc-400 uppercase tracking-wider leading-none">⚡ Modalidad</p>
                      <p className="font-black text-emerald-600">
                        {selectedRoute?.steps?.some(s => s.type === 'transfer') ? 'Con Transbordo' : 'Directo (Sin Escalas)'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-sky-50 border border-sky-100 p-3 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                      </span>
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">La unidad llega a tu parada:</span>
                    </div>
                    <span className="text-xs font-black text-nic-blue bg-white px-2.5 py-1 rounded-full shadow-sm">
                      {realTimeEtaToBoard > 1 ? `en ${realTimeEtaToBoard} min` : '¡Llegando ahora!'}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={() => startNavigation('real-time')}
                  className="group p-6 bg-zinc-50 border border-zinc-200 rounded-3xl hover:border-nic-blue hover:bg-nic-blue/5 transition-all text-left flex items-center gap-5"
                >
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-zinc-400 group-hover:text-nic-blue shadow-sm border border-zinc-100 transition-colors">
                    <MapIcon size={28} />
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900 text-base">{t('nav.realTimeOption')}</p>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{t('nav.realTimeDesc')}</p>
                  </div>
                </button>

                <button 
                  onClick={() => startNavigation('static')}
                  className="group p-6 bg-zinc-50 border border-zinc-200 rounded-3xl hover:border-nic-blue hover:bg-nic-blue/5 transition-all text-left flex items-center gap-5"
                >
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-zinc-400 group-hover:text-nic-blue shadow-sm border border-zinc-100 transition-colors">
                    <Bell size={28} />
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900 text-base">{t('nav.staticOption')}</p>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{t('nav.staticDesc')}</p>
                  </div>
                </button>
              </div>

              <button 
                onClick={() => setShowNavChoice(false)}
                className="mt-10 text-xs font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-zinc-900 transition-colors"
              >
                {t('app.cancel')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[15000] md:hidden">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            
            {/* Sliding Panel */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 h-full w-[280px] bg-white shadow-2xl border-l border-zinc-150 p-6 flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 animate-fadeIn">
                    <div className="w-8 h-8 bg-nic-blue rounded-lg flex items-center justify-center text-white">
                      <Bus size={18} />
                    </div>
                    <span className="text-sm font-black text-zinc-900">NicaGo Menú</span>
                  </div>
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-2 pt-4">
                  {[
                    { id: 'search', label: 'Buscar', desc: 'Consultas de rutas y tramos' },
                    { id: 'map', label: 'Mapa', desc: 'Geolocalización de paradas', badge: selectedRoute },
                    { id: 'reports', label: 'Reportar', desc: 'Escribe incidencias puntuales' },
                    { id: 'profile', label: 'Perfil', desc: 'Gestionar tu cuenta y personalizar perfil' },
                    ...(userRole === 'admin' ? [{ id: 'admin', label: 'Admin', desc: 'Consola del Administrador' }] : [])
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "w-full text-left p-3.5 rounded-2xl border transition-all flex flex-col gap-0.5 cursor-pointer",
                        activeTab === item.id 
                          ? "bg-nic-blue text-white border-nic-blue shadow-lg shadow-blue-500/10"
                          : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200/55 text-zinc-700 hover:text-zinc-900"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider">{item.label}</span>
                        {item.badge && (
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                        )}
                      </div>
                      <span className={cn(
                        "text-[9px]",
                        activeTab === item.id ? "text-blue-100/80" : "text-zinc-400"
                      )}>
                        {item.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Drawer footer */}
              <div className="pt-6 border-t border-zinc-100 text-center">
                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">NicaGo Pasajero</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[12000] bg-white/95 backdrop-blur-md border-t border-zinc-200/90 px-2 py-2.5 flex items-center justify-around shadow-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={cn(
            "flex flex-col items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer",
            activeTab === 'search' ? "text-nic-blue" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          <Search size={20} />
          <span>Buscar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={cn(
            "flex flex-col items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-colors relative cursor-pointer",
            activeTab === 'map' ? "text-nic-blue" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          <div className="relative">
            <MapPin size={20} />
            {selectedRoute && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse border-2 border-white" />
            )}
          </div>
          <span>Mapa</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={cn(
            "flex flex-col items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer",
            activeTab === 'reports' ? "text-nic-blue" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          <AlertCircle size={20} />
          <span>Reportar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={cn(
            "flex flex-col items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer",
            activeTab === 'profile' ? "text-nic-blue" : "text-zinc-400 hover:text-zinc-600"
          )}
        >
          <UserIcon size={20} />
          <span>Perfil</span>
        </button>
      </nav>

      {/* Luxury arrival notification toast */}
      <AnimatePresence>
        {showArrivalToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[16000] w-[90%] max-w-sm bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl border border-emerald-500/30 flex items-center gap-3.5"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-base">🎉</span>
            </div>
            <div className="flex-1 text-left">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-100">Llegada Detectada</p>
              <p className="text-xs font-black leading-snug">¡Has llegado a tu destino! El viaje ha finalizado y el mapa se ha limpiado.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
