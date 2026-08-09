import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, Bus, Clock, ChevronRight, Navigation, Heart, AlertCircle, User, Locate, Loader2, Compass, Sparkles, Tag, X, ChevronLeft } from 'lucide-react';
import { collection, onSnapshot, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { RouteOption, Route, Driver, Stop, RouteStop, Schedule, TouristPost, isBoatRoute } from '../types';
import ReportForm from './ReportForm';
import { RouteService } from '../services/routeService';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/LanguageContext';

const DEFAULT_TOURIST_POSTS: TouristPost[] = [
  {
    id: 'post-1',
    title: 'Puerto Salvador Allende',
    subtitle: 'Malecón & Paseo del Lago Xolotlán - Managua',
    description: 'El destino turístico #1 de Managua a orillas del Lago Xolotlán. Ofrece restaurantes gastronómicos, paseos en barco, pista de Go Karts, áreas infantiles, quioscos de helados y vistas espectaculares al atardecer.',
    category: 'Puerto & Recreación',
    coverPhoto: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&q=80&w=800',
    galleryPhotos: [
      'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800'
    ],
    schedule: 'Lunes a Domingo: 8:00 AM - 11:00 PM',
    entryFee: 'C$ 10 Córdobas',
    destinationStopName: 'Bahía Puerto Salvador Allende (Dupla Norte)',
    recommendedRoutes: ['Ruta 101', 'Ruta 120'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'post-2',
    title: 'Hotel Real InterContinental Metrocentro',
    subtitle: 'Zona Financiera & Comercial de Managua',
    description: 'Alojamiento de lujo de 5 estrellas en pleno corazón gastronómico y comercial de Managua. Cuenta con restaurantes internacionales, piscina tropical, centro de convenciones y acceso directo al Centro Comercial Metrocentro.',
    category: 'Hoteles & Hospedajes',
    coverPhoto: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800',
    galleryPhotos: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80&w=800'
    ],
    schedule: 'Recepción 24 Horas',
    entryFee: 'Tarifa según habitación / consumo',
    destinationStopName: 'Bahía Metrocentro (Rotonda Rubén Darío)',
    recommendedRoutes: ['Ruta 110', 'Ruta 114', 'Ruta 119'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'post-3',
    title: 'Restaurante & Fritanga La Granja Nica',
    subtitle: 'Gastronomía Típica Nicaragüense - Managua',
    description: 'Icono culinario en Managua famoso por sus carnes asadas a las brasas, vigorón en hoja de plátano, tajadas con queso, nacatamales los fines de semana y refresco de chicha de maíz y cacao.',
    category: 'Restaurantes & Fritangas',
    coverPhoto: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800',
    galleryPhotos: [
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800'
    ],
    schedule: 'Lunes a Sábado: 11:00 AM - 10:00 PM',
    entryFee: 'Platos desde C$ 120',
    destinationStopName: 'Bahía Rotonda La Virgen (Pista Larreynaga)',
    recommendedRoutes: ['Ruta 105', 'Ruta 117'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'post-4',
    title: 'Lomas de Tiscapa & Canopy Extremo',
    subtitle: 'Reserva Natural & Mirador Histórico',
    description: 'Mirador histórico e icónico ubicado sobre el borde del cráter volcánico de la Laguna de Tiscapa. Disfruta de la silueta del General Sandino, vista de 360° a toda Managua y el canopy tirolesa más veloz de la capital.',
    category: 'Sitios Turísticos',
    coverPhoto: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800',
    galleryPhotos: [
      'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&q=80&w=800'
    ],
    schedule: 'Todos los días: 6:00 AM - 6:00 PM',
    entryFee: 'Gratis (Canopy C$ 150)',
    destinationStopName: 'Bahía Plaza Inter (Lomas de Tiscapa)',
    recommendedRoutes: ['Ruta 105', 'Ruta 125'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'post-5',
    title: 'Palacio Nacional de la Cultura & Plaza de la Revolución',
    subtitle: 'Centro Histórico & Museo Nacional de Nicaragua',
    description: 'Imponente monumento de arquitectura neoclásica frente a la antigua Catedral de Managua. Alberga las salas del Museo Nacional con piezas cerámicas prehispánicas, pinacoteca nacional y salones gubernamentales históricos.',
    category: 'Cultura & Museos',
    coverPhoto: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=800',
    galleryPhotos: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800'
    ],
    schedule: 'Martes a Domingo: 8:00 AM - 5:00 PM',
    entryFee: 'C$ 20 Nacionales / $5 Extranjeros',
    destinationStopName: 'Bahía Palacio Nacional (Plaza de la Revolución)',
    recommendedRoutes: ['Ruta 114', 'Ruta 101'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'post-6',
    title: 'Hotel Crowne Plaza Managua',
    subtitle: 'Diseño Piramidal & Centro de Convenciones',
    description: 'Emblemático hotel piramidal inspirado en las ruinas mayas. Punto focal para convenciones de negocios, bodas y eventos internacionales en el centro de Managua.',
    category: 'Hoteles & Hospedajes',
    coverPhoto: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&q=80&w=800',
    galleryPhotos: [
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&q=80&w=800'
    ],
    schedule: 'Atención 24 Horas',
    entryFee: 'Reserva previa',
    destinationStopName: 'Bahía Plaza Inter (Lomas de Tiscapa)',
    recommendedRoutes: ['Ruta 105', 'Ruta 125'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'post-7',
    title: 'Mercado Artesanal Roberto Huembes & Comedores',
    subtitle: 'Feria de Artesanías & Gastronomía Popular',
    description: 'El mayor centro artesanal y gastronómico popular de Managua: hamacas teñidas a mano de Masaya, marroquinería en cuero genuino, calzado y tramos de comida casera nicaragüense.',
    category: 'Restaurantes & Fritangas',
    coverPhoto: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&q=80&w=800',
    galleryPhotos: [
      'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?auto=format&fit=crop&q=80&w=800'
    ],
    schedule: 'Lunes a Sábado: 7:00 AM - 6:00 PM',
    entryFee: 'Entrada Libre',
    destinationStopName: 'Bahía Mercado Roberto Huembes (Pista Solidaridad)',
    recommendedRoutes: ['Ruta 110', 'Ruta 133'],
    createdAt: new Date().toISOString()
  }
];

interface RouteSearchProps {
  onRouteSelect: (route: RouteOption) => void;
  onOriginChange: (origin: { lat: number; lng: number; address: string }) => void;
  onDestinationChange: (dest: { lat: number; lng: number; address: string }) => void;
}

export default function RouteSearch({ onRouteSelect, onOriginChange, onDestinationChange }: RouteSearchProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'search' | 'favorites'>('search');
  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [focusedInput, setFocusedInput] = useState<'origin' | 'dest' | null>(null);

  const getSuggestionType = (name: string) => {
    const isStop = stops.some(s => s.name.toLowerCase() === name.toLowerCase());
    return isStop ? 'stop' : 'landmark';
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return <span className="font-bold text-zinc-850">{text}</span>;
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    return (
      <span className="font-semibold text-zinc-700">
        {parts.map((part, i) => 
          regex.test(part) ? (
            <span key={i} className="font-black text-[#0033a0] bg-blue-50/80 px-1 py-0.5 rounded border border-blue-200/50">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  const defaultSuggestions = [
    "Plaza Inter",
    "Puerto Salvador Allende",
    "Metrocentro",
    "UCA (Universidad Centroamericana)",
    "Multicentro Las Américas",
    "Galerías Santo Domingo",
    "Linda Vista",
    "Mercado Roberto Huembes",
    "Palacio Nacional",
    "Bello Horizonte"
  ];

  const getFilteredSuggestions = (input: string) => {
    const suggestionsFromStops = stops.map(s => s.name);
    const combined = Array.from(new Set([...defaultSuggestions, ...suggestionsFromStops]));
    if (!input.trim()) {
      return combined.slice(0, 10);
    }
    const lower = input.toLowerCase();
    return combined.filter(name => name.toLowerCase().includes(lower)).slice(0, 10);
  };

  const handleSuggestionClick = (type: 'origin' | 'dest', value: string) => {
    if (type === 'origin') {
      setOriginText(value);
    } else {
      setDestText(value);
    }
    setFocusedInput(null);
  };

  const [options, setOptions] = useState<RouteOption[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [reportingTarget, setReportingTarget] = useState<{type: 'route' | 'stop' | 'driver', id: string, driverId?: string} | null>(null);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [schedulesGlobal, setSchedulesGlobal] = useState<Schedule[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [gpsOriginCoords, setGpsOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [touristPosts, setTouristPosts] = useState<TouristPost[]>(DEFAULT_TOURIST_POSTS);
  const [selectedPostCategory, setSelectedPostCategory] = useState<string>('Todos');
  const [selectedTouristPost, setSelectedTouristPost] = useState<TouristPost | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const handleGetGPSLocation = () => {
    if (!navigator.geolocation) {
      alert("La geolocalización no está soportada por tu navegador.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setGpsOriginCoords({ lat: latitude, lng: longitude });
        
        let locationName = "Mi ubicación actual";
        if (stops && stops.length > 0) {
          let minDistance = Infinity;
          let closestStop: Stop | null = null;
          stops.forEach(s => {
            const dist = Math.sqrt(Math.pow(s.lat - latitude, 2) + Math.pow(s.lng - longitude, 2));
            if (dist < minDistance) {
              minDistance = dist;
              closestStop = s;
            }
          });
          if (closestStop && minDistance < 0.01) {
            locationName = `Mi ubicación (Cerca de ${closestStop.name})`;
          }
        }
        
        setOriginText(locationName);
        setIsLocating(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        setIsLocating(false);
        alert("No se pudo obtener tu ubicación. Por favor, asegúrate de dar permisos de GPS a la aplicación.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    const unsubRoutes = onSnapshot(collection(db, 'routes'), (snapshot) => {
      setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route)));
    }, (error) => console.error("Error routes:", error));

    const unsubDrivers = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver)));
    }, (error) => console.error("Error drivers:", error));

    const unsubRouteStops = onSnapshot(collection(db, 'routeStops'), (snapshot) => {
      setRouteStops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RouteStop)));
    }, (error) => console.error("Error routeStops:", error));

    const unsubStops = onSnapshot(collection(db, 'stops'), (snapshot) => {
      setStops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stop)));
    }, (error) => console.error("Error stops:", error));

    const unsubSchedules = onSnapshot(collection(db, 'schedules'), (snapshot) => {
      setSchedulesGlobal(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule)));
    }, (error) => console.error("Error schedules:", error));

    const unsubTouristPosts = onSnapshot(collection(db, 'touristPosts'), (snapshot) => {
      if (!snapshot.empty) {
        setTouristPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TouristPost)));
      } else {
        setTouristPosts(DEFAULT_TOURIST_POSTS);
      }
    }, (error) => {
      console.error("Error touristPosts:", error);
      setTouristPosts(DEFAULT_TOURIST_POSTS);
    });

    let unsubFavs = () => {};
    const unsubAuth = auth.onAuthStateChanged((user) => {
      unsubFavs();
      const currentUserId = user ? user.uid : (localStorage.getItem('localAuth') ? (localStorage.getItem('localAuth_id') || ('local-' + localStorage.getItem('localAuth'))) : null);
      if (currentUserId) {
        const q = query(collection(db, 'favorites'), where('userId', '==', currentUserId));
        unsubFavs = onSnapshot(q, (snapshot) => {
          setFavorites(snapshot.docs.map(doc => doc.data().routeId));
        }, (error) => console.error("Error favorites:", error));
      } else {
        setFavorites([]);
      }
    });

    return () => {
      unsubRoutes();
      unsubDrivers();
      unsubRouteStops();
      unsubStops();
      unsubSchedules();
      unsubTouristPosts();
      unsubFavs();
      unsubAuth();
    };
  }, []);

  const handleSearch = async (overrideDest?: string) => {
    setLoading(true);
    const targetDestName = overrideDest !== undefined ? overrideDest : destText;
    if (overrideDest !== undefined) {
      setDestText(overrideDest);
    }
    
    // Resolve coordinates based on names for demo using the 10 most common locations of Managua
    const resolveCoords = (text: string, defaultVal: { lat: number; lng: number }) => {
      const lower = text.toLowerCase();
      if (lower.includes('plaza inter') || lower.includes('inter')) {
        return { lat: 12.1444, lng: -86.2724 };
      }
      if (lower.includes('salvador allende') || lower.includes('puerto') || lower.includes('allende') || lower.includes('malecón')) {
        return { lat: 12.1610, lng: -86.2710 };
      }
      if (lower.includes('metrocentro')) {
        return { lat: 12.1284, lng: -86.2654 };
      }
      if (lower.includes('uca') || lower.includes('universidad')) {
        return { lat: 12.1264, lng: -86.2714 };
      }
      if (lower.includes('multicentro') || lower.includes('las américas') || lower.includes('las americas')) {
        return { lat: 12.1384, lng: -86.2294 };
      }
      if (lower.includes('galerías') || lower.includes('galerias') || lower.includes('santo domingo')) {
        return { lat: 12.0984, lng: -86.2504 };
      }
      if (lower.includes('linda vista') || lower.includes('linda')) {
        return { lat: 12.1524, lng: -86.3074 };
      }
      if (lower.includes('huembes') || lower.includes('mercado')) {
        return { lat: 12.1154, lng: -86.2414 };
      }
      if (lower.includes('palacio nacional') || lower.includes('palacio') || lower.includes('catedral')) {
        return { lat: 12.1534, lng: -86.2714 };
      }
      if (lower.includes('bello horizonte') || lower.includes('horizonte') || lower.includes('rotonda')) {
        return { lat: 12.1414, lng: -86.2444 };
      }
      return defaultVal;
    };

    const cleanOrigin = originText.trim().toLowerCase();
    const cleanDest = targetDestName.trim().toLowerCase();

    let matchedOriginStop = stops.find(s => s.name.toLowerCase() === cleanOrigin);
    if (!matchedOriginStop && cleanOrigin) {
      matchedOriginStop = stops.find(s => {
        const nameLower = s.name.toLowerCase();
        return nameLower.includes(cleanOrigin) || cleanOrigin.includes(nameLower) || s.id.toLowerCase() === cleanOrigin;
      });
    }

    let matchedDestStop = stops.find(s => s.name.toLowerCase() === cleanDest);
    if (!matchedDestStop && cleanDest) {
      matchedDestStop = stops.find(s => {
        const nameLower = s.name.toLowerCase();
        return nameLower.includes(cleanDest) || cleanDest.includes(nameLower) || s.id.toLowerCase() === cleanDest;
      });
    }

    let originCoords = matchedOriginStop 
      ? { lat: matchedOriginStop.lat, lng: matchedOriginStop.lng } 
      : (gpsOriginCoords && (originText.toLowerCase().includes('ubicación') || originText.toLowerCase().includes('ubicacion'))
          ? gpsOriginCoords 
          : resolveCoords(originText, { lat: 12.1264, lng: -86.2714 })); // Default UCA
    let destCoords = matchedDestStop ? { lat: matchedDestStop.lat, lng: matchedDestStop.lng } : resolveCoords(targetDestName, { lat: 12.1284, lng: -86.2654 }); // Default Metrocentro

    const mockOrigin = { ...originCoords, address: originText || 'UCA' };
    const mockDest = { ...destCoords, address: targetDestName };
    
    onOriginChange(mockOrigin);
    onDestinationChange(mockDest);

    const results = await RouteService.findBestRoutes(mockOrigin, mockDest);
    setOptions(results);
    setHasSearched(true);
    setLoading(false);

    const currentUserId = auth.currentUser ? auth.currentUser.uid : (localStorage.getItem('localAuth') ? (localStorage.getItem('localAuth_id') || ('local-' + localStorage.getItem('localAuth'))) : null);
    if (currentUserId) {
      await addDoc(collection(db, 'history'), {
        userId: currentUserId,
        origin: mockOrigin.address,
        destination: mockDest.address,
        createdAt: new Date().toISOString()
      });
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, routeId: string) => {
    e.stopPropagation();
    const currentUserId = auth.currentUser ? auth.currentUser.uid : (localStorage.getItem('localAuth') ? (localStorage.getItem('localAuth_id') || ('local-' + localStorage.getItem('localAuth'))) : null);
    if (!currentUserId) return;

    try {
      const q = query(
        collection(db, 'favorites'),
        where('userId', '==', currentUserId),
        where('routeId', '==', routeId)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        // Doc already exists, so delete it
        const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'favorites', d.id)));
        await Promise.all(deletePromises);
      } else {
        // Add to favorites
        await addDoc(collection(db, 'favorites'), {
          userId: currentUserId,
          routeId,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  const handleNavigateToTouristPost = (post: TouristPost) => {
    const destName = post.destinationStopName || post.title;
    setDestText(destName);
    setSelectedTouristPost(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      handleSearch(destName);
    }, 150);
  };

  return (
    <div className="space-y-8">
      {/* Tab Switcher */}
      <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200">
        <button 
          onClick={() => setActiveTab('search')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all",
            activeTab === 'search' ? "bg-white text-nic-blue shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          )}
        >
          <Search size={16} />
          {t('search.routesBtn')}
        </button>
        <button 
          onClick={() => setActiveTab('favorites')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all",
            activeTab === 'favorites' ? "bg-white text-nic-red shadow-sm" : "text-zinc-500 hover:text-zinc-700"
          )}
        >
          <Heart size={16} />
          {t('search.favsBtn')}
        </button>
      </div>

      {activeTab === 'search' ? (
        <>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass p-8 rounded-3xl"
          >
            {routes.length === 0 && (
              <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl text-left mb-6 shadow-sm">
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 bg-nic-blue text-white rounded-xl flex items-center justify-center shrink-0 shadow-md">
                    <AlertCircle size={18} className="text-white" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-blue-950 uppercase tracking-wide">Base de datos sin rutas</h4>
                    <p className="text-xs text-blue-800 leading-normal mt-1 font-semibold">
                      Actualmente no hay rutas de transporte registradas en el sistema. Puedes sembrar las rutas de prueba oficiales de Managua de manera instantánea.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const { seedDatabase } = await import('../services/seedService');
                          await seedDatabase();
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="mt-3 px-4 py-2 bg-nic-blue hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm cursor-pointer"
                    >
                      {loading ? 'Sembrando...' : 'Sembrar Datos de Prueba'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-nic-blue rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
            <Navigation size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900">{t('search.title')}</h2>
            <p className="text-xs text-zinc-500">{t('search.desc')}</p>
          </div>
        </div>
        
            <div className="space-y-4 mb-8">
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-nic-blue transition-transform group-focus-within:scale-110">
                  <MapPin size={20} />
                </div>
                <input 
                  type="text" 
                  placeholder={t('search.originPlaceholder')}
                  value={originText}
                  onChange={(e) => {
                    setOriginText(e.target.value);
                    setFocusedInput('origin');
                  }}
                  onFocus={() => setFocusedInput('origin')}
                  onBlur={() => setTimeout(() => setFocusedInput(null), 300)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading && destText) {
                      handleSearch();
                    }
                  }}
                  className="w-full pl-12 pr-14 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-nic-blue/5 focus:border-nic-blue transition-all font-bold"
                />
                <button
                  type="button"
                  onClick={handleGetGPSLocation}
                  disabled={isLocating}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-xl bg-nic-blue/5 hover:bg-nic-blue/10 text-nic-blue hover:scale-105 active:scale-95 transition-all cursor-pointer border border-nic-blue/15"
                  title={t('search.gpsBtn')}
                >
                  {isLocating ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="flex items-center justify-center"
                    >
                      <Loader2 size={18} />
                    </motion.div>
                  ) : (
                    <Locate size={18} />
                  )}
                </button>
                {focusedInput === 'origin' && (
                  <div className="absolute left-0 right-0 mt-2 bg-white border border-zinc-150 rounded-2xl shadow-xl z-50 max-h-72 overflow-y-auto overflow-x-hidden py-2 animate-fadeIn divide-y divide-zinc-50">
                    <div className="px-4 py-1.5 bg-zinc-50/50 text-[9px] font-black uppercase tracking-wider text-nic-blue border-b border-zinc-100 flex justify-between items-center">
                      <span>Ubicación GPS / Sugerencias</span>
                      <span className="text-[8px] text-zinc-400 font-medium">Elige tu origen</span>
                    </div>

                    {/* Botón integrado de GPS en la primera posición de sugerencias */}
                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleGetGPSLocation();
                      }}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-50 transition-colors text-left border-b border-zinc-100 cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-xl bg-nic-blue text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/25">
                        {isLocating ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Locate size={16} />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-nic-blue">📍 Usar mi ubicación actual (GPS)</span>
                        <span className="text-[10px] text-zinc-450 font-bold">El sistema detectará automáticamente dónde estás</span>
                      </div>
                    </div>

                    {getFilteredSuggestions(originText).map((suggestion, idx) => {
                      const isStop = getSuggestionType(suggestion) === 'stop';
                      return (
                        <div 
                          key={idx}
                          onMouseDown={() => handleSuggestionClick('origin', suggestion)}
                          className="px-5 py-3 hover:bg-zinc-50 text-xs font-bold text-zinc-700 hover:text-nic-blue transition-all cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isStop ? (
                              <Bus size={14} className="text-emerald-500 shrink-0" />
                            ) : (
                              <MapPin size={14} className="text-nic-blue shrink-0" />
                            )}
                            <span className="truncate">{highlightMatch(suggestion, originText)}</span>
                          </div>
                          {isStop ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 rounded-md border border-emerald-100 shrink-0">Parada</span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-600 bg-sky-50 rounded-md border border-sky-100 shrink-0">Punto</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-transform group-focus-within:scale-110">
                  <Search size={20} />
                </div>
                <input 
                  type="text" 
                  placeholder={t('search.destPlaceholder')}
                  value={destText}
                  onChange={(e) => {
                    setDestText(e.target.value);
                    setFocusedInput('dest');
                  }}
                  onFocus={() => setFocusedInput('dest')}
                  onBlur={() => setTimeout(() => setFocusedInput(null), 300)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading && destText) {
                      handleSearch();
                    }
                  }}
                  className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-nic-blue/5 focus:border-nic-blue transition-all font-bold"
                />
                {focusedInput === 'dest' && getFilteredSuggestions(destText).length > 0 && (
                  <div className="absolute left-0 right-0 mt-2 bg-white border border-zinc-150 rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto overflow-x-hidden py-2 animate-fadeIn divide-y divide-zinc-50">
                    <div className="px-4 py-1.5 bg-zinc-50/50 text-[9px] font-black uppercase tracking-wider text-[#0033a0] border-b border-zinc-100 flex justify-between items-center">
                      <span>Sugerencias de Destino</span>
                      <span className="text-[8px] text-zinc-400 font-medium">Elige rápido</span>
                    </div>
                    {getFilteredSuggestions(destText).map((suggestion, idx) => {
                      const isStop = getSuggestionType(suggestion) === 'stop';
                      return (
                        <div 
                          key={idx}
                          onMouseDown={() => handleSuggestionClick('dest', suggestion)}
                          className="px-5 py-3 hover:bg-zinc-50 text-xs font-bold text-zinc-700 hover:text-nic-blue transition-all cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isStop ? (
                              <Bus size={14} className="text-emerald-500 shrink-0" />
                            ) : (
                              <MapPin size={14} className="text-[#0033a0] shrink-0" />
                            )}
                            <span className="truncate">{highlightMatch(suggestion, destText)}</span>
                          </div>
                          {isStop ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 rounded-md border border-emerald-100 shrink-0">Parada</span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-600 bg-sky-50 rounded-md border border-sky-100 shrink-0">Punto</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={handleSearch}
              disabled={loading || !destText}
              className="w-full py-4 bg-nic-blue text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('search.loadingBtn')}
                </>
              ) : (
                <>
                  <Search size={18} />
                  {t('search.submitBtn')}
                </>
              )}
            </button>
      </motion.div>

      {options.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Resultados Sugeridos</h3>
            <span className="text-[10px] font-bold text-nic-blue bg-nic-blue/5 px-2 py-1 rounded-full">{options.length} opciones</span>
          </div>
          
          {options.map((option, idx) => {
            const isDirect = !option.steps.some(s => s.type === 'transfer');
            const isFastestETABoard = option.etaToBoardMinutes !== undefined && option.etaToBoardMinutes === Math.min(...options.map(o => o.etaToBoardMinutes ?? 99));

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => onRouteSelect(option)}
                className={cn(
                  "w-full bg-white p-5 rounded-3xl border hover:shadow-xl transition-all text-left relative overflow-hidden cursor-pointer group",
                  isFastestETABoard ? "border-sky-300 shadow-sm shadow-sky-500/5 hover:border-sky-400" : "border-zinc-100 hover:border-nic-blue/30"
                )}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={cn(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                        isDirect ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-indigo-50 text-indigo-600 border-indigo-100"
                      )}>
                        {isDirect ? 'Directa' : 'Con Transbordo'}
                      </div>
                      <div className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-blue-50 text-nic-blue border border-blue-100">
                        En parada: {option.etaToBoardMinutes ?? 5} min
                      </div>
                      {isFastestETABoard && (
                        <div className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1",
                          !isDirect ? "bg-indigo-600 text-white" : "bg-sky-500 text-white"
                        )}>
                          <span>⚡ Pasará primero</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] font-bold">
                        <Clock size={12} />
                        Viaje: {option.estimatedTimeMinutes} min
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => option.steps[0].routeId && toggleFavorite(e, option.steps[0].routeId)}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          option.steps[0].routeId && favorites.includes(option.steps[0].routeId) ? "text-nic-red bg-red-50" : "text-zinc-300 hover:text-nic-red"
                        )}
                      >
                        <Heart size={16} fill={option.steps[0].routeId && favorites.includes(option.steps[0].routeId) ? "currentColor" : "none"} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (option.steps[0].routeId) {
                            const route = routes.find(r => r.id === option.steps[0].routeId);
                            setReportingTarget({ 
                              type: 'route', 
                              id: option.steps[0].routeId,
                              driverId: route?.driverId
                            });
                          }
                        }}
                        className="p-2 hover:bg-zinc-100 text-zinc-300 transition-all rounded-xl"
                      >
                        <AlertCircle size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-300 overflow-hidden border border-zinc-100 shadow-inner">
                      {option.steps[0].routeId && routes.find(r => r.id === option.steps[0].routeId)?.photoUrl ? (
                        <img 
                          src={routes.find(r => r.id === option.steps[0].routeId)?.photoUrl} 
                          alt="" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Bus size={20} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-zinc-900 truncate">
                        Viajar en {routes.find(r => r.id === option.steps[0].routeId)?.name || 'Transporte Recomendado'}
                      </h4>
                      
                      <div className="mt-3 space-y-1.5 bg-zinc-50 border border-zinc-100 p-3 rounded-2xl">
                        {option.steps.map((step, sIdx) => {
                          const stop = stops.find(s => s.id === step.stopId);
                          return (
                            <div key={sIdx} className="flex items-center gap-2 text-[11px] font-bold text-zinc-700">
                              <span className={cn(
                                "w-2 h-2 rounded-full shrink-0",
                                step.type === 'board' ? "bg-nic-blue" :
                                step.type === 'transfer' ? "bg-indigo-500" :
                                step.type === 'ride' ? "bg-emerald-500" : "bg-cyan-500"
                              )} />
                              <span className="truncate text-zinc-600 font-medium">
                                {step.type === 'board' && (
                                  <>
                                    Tomar en: <strong className="text-zinc-900">{stop?.name || 'Bahía inicial'}</strong>
                                    {step.time && <span className="ml-1.5 text-nic-blue font-black">({step.time})</span>}
                                  </>
                                )}
                                {step.type === 'transfer' && (
                                  <>
                                    Transbordo en: <strong className="text-indigo-600">{stop?.name || 'Punto intermedio'}</strong>
                                  </>
                                )}
                                {step.type === 'ride' && (
                                  <>
                                    Bajarse en: <strong className="text-zinc-900">{stop?.name || 'Bahía final'}</strong> (Destino)
                                  </>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {!isDirect && isFastestETABoard && (
                        <div className="mt-3 bg-indigo-50/90 border border-indigo-200 p-3 rounded-2xl flex items-start gap-2.5 text-[11px] text-indigo-900 leading-normal font-semibold">
                          <span className="text-indigo-500 text-sm leading-none shrink-0" style={{ marginTop: '1px' }}>ℹ️</span>
                          <div>
                            <strong>¡Llega antes pero no es directa!</strong> Esta opción pasará primero por tu parada, pero requiere realizar un <strong>transbordo de ruta</strong> para completar el viaje.
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2 ml-1">
                        <p className="text-[10px] font-bold text-zinc-400">
                          {option.totalStops} paradas en total
                        </p>
                        <span className="text-[10px] text-zinc-300">•</span>
                        {option.steps[0].routeId && (
                          <span className="text-[10px] font-black text-nic-blue/70">
                            Placa: {routes.find(r => r.id === option.steps[0].routeId)?.code}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-zinc-200 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  ) : (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('search.favTitle')}</h3>
        <span className="text-[10px] font-bold text-nic-red bg-red-50 px-3 py-1 rounded-full">{favorites.length}</span>
      </div>
      
      {favorites.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {favorites.map(favId => {
            const route = routes.find(r => r.id === favId);
            if (!route) return null;
            return (
              <div 
                key={favId}
                onClick={() => {
                  const items = routeStops.filter(rs => rs.routeId === route.id).sort((a,b) => a.sequence - b.sequence);
                  onRouteSelect({
                    steps: items.map((rs, i) => ({
                      type: 'ride',
                      routeId: route.id,
                      stopId: rs.stopId,
                      description: `${t('nav.staticStepPrefix')} ${stops.find(s => s.id === rs.stopId)?.name}`
                    })),
                    totalStops: items.length,
                    estimatedTimeMinutes: items.length * 5
                  });
                }}
                className="p-5 bg-white border border-zinc-100 rounded-3xl flex items-center gap-4 hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="w-14 h-14 bg-zinc-50 rounded-2xl overflow-hidden border border-zinc-100 flex items-center justify-center shrink-0">
                  {route.photoUrl ? <img src={route.photoUrl} alt="" className="w-full h-full object-cover" /> : <Bus size={24} className="text-zinc-200" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-zinc-900">{route.name}</h4>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold">Placa: {route.code}</p>
                </div>
                <Heart size={18} className="text-nic-red" fill="currentColor" />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center">
          <div className="w-16 h-16 bg-zinc-50 rounded-3xl flex items-center justify-center mx-auto mb-4 text-zinc-200">
            <Heart size={32} />
          </div>
          <p className="text-sm font-bold text-zinc-400">{t('search.favNone')}</p>
          <button 
            onClick={() => setActiveTab('search')}
            className="mt-4 text-xs font-black text-nic-blue uppercase tracking-widest hover:underline"
          >
            {t('app.explore')}
          </button>
        </div>
      )}
    </div>
  )}

      {reportingTarget && (
        <ReportForm 
          type={reportingTarget.type}
          targetId={reportingTarget.id}
          driverId={reportingTarget.driverId}
          onClose={() => setReportingTarget(null)}
        />
      )}

      {activeTab === 'search' && options.length === 0 && !loading && hasSearched && (
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 animate-fadeIn"
          >
            {/* Specialized 'Route Not Found' Warning Box */}
              <div className="bg-gradient-to-br from-red-50/50 to-rose-50/20 border border-red-200/60 p-6 rounded-3xl text-left shadow-sm">
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-rose-500/10">
                    <AlertCircle size={22} className="text-white animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-zinc-950 uppercase tracking-wide">Ruta No Encontrada Directamente</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed mt-1 font-semibold">
                      No pudimos encadenar un viaje directo o con solo un transbordo comercial entre el punto de origen <span className="text-zinc-800 font-extrabold">"{originText || 'Tu Ubicación'}"</span> y destino <span className="text-zinc-800 font-extrabold">"{destText}"</span>.
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-red-150 text-[11px] text-zinc-500 font-semibold space-y-1.5 list-disc pl-2">
                  <p>💡 <strong className="text-zinc-800">Sugerencia:</strong> Comprueba el nombre ingresado o selecciona uno de los puntos rápidos sugeridos al ir escribiendo para asegurar una excelente detección.</p>
                </div>
              </div>

              {/* Direct Route Browser Suggestion List */}
              <div className="space-y-3.5 text-left">
                <div>
                  <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Rutas Oficiales de Managua</h3>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-normal font-semibold">
                    También puedes explorar directamente los paraderos y trazos completos de cualquiera de las siguientes rutas de transporte operativas:
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {routes.map((routeObj) => {
                    const isBoat = isBoatRoute(routeObj.name);
                    return (
                      <div
                        key={routeObj.id}
                        onClick={() => {
                          const items = routeStops.filter(rs => rs.routeId === routeObj.id).sort((a,b) => a.sequence - b.sequence);
                          if (items.length > 0) {
                            onRouteSelect({
                              steps: items.map((rs, i) => ({
                                type: i === 0 ? 'board' : i === items.length - 1 ? 'ride' : 'ride',
                                routeId: routeObj.id,
                                stopId: rs.stopId,
                                description: `${t('nav.staticStepPrefix')} ${stops.find(s => s.id === rs.stopId)?.name || 'Bahía'}`
                              })),
                              totalStops: items.length,
                              estimatedTimeMinutes: items.length * 4
                            });
                          }
                        }}
                        className="bg-white hover:bg-zinc-50/50 p-4 rounded-2xl border border-zinc-200/80 hover:border-nic-blue/30 cursor-pointer shadow-sm flex items-center justify-between gap-3 transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border",
                            isBoat 
                              ? "bg-indigo-50 border-indigo-100 text-indigo-600 animate-pulse" 
                              : "bg-zinc-50 border-zinc-150 text-zinc-400"
                          )}>
                            <Bus size={18} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[9px] font-black uppercase text-nic-blue tracking-wider block leading-none">
                              {isBoat ? 'Transbordo Acuático' : 'Unidad de Transporte'}
                            </span>
                            <h4 className="text-xs font-black text-zinc-950 truncate group-hover:text-nic-blue transition-colors mt-1">
                              {routeObj.name}
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 rounded-xl leading-none font-black text-[9px] uppercase tracking-wider text-nic-blue border border-zinc-200 group-hover:bg-nic-blue group-hover:text-white transition-all shadow-sm">
                          Explorar
                          <ChevronRight size={11} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
        </div>
      )}
      {/* Tourist Promotional Posts Vertical Facebook-Style Feed (Always visible on search tab) */}
      {activeTab === 'search' && (
        <div className="pt-8 border-t border-zinc-200 space-y-6 text-left">
          {/* Feed Title & Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <div>
              <div className="flex items-center gap-2">
                <Compass size={20} className="text-nic-blue" />
                <h3 className="text-base font-black text-zinc-950 tracking-tight">Publicaciones & Atractivos de Managua</h3>
              </div>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">Explora restaurantes, hoteles, museos y lugares icónicos de la capital y cómo llegar en bus</p>
            </div>
            <span className="px-3 py-1 bg-blue-50 text-nic-blue text-[10px] font-black uppercase tracking-wider rounded-full border border-blue-100 flex items-center gap-1.5 shrink-0 self-start sm:self-auto shadow-sm">
              <Sparkles size={12} />
              NicaGo Feed
            </span>
          </div>

          {/* Category Filter Pills (Horizontal Bar) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {[
              'Todos',
              'Puerto & Recreación',
              'Restaurantes & Fritangas',
              'Hoteles & Hospedajes',
              'Sitios Turísticos',
              'Cultura & Museos'
            ].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedPostCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer border shadow-xs",
                  selectedPostCategory === cat
                    ? "bg-nic-blue text-white border-nic-blue shadow-md scale-105"
                    : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Vertical Feed Container (Facebook Post Cards) */}
          <div className="space-y-6 max-w-2xl mx-auto">
            {touristPosts
              .filter(post => {
                if (selectedPostCategory === 'Todos') return true;
                return post.category.toLowerCase().includes(selectedPostCategory.toLowerCase()) ||
                       selectedPostCategory.toLowerCase().includes(post.category.toLowerCase());
              })
              .map((post) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[2rem] border border-zinc-200/90 shadow-md hover:shadow-xl transition-all overflow-hidden flex flex-col font-sans"
                >
                  {/* Facebook-style Header Header */}
                  <div className="p-4 sm:p-5 flex items-center justify-between border-b border-zinc-100 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-nic-blue text-white font-black flex items-center justify-center text-xs shadow-md border-2 border-white ring-2 ring-blue-100">
                        NG
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-black text-zinc-950">NicaGo Turístico • Managua</h4>
                          <span className="w-3.5 h-3.5 rounded-full bg-nic-blue text-white flex items-center justify-center text-[8px] font-bold">✓</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-semibold mt-0.5 flex items-center gap-1">
                          <span>Publicado en {post.category}</span>
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-zinc-100 text-zinc-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-zinc-200">
                      {post.category}
                    </span>
                  </div>

                  {/* Post Content Title & Text */}
                  <div className="px-5 pt-4 pb-2 space-y-1.5">
                    <h3 className="text-base sm:text-lg font-black text-zinc-950 leading-snug">{post.title}</h3>
                    {post.subtitle && (
                      <p className="text-xs font-bold text-nic-blue">{post.subtitle}</p>
                    )}
                    <p className="text-xs text-zinc-600 leading-relaxed font-medium pt-1">
                      {post.description}
                    </p>
                  </div>

                  {/* Post Media Photo Banner */}
                  <div
                    onClick={() => {
                      setSelectedTouristPost(post);
                      setSelectedPhotoIndex(0);
                    }}
                    className="relative w-full h-64 sm:h-80 bg-zinc-100 cursor-pointer overflow-hidden group my-2"
                  >
                    <img
                      src={post.coverPhoto}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
                    
                    {/* Photos Count Pill */}
                    <div className="absolute top-3 right-3 px-3 py-1 bg-black/70 backdrop-blur-md text-white text-[10px] font-extrabold rounded-full border border-white/20 flex items-center gap-1">
                      <Sparkles size={11} />
                      {post.galleryPhotos?.length || 1} fotos
                    </div>

                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-200">Destino de la capital</p>
                      <p className="text-xs font-black drop-shadow">{post.destinationStopName}</p>
                    </div>
                  </div>

                  {/* Info Summary Box */}
                  <div className="px-5 py-3 bg-zinc-50 border-y border-zinc-150 grid grid-cols-2 gap-2 text-[11px] font-bold text-zinc-700">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-nic-blue shrink-0" />
                      <span className="truncate">{post.schedule}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-emerald-600 shrink-0" />
                      <span className="truncate">{post.entryFee || 'Acceso Libre'}</span>
                    </div>
                  </div>

                  {/* Facebook-style Action Footer */}
                  <div className="p-4 bg-white flex flex-col sm:flex-row items-center gap-2.5">
                    <button
                      onClick={() => {
                        setSelectedTouristPost(post);
                        setSelectedPhotoIndex(0);
                      }}
                      className="w-full sm:w-auto flex-1 py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>📸 Galería & Detalles</span>
                    </button>

                    <button
                      onClick={() => handleNavigateToTouristPost(post)}
                      className="w-full sm:w-auto flex-1 py-3 px-4 bg-nic-blue hover:bg-blue-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Navigation size={15} />
                      <span>📍 ¿CÓMO LLEGAR?</span>
                    </button>
                  </div>
                </motion.article>
              ))}
          </div>
        </div>
      )}

      {/* Tourist Post Details Modal */}
      <AnimatePresence>
        {selectedTouristPost && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-zinc-100 relative flex flex-col text-left font-sans"
            >
              {/* Sticky Header with Close Button */}
              <div className="sticky top-0 z-20 flex items-center justify-between p-6 bg-white/95 backdrop-blur-md border-b border-zinc-100">
                <div>
                  <span className="px-2.5 py-1 bg-blue-50 text-nic-blue text-[9px] font-black uppercase tracking-wider rounded-full border border-blue-100">
                    {selectedTouristPost.category}
                  </span>
                  <h3 className="text-lg font-black text-zinc-900 mt-1 leading-tight">{selectedTouristPost.title}</h3>
                  {selectedTouristPost.subtitle && (
                    <p className="text-xs text-zinc-400 font-semibold">{selectedTouristPost.subtitle}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedTouristPost(null)}
                  className="w-10 h-10 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-full flex items-center justify-center transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6 flex-1">
                {/* Main Photo & Photo Thumbnails */}
                <div className="space-y-3">
                  <div className="relative h-64 sm:h-72 w-full rounded-3xl overflow-hidden bg-zinc-100 border border-zinc-200 shadow-inner">
                    <img
                      src={
                        (selectedTouristPost.galleryPhotos && selectedTouristPost.galleryPhotos.length > selectedPhotoIndex)
                          ? selectedTouristPost.galleryPhotos[selectedPhotoIndex]
                          : selectedTouristPost.coverPhoto
                      }
                      alt={selectedTouristPost.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-3 right-3 px-3 py-1 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold rounded-full">
                      Foto {selectedPhotoIndex + 1} de {selectedTouristPost.galleryPhotos?.length || 1}
                    </span>
                  </div>

                  {/* Thumbnail selector if gallery has multiple photos */}
                  {selectedTouristPost.galleryPhotos && selectedTouristPost.galleryPhotos.length > 1 && (
                    <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                      {selectedTouristPost.galleryPhotos.map((imgUrl, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedPhotoIndex(idx)}
                          className={cn(
                            "w-16 h-16 rounded-2xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer",
                            selectedPhotoIndex === idx ? "border-nic-blue ring-2 ring-blue-500/30 scale-105" : "border-transparent opacity-70 hover:opacity-100"
                          )}
                        >
                          <img src={imgUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-150 flex items-start gap-3">
                    <Clock size={18} className="text-nic-blue shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Horario de Atención</p>
                      <p className="text-xs font-bold text-zinc-800 mt-0.5">{selectedTouristPost.schedule}</p>
                    </div>
                  </div>

                  <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-150 flex items-start gap-3">
                    <Tag size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Tarifa / Entrada</p>
                      <p className="text-xs font-bold text-zinc-800 mt-0.5">{selectedTouristPost.entryFee || 'Acceso Libre'}</p>
                    </div>
                  </div>

                  <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-150 flex items-start gap-3 sm:col-span-2">
                    <MapPin size={18} className="text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Bahía / Parada de Destino</p>
                      <p className="text-xs font-extrabold text-zinc-900 mt-0.5">{selectedTouristPost.destinationStopName}</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400">Acerca del lugar</h4>
                  <p className="text-xs text-zinc-600 leading-relaxed font-medium bg-zinc-50/80 p-4 rounded-2xl border border-zinc-100">
                    {selectedTouristPost.description}
                  </p>
                </div>

                {/* Recommended routes hint */}
                {selectedTouristPost.recommendedRoutes && selectedTouristPost.recommendedRoutes.length > 0 && (
                  <div className="flex items-center gap-2 bg-blue-50/70 border border-blue-150 p-3 rounded-2xl text-xs text-nic-blue font-bold">
                    <Bus size={16} className="shrink-0" />
                    <span>Rutas conocidas: <strong>{selectedTouristPost.recommendedRoutes.join(', ')}</strong></span>
                  </div>
                )}

                {/* CÓMO LLEGAR Main Action Button */}
                <button
                  onClick={() => handleNavigateToTouristPost(selectedTouristPost)}
                  className="w-full py-4 bg-nic-blue hover:bg-blue-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer mt-4"
                >
                  <Navigation size={18} />
                  <span>📍 ¿CÓMO LLEGAR? (CALCULAR RUTA & BAHÍAS)</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
