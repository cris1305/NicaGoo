import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { seedDatabase, clearDatabase } from '../services/seedService';
import { Route, Stop, RouteStop, Driver, Report, Schedule, AppUser, TouristPost, isBoatRoute } from '../types';
import RouteSearch from './RouteSearch';
import busImg1 from '../assets/images/managua_bus_route_1_1786548148778.jpg';
import busImg2 from '../assets/images/managua_bus_route_2_1786548159770.jpg';
import busImg3 from '../assets/images/managua_bus_route_3_1786548170710.jpg';

const DEFAULT_BUS_PHOTOS = [busImg1, busImg2, busImg3];
import { 
  Plus, 
  Trash2, 
  Bus, 
  MapPin, 
  List, 
  Navigation,
  History,
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  User, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Camera,
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Settings,
  TrendingUp,
  Activity,
  ArrowLeft,
  Search,
  MoreVertical,
  Filter,
  LogOut,
  X,
  Eye,
  SortAsc,
  MessageSquare,
  Compass,
  Sparkles,
  Tag,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import ProgressMapView from './ProgressMapView';

type Section = 'overview' | 'routes' | 'stops' | 'connections' | 'drivers' | 'reports' | 'progress' | 'users' | 'touristPosts' | 'routeSearch';

export default function AdminPanel() {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [touristPosts, setTouristPosts] = useState<TouristPost[]>([]);
  
  const [newRoute, setNewRoute] = useState({ name: '', code: '', color: '#10b981', status: 'excellent' as 'bad' | 'good' | 'excellent', photoUrl: '', driverId: '' });
  const [newStop, setNewStop] = useState({ name: '', lat: 0, lng: 0, generalInfo: '', photoUrl: '' });
  const [newMapping, setNewMapping] = useState({ routeId: '', stopId: '', sequence: 1, arrivalTime: '06:00', departureTime: '06:10' });
  const [newDriver, setNewDriver] = useState({ name: '', age: 30, photoUrl: '', idCardPhotoUrl: '', licensePhotoUrl: '', phoneNumber: '', experience: '', generalInfo: '' });
  const [newSchedule, setNewSchedule] = useState({ routeId: '', stopId: '', arrivalTime: '06:00', departureTime: '06:15' });
  const [newPassenger, setNewPassenger] = useState({ name: '', email: '', phoneNumber: '', role: 'passenger' as 'passenger' | 'admin', photoUrl: '' });
  const [editingPassengerId, setEditingPassengerId] = useState<string | null>(null);
  const [isAddingPassenger, setIsAddingPassenger] = useState(false);

  const [newTouristPost, setNewTouristPost] = useState({
    title: '',
    subtitle: '',
    description: '',
    category: 'Puerto & Recreación',
    coverPhoto: '',
    galleryPhotosStr: '',
    schedule: 'Lunes a Domingo: 8:00 AM - 10:00 PM',
    entryFee: 'Acceso Libre',
    destinationStopName: '',
    recommendedRoutesStr: ''
  });
  const [editingTouristPostId, setEditingTouristPostId] = useState<string | null>(null);
  const [isAddingTouristPost, setIsAddingTouristPost] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportFilterStatus, setReportFilterStatus] = useState<'all' | 'pending' | 'read' | 'resolved'>('all');
  const [adminResponse, setAdminResponse] = useState<{ [key: string]: string }>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userViewMode, setUserViewMode] = useState<'hidden' | 'all' | 'alphabetical'>('hidden');
  const [routeViewMode, setRouteViewMode] = useState<'hidden' | 'all' | 'alphabetical'>('hidden');
  const [driverViewMode, setDriverViewMode] = useState<'hidden' | 'all' | 'alphabetical'>('hidden');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<{ coll: string; id: string; itemName: string } | null>(null);

  // Driver Devices Simulation States (GPS & Internet Control)
  const [driverDevices, setDriverDevices] = useState<{
    [driverId: string]: {
      gpsActive: boolean;
      internetConnected: boolean;
      batteryLevel: number;
      speedKmh: number;
      latencyMs: number;
    }
  }>({});

  const [selectedProgressRoute, setSelectedProgressRoute] = useState<Route | null>(null);
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});
  const [itinerarySearchQuery, setItinerarySearchQuery] = useState('');

  useEffect(() => {
    if (drivers.length > 0) {
      setDriverDevices(prev => {
        const next = { ...prev };
        let updated = false;
        drivers.forEach(driver => {
          if (!next[driver.id]) {
            next[driver.id] = {
              gpsActive: true, // Active by default
              internetConnected: true, // Connected by default
              batteryLevel: Math.floor(Math.random() * 40) + 60, // 60% - 100%
              speedKmh: Math.floor(Math.random() * 30) + 15, // 15 - 45 km/h
              latencyMs: Math.floor(Math.random() * 80) + 20 // 20 - 100 ms
            };
            updated = true;
          }
        });
        return updated ? next : prev;
      });
    }
  }, [drivers]);

  useEffect(() => {
    const unsubRoutes = onSnapshot(query(collection(db, 'routes'), orderBy('code')), (snap) => {
      setRoutes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Route)));
    }, (error) => {
      console.error("Error in routes snapshot:", error);
    });

    const unsubStops = onSnapshot(query(collection(db, 'stops'), orderBy('name')), (snap) => {
      setStops(snap.docs.map(d => ({ id: d.id, ...d.data() } as Stop)));
    }, (error) => {
      console.error("Error in stops snapshot:", error);
    });

    const unsubMappings = onSnapshot(query(collection(db, 'routeStops'), orderBy('sequence')), (snap) => {
      setRouteStops(snap.docs.map(d => ({ id: d.id, ...d.data() } as RouteStop)));
    }, (error) => {
      console.error("Error in routeStops snapshot:", error);
    });

    const unsubDrivers = onSnapshot(query(collection(db, 'drivers'), orderBy('name')), (snap) => {
      setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Driver)));
    }, (error) => {
      console.error("Error in drivers snapshot:", error);
    });

    const unsubReports = onSnapshot(query(collection(db, 'reports'), orderBy('createdAt', 'desc')), (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
    }, (error) => {
      console.error("Error in reports snapshot:", error);
    });

    const unsubSchedules = onSnapshot(query(collection(db, 'schedules'), orderBy('time')), (snap) => {
      setSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() } as Schedule)));
    }, (error) => {
      console.error("Error in schedules snapshot:", error);
    });

    const unsubUsers = onSnapshot(query(collection(db, 'users'), orderBy('name')), (snap) => {
      setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    }, (error) => {
      console.error("Error in users snapshot:", error);
    });

    const unsubHistory = onSnapshot(query(collection(db, 'history'), orderBy('createdAt', 'desc')), (snap) => {
      setSearchHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Error in history snapshot:", error);
    });

    const unsubTouristPosts = onSnapshot(query(collection(db, 'touristPosts'), orderBy('createdAt', 'desc')), (snap) => {
      setTouristPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as TouristPost)));
    }, (error) => {
      console.error("Error in touristPosts snapshot:", error);
    });

    return () => {
      unsubRoutes();
      unsubStops();
      unsubMappings();
      unsubDrivers();
      unsubReports();
      unsubSchedules();
      unsubUsers();
      unsubHistory();
      unsubTouristPosts();
    };
  }, []);

  const handleFileUpload = async (file: File, path: string): Promise<string> => {
    setUploading(path);
    try {
      const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setUploading(null);
      return url;
    } catch (error) {
      console.warn("Firebase Storage failed or disabled on free plan. Falling back to compressed Base64 stored in Firestore:", error);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 350;
            const MAX_HEIGHT = 350;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
              setUploading(null);
              resolve(compressedBase64);
              return;
            }
            setUploading(null);
            resolve(event.target?.result as string);
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const addRoute = async () => {
    if (!newRoute.name) return alert('El NOMBRE COMERCIAL es obligatorio.');
    if (!newRoute.code) return alert('La PLACA de la unidad es obligatoria.');
    if (!newRoute.photoUrl) return alert('La FOTO DE LA UNIDAD es obligatoria.');
    if (!newRoute.driverId) return alert('Debes seleccionar un CHOFER.');

    await addDoc(collection(db, 'routes'), newRoute);
    setNewRoute({ name: '', code: '', color: '#10b981', status: 'excellent', photoUrl: '', driverId: '' });
    setNotification({ message: 'Ruta agregada exitosamente', type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };

  const addStop = async () => {
    if (!newStop.name) return alert('El NOMBRE O NÚMERO DE BAHÍA es obligatorio.');
    if (!newStop.lat || !newStop.lng) return alert('Las COORDENADAS (Latitud y Longitud) son obligatorias.');
    if (!newStop.photoUrl) return alert('La FOTO DE LA BAHÍA es obligatoria.');

    await addDoc(collection(db, 'stops'), newStop);
    setNewStop({ name: '', lat: 0, lng: 0, generalInfo: '', photoUrl: '' });
    setNotification({ message: 'Bahía agregada exitosamente', type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };

  const addMapping = async () => {
    if (!newMapping.routeId) return alert('Selecciona una ruta');
    if (!newMapping.stopId) return alert('Selecciona una bahía');
    if (!newMapping.arrivalTime || !newMapping.departureTime) return alert('Ingresa los horarios');
    
    const timeToMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const arrMin = timeToMinutes(newMapping.arrivalTime);
    const depMin = timeToMinutes(newMapping.departureTime);

    if (depMin <= arrMin) return alert('La hora de salida debe ser mayor a la de llegada');

    // Conflict detection across ALL routeStops (which now act as schedules)
    const conflict = routeStops.find(rs => {
      if (rs.stopId !== newMapping.stopId) return false;
      const rsArr = timeToMinutes(rs.arrivalTime);
      const rsDep = timeToMinutes(rs.departureTime);
      
      // Safety gap: 5 minutes
      const GAP = 5;
      return (arrMin < rsDep + GAP) && (depMin > rsArr - GAP);
    });

    if (conflict) {
      const conflictRoute = routes.find(r => r.id === conflict.routeId);
      return alert(`CONFLICTO: La ruta ${conflictRoute?.code} ya usa esta bahía entre ${conflict.arrivalTime} y ${conflict.departureTime}. Por favor deja un margen de tiempo.`);
    }

    await addDoc(collection(db, 'routeStops'), newMapping);
    setNewMapping({ ...newMapping, sequence: newMapping.sequence + 1 });
    setNotification({ message: 'Conexión y horario establecidos', type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };

  const addDriver = async () => {
    if (!newDriver.name) return alert('El nombre del chofer es obligatorio.');
    if (!newDriver.photoUrl) return alert('La foto del chofer es obligatoria.');
    if (!newDriver.licensePhotoUrl) return alert('La foto de la licencia es obligatoria.');
    if (!newDriver.idCardPhotoUrl) return alert('La foto de la cédula es obligatoria.');
    if (!newDriver.phoneNumber) return alert('El número de celular es obligatorio.');

    await addDoc(collection(db, 'drivers'), newDriver);
    setNewDriver({ name: '', age: 30, photoUrl: '', idCardPhotoUrl: '', licensePhotoUrl: '', phoneNumber: '', experience: '', generalInfo: '' });
    setNotification({ message: 'Chofer registrado', type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };

  const addSchedule = async () => {
    if (!newSchedule.routeId || !newSchedule.stopId || !newSchedule.arrivalTime || !newSchedule.departureTime) return;
    
    const timeToMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const newArrival = timeToMinutes(newSchedule.arrivalTime);
    const newDeparture = timeToMinutes(newSchedule.departureTime);

    // 1. Path verification
    const inPath = routeStops.some(m => m.routeId === newSchedule.routeId && m.stopId === newSchedule.stopId);

    // 2. Format check
    if (newDeparture <= newArrival) {
      setNotification({ message: 'La hora de salida debe ser después de la llegada', type: 'error' });
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    // Conflict detection for the same stop
    const conflict = schedules.find(s => {
      if (s.stopId !== newSchedule.stopId) return false;
      const sArrival = timeToMinutes(s.arrivalTime || s.time);
      const sDeparture = timeToMinutes(s.departureTime || s.arrivalTime || s.time);
      
      // Overlap logic: (StartA < EndB) and (EndA > StartB)
      return (newArrival < sDeparture) && (newDeparture > sArrival);
    });

    if (conflict) {
      const conflictRoute = routes.find(r => r.id === conflict.routeId);
      setNotification({ 
        message: `Conflicto detectado con la ruta ${conflictRoute?.code || 'desconocida'} (${conflict.arrivalTime || conflict.time} - ${conflict.departureTime || conflict.arrivalTime})`, 
        type: 'error' 
      });
      setTimeout(() => setNotification(null), 6000);
      return;
    }

    await addDoc(collection(db, 'schedules'), {
      ...newSchedule,
      time: newSchedule.arrivalTime // Legacy support
    });
    setNotification({ message: 'Horario programado exitosamente', type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };

  const respondToReport = async (reportId: string) => {
    const response = adminResponse[reportId];
    if (!response) return;
    await updateDoc(doc(db, 'reports', reportId), { adminResponse: response, status: 'resolved' });
    setAdminResponse({ ...adminResponse, [reportId]: '' });
    setNotification({ message: 'Respuesta enviada', type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };

  const [adminChatText, setAdminChatText] = useState<{ [reportId: string]: string }>({});

  const sendReportChat = async (reportId: string) => {
    const text = adminChatText[reportId];
    if (!text || !text.trim()) return;

    const currentReport = reports.find(r => r.id === reportId);
    if (!currentReport) return;

    const newMessage = {
      id: 'msg-' + Date.now(),
      senderId: 'admin',
      senderName: 'Administrador (Soporte)',
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    const existingMessages = currentReport.messages || [];
    const updatedMessages = [...existingMessages, newMessage];

    await updateDoc(doc(db, 'reports', reportId), {
      messages: updatedMessages,
      // Update the legacy adminResponse field for backwards compatibility
      adminResponse: text.trim(),
      status: 'resolved'
    });

    setAdminChatText({ ...adminChatText, [reportId]: '' });
    setNotification({ message: 'Mensaje enviado al usuario', type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };

  const updateReportStatus = async (reportId: string, newStatus: 'pending' | 'resolved') => {
    await updateDoc(doc(db, 'reports', reportId), {
      status: newStatus
    });
    setNotification({ message: `Estado del reporte actualizado a ${newStatus === 'resolved' ? 'Resuelto' : 'Pendiente'}`, type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };

  const deleteItem = (coll: string, id: string) => {
    let itemName = 'este elemento';
    if (coll === 'routes') itemName = 'esta ruta';
    else if (coll === 'stops') itemName = 'esta bahía/parada';
    else if (coll === 'drivers') itemName = 'este chofer';
    else if (coll === 'routeStops') itemName = 'esta asignación de parada';
    else if (coll === 'reports') itemName = 'este reporte';
    else if (coll === 'users') itemName = 'este usuario';

    setConfirmDelete({ coll, id, itemName });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { coll, id } = confirmDelete;
    try {
      await deleteDoc(doc(db, coll, id));
      setNotification({ message: 'Elemento eliminado con éxito', type: 'success' });
      if (coll === 'users' && selectedUserId === id) {
        setSelectedUserId(null);
      }
    } catch (err: any) {
      console.error("Error deleting document from Firestore", err);
      setNotification({ message: 'Error al eliminar elemento', type: 'error' });
    }
    setConfirmDelete(null);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSavePassenger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassenger.name || !newPassenger.email) {
      setNotification({ message: 'Nombre y correo son obligatorios', type: 'error' });
      return;
    }

    try {
      if (editingPassengerId) {
        await updateDoc(doc(db, 'users', editingPassengerId), {
          name: newPassenger.name,
          email: newPassenger.email,
          phoneNumber: newPassenger.phoneNumber || '',
          role: newPassenger.role,
          photoUrl: newPassenger.photoUrl || ''
        });
        setNotification({ message: 'Usuario actualizado con éxito', type: 'success' });
        setEditingPassengerId(null);
      } else {
        const docRef = await addDoc(collection(db, 'users'), {
          name: newPassenger.name,
          email: newPassenger.email,
          phoneNumber: newPassenger.phoneNumber || '',
          role: newPassenger.role,
          photoUrl: newPassenger.photoUrl || 'https://images.unsplash.com/photo-1554224155-1696413565d3?auto=format&fit=crop&q=80&w=200',
          createdAt: new Date().toISOString()
        });
        setSelectedUserId(docRef.id);
        setNotification({ message: 'Usuario registrado con éxito', type: 'success' });
      }
      setNewPassenger({ name: '', email: '', phoneNumber: '', role: 'passenger', photoUrl: '' });
      setIsAddingPassenger(false);
    } catch (err: any) {
      console.error("Error saving user:", err);
      setNotification({ message: 'Error al guardar el usuario', type: 'error' });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSaveTouristPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTouristPost.title || !newTouristPost.description) {
      setNotification({ message: 'El título y la descripción son requeridos', type: 'error' });
      return;
    }

    try {
      const galleryPhotos = newTouristPost.galleryPhotosStr
        ? newTouristPost.galleryPhotosStr.split(',').map(s => s.trim()).filter(Boolean)
        : [newTouristPost.coverPhoto || 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&q=80&w=800'];

      const recommendedRoutes = newTouristPost.recommendedRoutesStr
        ? newTouristPost.recommendedRoutesStr.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const postData = {
        title: newTouristPost.title,
        subtitle: newTouristPost.subtitle || '',
        description: newTouristPost.description,
        category: newTouristPost.category || 'Puerto & Recreación',
        coverPhoto: newTouristPost.coverPhoto || 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&q=80&w=800',
        galleryPhotos: galleryPhotos.length > 0 ? galleryPhotos : [newTouristPost.coverPhoto || 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&q=80&w=800'],
        schedule: newTouristPost.schedule || 'Lunes a Domingo: 8:00 AM - 10:00 PM',
        entryFee: newTouristPost.entryFee || 'Acceso Libre',
        destinationStopName: newTouristPost.destinationStopName || 'Bahía Principal',
        recommendedRoutes,
        createdAt: new Date().toISOString()
      };

      if (editingTouristPostId) {
        await updateDoc(doc(db, 'touristPosts', editingTouristPostId), postData);
        setNotification({ message: 'Publicación turística actualizada con éxito', type: 'success' });
        setEditingTouristPostId(null);
      } else {
        await addDoc(collection(db, 'touristPosts'), postData);
        setNotification({ message: 'Publicación turística creada con éxito', type: 'success' });
      }

      setNewTouristPost({
        title: '',
        subtitle: '',
        description: '',
        category: 'Puerto & Recreación',
        coverPhoto: '',
        galleryPhotosStr: '',
        schedule: 'Lunes a Domingo: 8:00 AM - 10:00 PM',
        entryFee: 'Acceso Libre',
        destinationStopName: '',
        recommendedRoutesStr: ''
      });
      setIsAddingTouristPost(false);
    } catch (err: any) {
      console.error("Error saving tourist post:", err);
      setNotification({ message: 'Error al guardar la publicación turística', type: 'error' });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  const processedChartData = React.useMemo(() => {
    const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const result = [];
    
    // Generar datos para los últimos 7 días
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = days[d.getDay()];
      const dateStr = d.toDateString();
      
      // Contar reportes reales para este día
      const dayReports = reports.filter(r => {
        try {
          return new Date(r.createdAt).toDateString() === dateStr;
        } catch (e) {
          return false;
        }
      }).length;
      
      result.push({
        name: dayName,
        reportes: dayReports,
        rutas: routes.length // Representa la flota total disponible
      });
    }
    return result;
  }, [reports, routes]);

  const menuItems: { id: Section; label: string; icon: any }[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'progress', label: 'Rutas en Movimiento', icon: Activity },
    { id: 'routes', label: 'Rutas', icon: Bus },
    { id: 'stops', label: 'Bahías', icon: MapPin },
    { id: 'connections', label: 'Planificación', icon: List },
    { id: 'drivers', label: 'Choferes', icon: Users },
    { id: 'touristPosts', label: 'Sitios Turísticos', icon: Compass },
    { id: 'reports', label: 'Reportes', icon: FileText },
    { id: 'users', label: 'Usuarios', icon: Users },
  ];

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col lg:flex-row bg-white rounded-[1.5rem] lg:rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-100 min-h-[850px] w-full max-w-[1600px] mx-auto my-4 relative">
      {/* Mobile Sidebar Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-[11000] w-14 h-14 bg-nic-blue text-white rounded-full shadow-2xl flex items-center justify-center"
      >
        {isSidebarOpen ? <ArrowLeft size={24} /> : <LayoutDashboard size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={cn(
        "w-72 bg-zinc-900 p-8 flex flex-col gap-10 shrink-0 transition-all duration-300 z-50",
        "fixed inset-y-0 left-0 lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-nic-blue rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Bus size={24} />
          </div>
          <span className="text-white font-black text-xl tracking-tighter">NicaGo Admin</span>
        </div>

        <nav className="flex-1 flex flex-col gap-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveSection(item.id); setIsSidebarOpen(false); }}
              className={cn(
                "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group relative",
                activeSection === item.id 
                  ? "bg-nic-blue text-white shadow-xl shadow-blue-500/20" 
                  : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              )}
            >
              <item.icon size={20} className={cn(
                "transition-transform group-hover:scale-110",
                activeSection === item.id ? "text-white" : "text-zinc-500"
              )} />
              <span className="font-bold text-sm tracking-tight">{item.label}</span>
              {item.id === 'reports' && reports.filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-auto w-5 h-5 bg-nic-red text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-red-500/20">
                  {reports.filter(r => r.status === 'pending').length}
                </span>
              )}
              {activeSection === item.id && (
                <motion.div 
                  layoutId="active-pill"
                  className="absolute left-0 w-1 h-6 bg-white rounded-r-full"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-4 bg-zinc-800/50 rounded-3xl border border-zinc-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-nic-blue/20 flex items-center justify-center text-nic-blue">
              <User size={16} />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold text-white truncate">Administrador</p>
              <p className="text-[10px] text-zinc-500 truncate">{auth.currentUser?.email || 'admin@nicago.com'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-zinc-50/50">
        {/* Header */}
        <header className="px-6 lg:px-10 py-6 lg:py-8 flex items-center justify-between bg-white border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="text-2xl lg:text-3xl font-black text-zinc-900 tracking-tight capitalize">
              {menuItems.find(m => m.id === activeSection)?.label}
            </h2>
            <p className="text-xs lg:text-sm text-zinc-400 font-medium mt-1">
              {activeSection === 'overview' ? 'Bienvenido al panel de control central.' : `Gestiona tus ${activeSection} de manera eficiente.`}
            </p>
          </div>
          <div className="flex items-center gap-2 lg:gap-4 font-sans">
            <div className="relative block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en el panel..." 
                className="pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:ring-4 focus:ring-nic-blue/5 focus:border-nic-blue outline-none transition-all w-36 sm:w-64 font-bold text-zinc-800"
              />
            </div>
            <button 
              onClick={() => {
                setActiveSection('overview');
                setSearchQuery('');
              }}
              className="p-2 lg:p-2.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-400 hover:text-nic-blue rounded-xl border border-zinc-200 hover:border-nic-blue/20 transition-all cursor-pointer active:scale-95 flex items-center justify-center"
              title="Ir al Dashboard / Estadísticas"
            >
              <TrendingUp size={18} />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 lg:p-2.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-400 hover:text-nic-blue rounded-xl border border-zinc-200 hover:border-nic-blue/20 transition-all cursor-pointer active:scale-95 flex items-center justify-center"
              title="Ajustes de la Base de Datos"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          {/* Notifications Panel in Real-Time for Admins when a passenger reports an incident - shown in the reports active section */}
          <AnimatePresence>
            {activeSection === 'reports' && reports.filter(r => r.status === 'pending').slice(0, 3).map((pendingReport) => {
              const associatedRoute = routes.find(r => r.id === pendingReport.targetId);
              const driverIdToUse = pendingReport.driverId || associatedRoute?.driverId;
              const assignedDriver = drivers.find(d => d.id === driverIdToUse);

              return (
                <motion.div
                  key={pendingReport.id}
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  className="mb-6 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200/60 p-5 rounded-[2rem] shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-full blur-3xl opacity-30 pointer-events-none" />
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-nic-red text-white flex items-center justify-center shrink-0 shadow-lg shadow-red-500/25">
                      <AlertCircle size={20} className="animate-pulse" />
                    </div>
                    <div className="space-y-1 text-zinc-800">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-black tracking-widest text-red-700 bg-red-100 px-2.5 py-1 rounded-full uppercase">
                          Alerta de incidente real-time
                        </span>
                        <span className="text-[10px] text-zinc-400 font-bold">
                          {new Date(pendingReport.createdAt).toLocaleString('es-NI')}
                        </span>
                      </div>
                      
                      <h4 className="text-sm font-black text-zinc-950">
                        Incidente reportado por: <strong className="text-zinc-900">{pendingReport.userName || 'Usuario / Pasajero'}</strong>
                      </h4>
                      
                      <p className="text-xs font-bold text-zinc-600">
                        Motivo: <span className="text-nic-red font-extrabold text-xs">
                          {pendingReport.reason === 'drunk' ? '🍺 Conductor Ebrio / Bajo efectos' :
                           pendingReport.reason === 'reckless' ? '⚠️ Conducción Temeraria / Imprudente' :
                           '🚨 Chofer descuidado / Desatento en vía'}
                        </span>
                      </p>
                      
                      <p className="text-xs bg-white/70 border border-red-100/50 p-3 rounded-2xl italic text-zinc-600 mt-2 max-w-2xl font-semibold p-3.5">
                        "{pendingReport.description}"
                      </p>

                      {/* Validar qué chofer estaba asignado a la ruta en cuestión */}
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {pendingReport.type === 'route' && (
                          <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-white border border-zinc-100 px-3 py-1.5 rounded-xl font-bold">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: associatedRoute?.color || '#ef4444' }} />
                            <span>Ruta: <strong className="text-zinc-900 font-black">{associatedRoute ? `${associatedRoute.name} (${associatedRoute.code})` : (pendingReport.targetId && pendingReport.targetId.startsWith('custom:') ? pendingReport.targetId.substring(7) : (pendingReport.targetId || 'Ruta General'))}</strong></span>
                          </div>
                        )}
                        {assignedDriver ? (
                          <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-white border border-zinc-100 px-3 py-1.5 rounded-xl font-bold">
                            {assignedDriver.photoUrl && !failedImages[assignedDriver.photoUrl] ? (
                              <img 
                                src={assignedDriver.photoUrl} 
                                className="w-5 h-5 rounded-full object-cover border border-zinc-200" 
                                referrerPolicy="no-referrer" 
                                onError={() => setFailedImages(prev => ({ ...prev, [assignedDriver.photoUrl]: true }))}
                              />
                            ) : (
                              <User size={14} className="text-zinc-400" />
                            )}
                            <span>{associatedRoute && isBoatRoute(associatedRoute.name) ? 'Capitán' : 'Chofer'} Validado: <strong className="text-zinc-900 font-black">{assignedDriver.name}</strong></span>
                          </div>
                        ) : associatedRoute && isBoatRoute(associatedRoute.name) ? (
                          <div className="flex items-center gap-1.5 text-xs text-zinc-650 bg-white border border-zinc-200 px-3 py-1.5 rounded-xl font-semibold">
                            <span>Capitán Validado: <strong className="text-zinc-900 font-black">Capitán de Guardia</strong></span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200/50 px-3 py-1.5 rounded-xl font-bold">
                            <span>⚠️ Alerta: Sin Chofer Asignado</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex gap-2 w-full md:w-auto justify-end">
                    <button
                      onClick={async () => {
                        await updateDoc(doc(db, 'reports', pendingReport.id), { status: 'resolved', adminResponse: 'Atendido mediante control de operaciones táctico.' });
                        setNotification({ message: 'Alerta resuelta con éxito', type: 'success' });
                        setTimeout(() => setNotification(null), 3000);
                      }}
                      className="w-full md:w-auto px-5 py-3 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-95"
                    >
                      Atender & Resolver
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {activeSection === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                  {[
                    { label: 'Rutas Totales', value: routes.length, icon: Bus, color: 'text-nic-blue', bg: 'bg-blue-50' },
                    { label: 'Bahías Activas', value: stops.length, icon: MapPin, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    { label: 'Choferes', value: drivers.length, icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
                    { label: 'Reportes Hoy', value: reports.filter(r => new Date(r.createdAt).toDateString() === new Date().toDateString()).length, icon: Activity, color: 'text-nic-red', bg: 'bg-red-50' },
                    { label: 'Usuarios', value: usersList.length, icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm hover:shadow-xl hover:shadow-zinc-200/50 transition-all group">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                        <stat.icon size={24} />
                      </div>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{stat.label}</p>
                      <p className="text-3xl font-black text-zinc-900 mt-1">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-lg font-bold text-zinc-900">Actividad Semanal</h3>
                      <select className="bg-zinc-50 border-none text-xs font-bold text-zinc-500 rounded-lg px-3 py-1.5 outline-none">
                        <option>Últimos 7 días</option>
                        <option>Último mes</option>
                      </select>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={processedChartData}>
                          <defs>
                            <linearGradient id="colorRutas" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0056b3" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#0056b3" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#a1a1aa'}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#a1a1aa'}} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                          />
                          <Area type="monotone" dataKey="rutas" name="Unidades" stroke="#0056b3" strokeWidth={3} fillOpacity={1} fill="url(#colorRutas)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-lg font-bold text-zinc-900">Reportes por Día</h3>
                      <Activity size={20} className="text-nic-red" />
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={processedChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#a1a1aa'}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#a1a1aa'}} />
                          <Tooltip 
                            cursor={{fill: '#f8fafc'}}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                          />
                          <Bar dataKey="reportes" name="Reportes" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={30} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Recent Activity / Quick Actions */}
                <div className="bg-zinc-900 p-10 rounded-[3rem] text-white shadow-2xl shadow-zinc-900/20 flex flex-col md:flex-row items-center gap-10">
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-3xl font-black tracking-tight mb-4">Optimiza tu Red de Transporte</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed max-w-md mx-auto md:mx-0">
                      Utiliza las herramientas de análisis para identificar cuellos de botella en las rutas y mejorar la puntualidad de los choferes.
                    </p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-8">
                      <button onClick={() => setActiveSection('routes')} className="px-6 py-3 bg-nic-blue text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20">
                        Nueva Ruta
                      </button>
                      <button onClick={() => setActiveSection('reports')} className="px-6 py-3 bg-zinc-800 text-zinc-300 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-zinc-700 transition-all">
                        Ver Reportes
                      </button>
                      <button 
                        onClick={async () => {
                          setNotification({ message: 'Sembrando datos...', type: 'success' });
                          try {
                            await seedDatabase();
                            setNotification({ message: 'Datos cargados exitosamente', type: 'success' });
                          } catch (err: any) {
                            setNotification({ message: 'Error al sembrar datos', type: 'error' });
                          }
                          setTimeout(() => setNotification(null), 3000);
                        }}
                        className="px-6 py-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center gap-2"
                      >
                        <Activity size={16} />
                        Cargar Prueba
                      </button>
                      <button 
                        onClick={async () => {
                          setNotification({ message: 'Limpiando base de datos...', type: 'success' });
                          try {
                            await clearDatabase();
                            setNotification({ message: 'Base de datos limpia', type: 'success' });
                          } catch (err: any) {
                            setNotification({ message: 'Error al vaciar base de datos', type: 'error' });
                          }
                          setTimeout(() => setNotification(null), 3000);
                        }}
                        className="px-6 py-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-rose-500/20 transition-all flex items-center gap-2"
                      >
                        <Trash2 size={16} />
                        Limpiar Todo
                      </button>
                    </div>
                  </div>
                  <div className="w-full md:w-64 aspect-square bg-gradient-to-br from-nic-blue to-blue-900 rounded-[2.5rem] flex items-center justify-center p-8 relative overflow-hidden group shrink-0">
                    <Bus size={120} className="text-white/20 absolute -bottom-4 -right-4 transition-transform group-hover:scale-110" />
                    <div className="text-center relative z-10">
                      <p className="text-5xl font-black mb-2">{routes.length}</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Rutas Operativas</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === 'routes' && (
              <motion.div 
                key="routes"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="bg-white p-10 rounded-[2.5rem] border border-zinc-100 shadow-sm">
                  <h3 className="text-xl font-bold text-zinc-900 mb-8 flex items-center gap-3">
                    <Plus size={20} className="text-nic-blue" />
                    Registrar Nueva Ruta
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Nombre Comercial de la Ruta</label>
                         <input 
                           type="text" placeholder="Ej: Ruta 110" value={newRoute.name}
                           onChange={e => setNewRoute({...newRoute, name: e.target.value})}
                           className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-4 focus:ring-nic-blue/5 focus:border-nic-blue outline-none transition-all font-medium"
                         />
                       </div>
                       <div className="space-y-2">
                         <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Placa de la Unidad</label>
                         <input 
                           type="text" placeholder="Ej: M 123 456" value={newRoute.code}
                           onChange={e => setNewRoute({...newRoute, code: e.target.value})}
                           className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-4 focus:ring-nic-blue/5 focus:border-nic-blue outline-none transition-all font-medium"
                         />
                       </div>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Estado de la Ruta</label>
                        <select 
                          value={newRoute.status}
                          onChange={e => setNewRoute({...newRoute, status: e.target.value as 'bad' | 'good' | 'excellent'})}
                          className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-4 focus:ring-nic-blue/5 focus:border-nic-blue outline-none transition-all font-medium appearance-none"
                        >
                          <option value="excellent">Excelente</option>
                          <option value="good">Buena</option>
                          <option value="bad">Mala</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Chofer Asignado</label>
                        <select 
                          value={newRoute.driverId}
                          onChange={e => setNewRoute({...newRoute, driverId: e.target.value})}
                          className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-4 focus:ring-nic-blue/5 focus:border-nic-blue outline-none transition-all font-medium appearance-none"
                        >
                          <option value="">-- Elige un Chofer --</option>
                          {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 w-full space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Fotografía de la Unidad</label>
                      <div className="relative group">
                        <input 
                          type="file" accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const url = await handleFileUpload(file, 'routes');
                              setNewRoute({...newRoute, photoUrl: url});
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <div className={cn(
                          "w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm flex items-center gap-3 transition-all",
                          uploading === 'routes' ? "animate-pulse border-nic-blue" : "group-hover:border-zinc-200"
                        )}>
                          {newRoute.photoUrl ? <CheckCircle size={18} className="text-emerald-500" /> : <Camera size={18} className="text-zinc-400" />}
                          <span className="text-zinc-500 font-medium">
                            {uploading === 'routes' ? 'Procesando imagen...' : newRoute.photoUrl ? 'Imagen lista' : 'Subir foto de la unidad'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button onClick={addRoute} className="w-full md:w-auto px-10 py-4 bg-nic-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20 self-end">
                      Guardar Ruta
                    </button>
                  </div>
                </div>

                {/* Localized Inline Search Box for Routes */}
                <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-sans" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar ruta por nombre o placa de unidad..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-semibold text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-nic-blue/40 focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                  <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => setRouteViewMode(routeViewMode === 'all' ? 'hidden' : 'all')}
                      className={cn(
                        "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border active:scale-95 cursor-pointer flex items-center gap-1.5",
                        routeViewMode === 'all' ? "bg-zinc-900 text-white border-transparent" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                      )}
                    >
                      <Eye size={12} />
                      {routeViewMode === 'all' ? 'Ocultar todo' : 'Ver todos'}
                    </button>
                    <button
                      onClick={() => setRouteViewMode(routeViewMode === 'alphabetical' ? 'hidden' : 'alphabetical')}
                      className={cn(
                        "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border active:scale-95 cursor-pointer flex items-center gap-1.5",
                        routeViewMode === 'alphabetical' ? "bg-zinc-900 text-white border-transparent" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                      )}
                    >
                      <SortAsc size={12} />
                      A-Z
                    </button>
                  </div>
                </div>

                {/* Active Mode indicator pill */}
                {(routeViewMode !== 'hidden' || searchQuery.trim() !== '') && (
                  <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200/50 px-4 py-2.5 rounded-xl animate-fadeIn">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-650 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-nic-blue animate-pulse" />
                      {searchQuery.trim() !== '' ? 'Resultados de Búsqueda' : routeViewMode === 'alphabetical' ? 'Orden: Alfabético A-Z' : 'Lista: Todas las Rutas'}
                    </span>
                    <button
                      onClick={() => {
                        setRouteViewMode('hidden');
                        setSearchQuery('');
                      }}
                      className="text-[9px] font-black uppercase text-rose-500 hover:text-rose-600 tracking-widest flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      ✕ Limpiar Vista
                    </button>
                  </div>
                )}

                {routeViewMode === 'hidden' && searchQuery.trim() === '' ? (
                  <div className="py-12 px-4 text-center space-y-6 animate-fadeIn bg-zinc-50/50 rounded-3xl border border-dashed border-zinc-200/80">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                      <Bus size={24} />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Módulo Organizado de Rutas</h4>
                      <p className="text-[10px] text-zinc-500 max-w-[280px] mx-auto leading-relaxed">
                        Para mantener la interfaz profesional, el listado directo de rutas está oculto. Use el buscador superior o escoja una opción para visualizar.
                      </p>
                    </div>
                    
                    <div className="pt-2 flex flex-col sm:flex-row gap-2 max-w-[340px] mx-auto justify-center">
                      <button
                        onClick={() => {
                          setRouteViewMode('all');
                        }}
                        className="w-full sm:w-auto px-4 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Eye size={12} />
                        Mostrar todas las rutas
                      </button>
                      
                      <button
                        onClick={() => {
                          setRouteViewMode('alphabetical');
                        }}
                        className="w-full sm:w-auto px-4 py-3 bg-white hover:bg-zinc-50 border border-zinc-250 text-zinc-900 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <SortAsc size={12} />
                        Mostrar por orden A-Z
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {(() => {
                      const filtered = routes.filter(r => 
                        r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        r.code.toLowerCase().includes(searchQuery.toLowerCase())
                      );

                      if (routeViewMode === 'alphabetical' || searchQuery.trim() !== '') {
                        filtered.sort((a, b) => a.name.localeCompare(b.name));
                      }

                      if (filtered.length === 0) {
                        return (
                          <div className="col-span-full text-center py-12 text-zinc-400">
                            <Bus className="mx-auto text-zinc-200 mb-3" size={40} />
                            <p className="text-xs font-bold uppercase tracking-wider">No se encontraron rutas</p>
                          </div>
                        );
                      }

                      return filtered.map((r, rIdx) => (
                        <div key={r.id} className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm hover:shadow-xl transition-all group animate-fadeIn">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-100 shrink-0">
                              <img 
                                src={r.photoUrl && !failedImages[r.photoUrl] ? r.photoUrl : DEFAULT_BUS_PHOTOS[rIdx % DEFAULT_BUS_PHOTOS.length]} 
                                alt="" 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer" 
                                onError={() => setFailedImages(prev => ({ ...prev, [r.photoUrl || 'default']: true }))}
                              />
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <h4 className="text-lg font-black text-zinc-900 truncate">{r.name}</h4>
                              <p className="text-xs text-zinc-400 font-bold uppercase tracking-tighter truncate">Placa: {r.code}</p>
                            </div>
                            <div className={cn(
                              "px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest",
                              r.status === 'excellent' ? "bg-emerald-50 text-emerald-600" :
                              r.status === 'good' ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"
                            )}>
                              {r.status}
                            </div>
                            <button onClick={() => deleteItem('routes', r.id)} className="p-2 text-zinc-300 hover:text-nic-red hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                              <Trash2 size={18} />
                            </button>
                          </div>
                          <div className="space-y-3 pt-4 border-t border-zinc-50">
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                              <span>Chofer</span>
                              <span className="text-zinc-900">{drivers.find(d => d.id === r.driverId)?.name || 'No asignado'}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                              <span>Paradas</span>
                              <span className="text-zinc-900">{routeStops.filter(m => m.routeId === r.id).length}</span>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </motion.div>
            )}

            {activeSection === 'stops' && (
              <motion.div 
                key="stops"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="bg-white p-10 rounded-[2.5rem] border border-zinc-100 shadow-sm">
                  <h3 className="text-xl font-bold text-zinc-900 mb-8 flex items-center gap-3">
                    <MapPin size={20} className="text-emerald-500" />
                    Nueva Bahía de Parada
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Nombre o Número de Bahía</label>
                        <input 
                          type="text" placeholder="Ej: Bahía #15 o Metrocentro" value={newStop.name}
                          onChange={e => setNewStop({...newStop, name: e.target.value})}
                          className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all font-medium"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Latitud</label>
                          <input 
                            type="number" placeholder="12.1234" value={newStop.lat || ''}
                            onChange={e => setNewStop({...newStop, lat: parseFloat(e.target.value)})}
                            className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all font-medium"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Longitud</label>
                          <input 
                            type="number" placeholder="-86.1234" value={newStop.lng || ''}
                            onChange={e => setNewStop({...newStop, lng: parseFloat(e.target.value)})}
                            className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all font-medium"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Información General de la Bahía</label>
                        <textarea 
                          placeholder="Ej: Ubicada frente a la UCA, techada, con asientos..." value={newStop.generalInfo}
                          onChange={e => setNewStop({...newStop, generalInfo: e.target.value})}
                          className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all font-medium h-32 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex-1 w-full max-w-md space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Foto de Referencia</label>
                      <div className="relative group">
                        <input 
                          type="file" accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const url = await handleFileUpload(file, 'stops');
                              setNewStop({...newStop, photoUrl: url});
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <div className={cn(
                          "w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm flex items-center gap-3 transition-all",
                          uploading === 'stops' ? "animate-pulse border-emerald-500" : "group-hover:border-zinc-200"
                        )}>
                          {newStop.photoUrl ? <CheckCircle size={18} className="text-emerald-500" /> : <Camera size={18} className="text-zinc-400" />}
                          <span className="text-zinc-500 font-medium">
                            {uploading === 'stops' ? 'Subiendo...' : newStop.photoUrl ? 'Foto cargada' : 'Capturar foto de la bahía'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button onClick={addStop} className="w-full md:w-auto px-10 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20">
                      Registrar Bahía
                    </button>
                  </div>
                </div>

                {/* Localized Inline Search Box for Bahías */}
                <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-sans" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar bahía por nombre o información general..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-semibold text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-emerald-500/40 focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                  {searchQuery.trim() !== '' && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-600 tracking-widest flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      ✕ Limpiar Búsqueda
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {stops.filter(s => 
                    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (s.generalInfo && s.generalInfo.toLowerCase().includes(searchQuery.toLowerCase()))
                  ).map(s => (
                    <div key={s.id} className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm hover:shadow-xl transition-all group">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-zinc-50 border border-zinc-100 shrink-0">
                          <img 
                            src={s.photoUrl && !failedImages[s.photoUrl] ? s.photoUrl : busImg2} 
                            alt="" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                            onError={() => setFailedImages(prev => ({ ...prev, [s.photoUrl || 'default-stop']: true }))}
                          />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h4 className="text-base font-black text-zinc-900 truncate">{s.name}</h4>
                          <p className="text-[10px] font-mono text-zinc-400">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</p>
                        </div>
                        <button onClick={() => deleteItem('stops', s.id)} className="p-2 text-zinc-300 hover:text-nic-red hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {routeStops.filter(m => m.stopId === s.id).map(m => {
                          const r = routes.find(route => route.id === m.routeId);
                          return r ? (
                            <span key={m.id} className="px-2 py-1 bg-zinc-50 text-zinc-500 text-[9px] font-black rounded-lg border border-zinc-100">
                              {r.code}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeSection === 'reports' && (
              <motion.div 
                key="reports"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Header section with Stats & Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-zinc-200/60 shadow-sm">
                  <div>
                    <h3 className="text-lg font-black text-zinc-950">Centro de Atención a Reportes (Chat Directo)</h3>
                    <p className="text-xs text-zinc-400 font-medium">Interactúa en tiempo real con los pasajeros para dar seguimiento y resolver incidentes.</p>
                  </div>
                  
                  {/* Filter tabs */}
                  <div className="flex flex-wrap gap-1.5 bg-zinc-50 p-1.5 rounded-2xl border border-zinc-150 shrink-0">
                    <button 
                      onClick={() => setReportFilterStatus('all')}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                        reportFilterStatus === 'all' 
                          ? "bg-zinc-950 text-white shadow-md shadow-zinc-900/10" 
                          : "text-zinc-500 hover:text-zinc-800"
                      )}
                    >
                      Todos ({reports.length})
                    </button>
                    <button 
                      onClick={() => setReportFilterStatus('pending')}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                        reportFilterStatus === 'pending' 
                          ? "bg-rose-650 bg-rose-600 text-white shadow-md shadow-rose-500/10" 
                          : "text-zinc-500 hover:text-zinc-800"
                      )}
                    >
                      Pendientes ({reports.filter(r => r.status === 'pending' || !r.status).length})
                    </button>
                    <button 
                      onClick={() => setReportFilterStatus('read')}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                        reportFilterStatus === 'read' 
                          ? "bg-amber-500 text-white shadow-md shadow-amber-500/10" 
                          : "text-zinc-500 hover:text-zinc-800"
                      )}
                    >
                      Leídos ({reports.filter(r => r.status === 'read').length})
                    </button>
                    <button 
                      onClick={() => setReportFilterStatus('resolved')}
                      className={cn(
                        "px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                        reportFilterStatus === 'resolved' 
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/10" 
                          : "text-zinc-500 hover:text-zinc-800"
                      )}
                    >
                      Resueltos ({reports.filter(r => r.status === 'resolved').length})
                    </button>
                  </div>
                </div>

                {/* Master Detail Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left list (Master: 5/12 cols) */}
                  <div className={cn("lg:col-span-5 space-y-3 max-h-[650px] overflow-y-auto pr-1", selectedReportId && "hidden lg:block")}>
                    {(() => {
                      const filteredList = reports.filter(report => {
                        // apply text match
                        const textMatch = 
                          (report.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (report.description || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (report.status || '').toLowerCase().includes(searchQuery.toLowerCase());
                        
                        // apply state filter
                        if (reportFilterStatus === 'all') return textMatch;
                        if (reportFilterStatus === 'pending') {
                          return textMatch && (!report.status || report.status === 'pending');
                        }
                        return textMatch && report.status === reportFilterStatus;
                      });

                      if (filteredList.length === 0) {
                        return (
                          <div className="bg-white p-12 text-center rounded-3xl border border-zinc-150">
                            <AlertCircle size={32} className="mx-auto text-zinc-300 mb-3" />
                            <p className="text-xs font-bold text-zinc-500">No se encontraron reportes</p>
                            <p className="text-[11px] text-zinc-400 mt-1">Prueba cambiando tu búsqueda o filtro arriba.</p>
                          </div>
                        );
                      }

                      return filteredList.map(report => {
                        const isSelected = selectedReportId === report.id;
                        
                        // Resolve entity details
                        let entityName = 'Reporte General';
                        let entityTypeLabel = 'Incidente';
                        
                        if (report.type === 'stop') {
                          const s = stops.find(stopObj => stopObj.id === report.targetId);
                          entityName = s ? s.name : (report.targetId && report.targetId.startsWith('custom:') ? report.targetId.substring(7) : (report.targetId || 'Bahía / Parada Especial'));
                          entityTypeLabel = 'Bahía Reportada';
                        } else if (report.type === 'route') {
                          const r = routes.find(routeObj => routeObj.id === report.targetId);
                          entityName = r ? `${r.code} - ${r.name}` : (report.targetId && report.targetId.startsWith('custom:') ? report.targetId.substring(7) : (report.targetId || 'Ruta Especial'));
                          entityTypeLabel = 'Ruta de Autobús';
                        } else if (report.type === 'driver') {
                          const d = drivers.find(drv => drv.id === report.driverId || drv.id === report.targetId);
                          entityName = d ? d.name : 'Conductor de Unidad';
                          entityTypeLabel = 'Personal / Conductor';
                        }

                        // Determine reason tag
                        let reasonTag = 'Detalle de Alerta';
                        let reasonColor = 'bg-zinc-100 text-zinc-650';
                        if (report.reason === 'drunk') {
                          reasonTag = 'Chofer Ebrio';
                          reasonColor = 'bg-red-50 text-red-600 border border-red-150';
                        } else if (report.reason === 'reckless') {
                          reasonTag = 'Chofer Imprudente';
                          reasonColor = 'bg-amber-50 text-amber-600 border border-amber-150';
                        } else if (report.reason === 'bad_condition') {
                          reasonTag = 'Mal Estado';
                          reasonColor = 'bg-indigo-50 text-indigo-600 border border-indigo-150';
                        }

                        return (
                          <div 
                            key={report.id}
                            onClick={async () => {
                              setSelectedReportId(report.id);
                              if (report.status === 'pending') {
                                await updateDoc(doc(db, 'reports', report.id), { status: 'read' });
                              }
                            }}
                            className={cn(
                              "bg-white p-5 rounded-2xl border transition-all text-left cursor-pointer hover:shadow-md relative overflow-hidden",
                              isSelected 
                                ? "border-nic-blue ring-2 ring-nic-blue/20 bg-blue-50/5" 
                                : "border-zinc-200/80 hover:border-zinc-300",
                              report.status === 'pending' ? "shadow-sm shadow-red-500/5" : "opacity-85"
                            )}
                          >
                            {report.status === 'pending' && (
                              <div className="absolute top-0 right-0 w-2 h-2 bg-nic-red rounded-full m-3.5 animate-pulse" />
                            )}
                            
                            <div className="flex items-start justify-between gap-2.5 mb-2">
                              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none">
                                {entityTypeLabel}
                              </span>
                              <span className="text-[8.5px] font-semibold text-zinc-350 shrink-0">
                                {new Date(report.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <h4 className="text-xs font-black text-zinc-950 leading-snug line-clamp-1 mb-1.5">
                              {entityName}
                            </h4>

                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {/* Reason Badge */}
                              <span className={cn("px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider", reasonColor)}>
                                {reasonTag}
                              </span>
                              
                              {/* User name */}
                              <span className="text-[10px] font-bold text-zinc-500 truncate max-w-[120px]">
                                Por: {report.userName || 'Usuario Anónimo'}
                              </span>

                              {/* Status flag */}
                              <span className={cn(
                                "ml-auto text-[8px] uppercase tracking-widest font-black shrink-0",
                                report.status === 'resolved' ? "text-emerald-600" :
                                report.status === 'read' ? "text-amber-500" : "text-rose-650"
                              )}>
                                ● {report.status === 'resolved' ? 'Resuelto' : 
                                   report.status === 'read' ? 'Leído (Abierto)' : 'Pendiente (Sin Abrir)'}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Right Panel (Detail Chat: 7/12 cols) */}
                  <div className={cn("lg:col-span-7 bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-md min-h-[480px] flex flex-col justify-between", !selectedReportId && "hidden lg:flex")}>
                    {selectedReportId ? (() => {
                      const rep = reports.find(r => r.id === selectedReportId);
                      if (!rep) {
                        return (
                          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                            <AlertCircle size={40} className="text-zinc-250 mb-3" />
                            <p className="text-sm font-bold">Reporte no disponible</p>
                          </div>
                        );
                      }

                      // Look up associated user
                      const reporterUser = usersList.find(u => u.id === rep.userId || u.email === rep.userId);

                      // Detailed layout
                      return (
                        <div className="space-y-4 flex flex-col h-full justify-between flex-1">
                          <div>
                            {/* Top info and status controller */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-150 gap-3">
                              {/* Volver button on mobile */}
                              <div className="lg:hidden shrink-0">
                                <button 
                                  onClick={() => setSelectedReportId(null)}
                                  className="flex items-center gap-1.5 text-[10px] font-black text-zinc-700 hover:text-black bg-zinc-100 hover:bg-zinc-200 border border-zinc-205 p-2 px-3 rounded-xl cursor-pointer transition-all uppercase tracking-wider"
                                >
                                  <ArrowLeft size={12} />
                                  Buzón
                                </button>
                              </div>
                              <div className="flex items-center gap-3">
                                {reporterUser?.photoUrl ? (
                                  <img 
                                    src={reporterUser.photoUrl} 
                                    className="w-10 h-10 rounded-full object-cover border border-zinc-200 shrink-0" 
                                    alt="" 
                                    referrerPolicy="no-referrer" 
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-zinc-50 border border-zinc-150 text-zinc-400 flex items-center justify-center shrink-0">
                                    <User size={18} />
                                  </div>
                                )}
                                <div className="text-left leading-tight">
                                  <h4 className="text-sm font-black text-zinc-950">{rep.userName || 'Usuario Anónimo'}</h4>
                                  <p className="text-[10px] font-bold text-zinc-400">{reporterUser?.email || 'Sin Correo Asociado'}</p>
                                  {reporterUser?.phoneNumber && (
                                    <p className="text-[10px] font-black text-nic-blue mt-0.5">{reporterUser.phoneNumber}</p>
                                  )}
                                </div>
                              </div>

                              {/* Toggle Report state buttons */}
                              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                                {rep.status === 'resolved' ? (
                                  <button 
                                    onClick={() => updateReportStatus(rep.id, 'pending')}
                                    className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-amber-100 transition-all font-sans"
                                  >
                                    Reabrir Ticket
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => updateReportStatus(rep.id, 'resolved')}
                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-all flex items-center gap-1 font-sans"
                                  >
                                    <CheckCircle size={11} className="shrink-0" /> Marcar Resuelto
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    deleteItem('reports', rep.id);
                                    setSelectedReportId(null);
                                  }}
                                  className="p-1 px-2.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 font-sans"
                                  title="Eliminar Reporte de la Base de Datos"
                                >
                                  <Trash2 size={11} className="shrink-0" /> Eliminar
                                </button>
                              </div>
                            </div>

                            {/* Main incident specifications container */}
                            <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl text-left mt-4 text-xs font-semibold text-zinc-600 space-y-2">
                              <p className="text-[10px] font-bold uppercase text-zinc-450">Descripción del Caso:</p>
                              <p className="text-sm font-bold text-zinc-900 leading-relaxed italic">
                                "{rep.description}"
                              </p>
                              
                              <div className="grid grid-cols-2 gap-3 pt-2 mt-2 border-t border-zinc-200/50 text-[9.5px] uppercase font-bold text-zinc-400">
                                <div>
                                  <span className="text-zinc-405">Tipo de Alerta:</span>
                                  <span className="block font-black text-zinc-700 mt-0.5">{rep.type === 'stop' ? 'Infraestructura / Parada' : rep.type === 'driver' ? 'Conducción / Personal' : 'Unidad de Ruta'}</span>
                                </div>
                                {rep.driverId && (
                                  <div>
                                    <span className="text-zinc-405">ID Conductor:</span>
                                    <span className="block font-black text-zinc-700 mt-0.5 font-mono">{rep.driverId}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Chat interactive messages stream */}
                          <div className="border border-zinc-150 rounded-2xl p-4 bg-zinc-50/30 flex-1 my-4 flex flex-col justify-between">
                            <p className="text-[10px] text-zinc-400 uppercase font-black text-left pb-1 border-b border-zinc-150/50">
                              Historial de Interacción en Tiempo Real
                            </p>

                            <div className="space-y-3.5 overflow-y-auto max-h-[220px] pr-1 py-3 flex flex-col flex-1">
                              
                              {/* Legacy Admin reply displays at top */}
                              {(!rep.messages || rep.messages.length === 0) && rep.adminResponse && (
                                <div className="flex gap-2 max-w-[85%] ml-auto flex-row-reverse text-right">
                                  <div className="w-6 h-6 rounded-full bg-nic-blue text-white flex items-center justify-center shrink-0 text-[10px] font-black">AD</div>
                                  <div className="bg-nic-blue text-white px-3.5 py-2.5 rounded-2xl border border-blue-600 shadow-sm text-left">
                                    <p className="text-[9px] font-black uppercase text-blue-100 leading-none">Administrador (Mío)</p>
                                    <p className="text-[11.5px] font-medium mt-1">"{rep.adminResponse}"</p>
                                  </div>
                                </div>
                              )}

                              {rep.messages?.map((msg) => {
                                const isAdmin = msg.senderId === 'admin';
                                return (
                                  <div key={msg.id} className={cn(
                                    "flex gap-2.5 max-w-[85%] text-left",
                                    isAdmin ? "ml-auto flex-row-reverse" : "self-start"
                                  )}>
                                    <div className={cn(
                                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black",
                                      isAdmin ? "bg-nic-blue text-white" : "bg-zinc-200 text-zinc-700"
                                    )}>
                                      {isAdmin ? 'AD' : 'US'}
                                    </div>
                                    <div className={cn(
                                      "px-3.5 py-2.5 rounded-2xl shadow-sm border",
                                      isAdmin 
                                        ? "bg-zinc-900 border-zinc-950 text-white" 
                                        : "bg-white border-zinc-155"
                                    )}>
                                      <p className={cn(
                                        "text-[9px] font-black uppercase leading-none",
                                        isAdmin ? "text-zinc-400" : "text-nic-blue"
                                      )}>
                                        {msg.senderName}
                                      </p>
                                      <p className="text-[11.5px] font-medium mt-1 leading-snug">{msg.text}</p>
                                      <p className={cn(
                                        "text-[7.5px] font-mono mt-1 text-right",
                                        isAdmin ? "text-zinc-500" : "text-zinc-400"
                                      )}>
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}

                              {(!rep.messages || rep.messages.length === 0) && !rep.adminResponse && (
                                <div className="text-center py-10 text-zinc-400 text-xs font-medium italic flex-1 flex flex-col items-center justify-center gap-1.5 font-sans">
                                  <MessageSquare size={22} className="text-zinc-300" />
                                  <span>Sin mensajes en este reporte. ¡Escríbele una respuesta inicial abajo!</span>
                                </div>
                              )}
                            </div>

                            {/* Message input area */}
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                sendReportChat(rep.id);
                              }}
                              className="flex gap-2.5 pt-3 border-t border-zinc-155"
                            >
                              <input 
                                type="text"
                                placeholder="Escribe al pasajero..."
                                value={adminChatText[rep.id] || ''}
                                onChange={(e) => setAdminChatText({ ...adminChatText, [rep.id]: e.target.value })}
                                className="flex-1 px-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-nic-blue/20 outline-none transition-all"
                              />
                              <button 
                                type="submit"
                                className="px-4 py-2.5 bg-nic-blue text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-600 transition-all cursor-pointer"
                              >
                                Responder
                              </button>
                            </form>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-450 py-16">
                        <div className="w-16 h-16 bg-zinc-50 border border-zinc-100 text-zinc-350 rounded-3xl flex items-center justify-center mb-4">
                          <MessageSquare size={28} />
                        </div>
                        <h4 className="text-sm font-extrabold text-zinc-700">Consola de Respuestas de Reportes</h4>
                        <p className="text-[11.5px] text-zinc-400 mt-1 max-w-sm leading-relaxed">
                          Selecciona cualquier reporte de la lista de la izquierda para ver su geolocalización, detalles completos, y chatear directamente en vivo con el usuario pasajero.
                        </p>
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            )}

            {activeSection === 'progress' && (
              <motion.div 
                key="progress"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Header Information */}
                <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-800 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-nic-blue rounded-full blur-[100px] opacity-25 pointer-events-none animate-pulse" />
                  <div>
                    <span className="text-xs font-black tracking-widest uppercase text-nic-blue bg-blue-500/15 px-3.5 py-1.5 rounded-full">
                      Panel de Monitoreo Exclusivo
                    </span>
                    <h2 className="text-2xl font-black tracking-tight mt-3.5 flex items-center gap-2">
                      <Activity size={26} className="text-emerald-400" /> Monitoreo de Rutas en Movimiento
                    </h2>
                    <p className="text-sm font-medium text-zinc-300 mt-2 max-w-xl leading-relaxed">
                      Control táctico e interactivo de unidades en tiempo real. Este panel valida la actividad basándose en la asignación de choferes y la conectividad activa de sus dispositivos portátiles.
                    </p>
                  </div>
                  
                  {/* Summary Indicators */}
                  <div className="flex gap-4 self-start lg:self-center shrink-0">
                    <div className="bg-white/5 border border-white/10 p-5 rounded-3xl text-center min-w-[120px] backdrop-blur-sm">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">Total Flotas</p>
                      <p className="text-3xl font-black mt-1 text-white">{routes.length}</p>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl text-center min-w-[120px] backdrop-blur-sm">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Activas Hoy</p>
                      <p className="text-3xl font-black mt-1 text-emerald-400">
                        {routes.filter(r => {
                          if (!r.driverId) return false;
                          const dev = driverDevices[r.driverId];
                          return dev && dev.gpsActive && dev.internetConnected;
                        }).length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Telemetry Instruction Container */}
                <div className="bg-zinc-50 border border-zinc-200/50 p-6 rounded-[2rem] flex flex-col sm:flex-row items-start gap-4">
                  <div className="w-12 h-12 bg-nic-blue/10 text-nic-blue rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                    <Settings size={22} className="text-nic-blue" />
                  </div>
                  <div className="text-xs font-semibold text-zinc-600 leading-relaxed">
                    <p className="font-black text-zinc-950 text-sm">Instrucciones de Validación Táctica</p>
                    <p className="mt-1">
                      El sistema define un enlace constante con el dispositivo móvil de cada conductor. Para simular el comportamiento de conectividad, puedes alternar las propiedades de <strong>GPS SATÉLITE</strong> y de <strong>INTERNET MÓVIL</strong>. Si se desactiva alguna opción, la ruta correspondiente dejará instantáneamente de considerarse una <span className="text-emerald-600 font-extrabold font-mono">"Ruta Activa"</span>.
                    </p>
                  </div>
                </div>

                {/* Live Real-time Route Progress & GPS map tracker */}
                <ProgressMapView 
                  routes={routes} 
                  stops={stops} 
                  routeStops={routeStops} 
                  drivers={drivers} 
                  driverDevices={driverDevices} 
                  setDriverDevices={setDriverDevices}
                />


              </motion.div>
            )}

            {activeSection === 'drivers' && (
              <motion.div 
                key="drivers"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="bg-white p-10 rounded-[2.5rem] border border-zinc-100 shadow-sm">
                  <h3 className="text-xl font-bold text-zinc-900 mb-8 flex items-center gap-3">
                    <Users size={20} className="text-purple-500" />
                    Registro de Personal (Choferes)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Nombre Completo</label>
                        <input 
                          type="text" placeholder="Ej: Juan Pérez" value={newDriver.name}
                          onChange={e => setNewDriver({...newDriver, name: e.target.value})}
                          className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500 outline-none transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Experiencia Laboral</label>
                        <textarea 
                          placeholder="Ej: 10 años en Cooperativa Parrales Vallejos..." value={newDriver.experience}
                          onChange={e => setNewDriver({...newDriver, experience: e.target.value})}
                          className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500 outline-none transition-all font-medium h-24 resize-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Foto del Chofer</label>
                        <div className="relative group">
                          <input 
                            type="file" accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = await handleFileUpload(file, 'drivers');
                                setNewDriver({...newDriver, photoUrl: url});
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          />
                          <div className={cn(
                            "w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs flex items-center gap-2",
                            uploading?.includes('drivers') ? "animate-pulse" : ""
                          )}>
                            {newDriver.photoUrl ? <CheckCircle size={14} className="text-emerald-500" /> : <Camera size={14} />}
                            <span className="truncate">{newDriver.photoUrl ? 'Listo' : 'Foto'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Foto Licencia</label>
                        <div className="relative group">
                          <input 
                            type="file" accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = await handleFileUpload(file, 'license');
                                setNewDriver({...newDriver, licensePhotoUrl: url});
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          />
                          <div className={cn(
                            "w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs flex items-center gap-2",
                            uploading?.includes('license') ? "animate-pulse" : ""
                          )}>
                            {newDriver.licensePhotoUrl ? <CheckCircle size={14} className="text-emerald-500" /> : <Camera size={14} />}
                            <span className="truncate">{newDriver.licensePhotoUrl ? 'Listo' : 'Licencia'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Foto Cédula</label>
                        <div className="relative group">
                          <input 
                            type="file" accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = await handleFileUpload(file, 'ids');
                                setNewDriver({...newDriver, idCardPhotoUrl: url});
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          />
                          <div className={cn(
                            "w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs flex items-center gap-2",
                            uploading?.includes('ids') ? "animate-pulse" : ""
                          )}>
                            {newDriver.idCardPhotoUrl ? <CheckCircle size={14} className="text-emerald-500" /> : <Camera size={14} />}
                            <span className="truncate">{newDriver.idCardPhotoUrl ? 'Listo' : 'Cédula'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Número de Celular</label>
                        <input 
                          type="tel" placeholder="Ej: +505 8888-8888" value={newDriver.phoneNumber}
                          onChange={e => setNewDriver({...newDriver, phoneNumber: e.target.value})}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500 outline-none transition-all font-medium"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end">
                    <button onClick={addDriver} className="px-10 py-4 bg-purple-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-purple-600 transition-all shadow-xl shadow-purple-500/20">
                      Registrar Chofer
                    </button>
                  </div>
                </div>

                {/* Localized Inline Search Box for Drivers */}
                <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-sans" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar chofer por nombre o teléfono..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-semibold text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-purple-500/40 focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                  <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => setDriverViewMode(driverViewMode === 'all' ? 'hidden' : 'all')}
                      className={cn(
                        "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border active:scale-95 cursor-pointer flex items-center gap-1.5",
                        driverViewMode === 'all' ? "bg-zinc-900 text-white border-transparent" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                      )}
                    >
                      <Eye size={12} />
                      {driverViewMode === 'all' ? 'Ocultar todo' : 'Ver todos'}
                    </button>
                    <button
                      onClick={() => setDriverViewMode(driverViewMode === 'alphabetical' ? 'hidden' : 'alphabetical')}
                      className={cn(
                        "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border active:scale-95 cursor-pointer flex items-center gap-1.5",
                        driverViewMode === 'alphabetical' ? "bg-zinc-900 text-white border-transparent" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                      )}
                    >
                      <SortAsc size={12} />
                      A-Z
                    </button>
                  </div>
                </div>

                {/* Active Mode indicator pill */}
                {(driverViewMode !== 'hidden' || searchQuery.trim() !== '') && (
                  <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200/50 px-4 py-2.5 rounded-xl animate-fadeIn">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-650 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-nic-blue animate-pulse" />
                      {searchQuery.trim() !== '' ? 'Resultados de Búsqueda' : driverViewMode === 'alphabetical' ? 'Orden: Alfabético A-Z' : 'Lista: Todos los Choferes'}
                    </span>
                    <button
                      onClick={() => {
                        setDriverViewMode('hidden');
                        setSearchQuery('');
                      }}
                      className="text-[9px] font-black uppercase text-rose-500 hover:text-rose-600 tracking-widest flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      ✕ Limpiar Vista
                    </button>
                  </div>
                )}

                {driverViewMode === 'hidden' && searchQuery.trim() === '' ? (
                  <div className="py-12 px-4 text-center space-y-6 animate-fadeIn bg-zinc-50/50 rounded-3xl border border-dashed border-zinc-200/80">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                      <Users size={24} />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Módulo Organizado de Choferes</h4>
                      <p className="text-[10px] text-zinc-500 max-w-[280px] mx-auto leading-relaxed">
                        Para mantener la interfaz profesional, el listado directo de choferes está oculto. Use el buscador superior o escoja una opción para visualizar.
                      </p>
                    </div>
                    
                    <div className="pt-2 flex flex-col sm:flex-row gap-2 max-w-[340px] mx-auto justify-center">
                      <button
                        onClick={() => {
                          setDriverViewMode('all');
                        }}
                        className="w-full sm:w-auto px-4 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Eye size={12} />
                        Mostrar todos los choferes
                      </button>
                      
                      <button
                        onClick={() => {
                          setDriverViewMode('alphabetical');
                        }}
                        className="w-full sm:w-auto px-4 py-3 bg-white hover:bg-zinc-50 border border-zinc-250 text-zinc-900 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <SortAsc size={12} />
                        Mostrar por orden A-Z
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(() => {
                      const filtered = drivers.filter(d => 
                        d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (d.phoneNumber && d.phoneNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (d.generalInfo && d.generalInfo.toLowerCase().includes(searchQuery.toLowerCase()))
                      );

                      if (driverViewMode === 'alphabetical' || searchQuery.trim() !== '') {
                        filtered.sort((a, b) => a.name.localeCompare(b.name));
                      }

                      if (filtered.length === 0) {
                        return (
                          <div className="col-span-full text-center py-12 text-zinc-400">
                            <Users className="mx-auto text-zinc-200 mb-3" size={40} />
                            <p className="text-xs font-bold uppercase tracking-wider">No se encontraron choferes</p>
                          </div>
                        );
                      }

                      return filtered.map(d => (
                        <div key={d.id} className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm hover:shadow-xl transition-all group animate-fadeIn">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-50 border border-zinc-100 shrink-0">
                              {d.photoUrl && !failedImages[d.photoUrl] ? (
                                <img 
                                  src={d.photoUrl} 
                                  alt="" 
                                  className="w-full h-full object-cover" 
                                  referrerPolicy="no-referrer" 
                                  onError={() => setFailedImages(prev => ({ ...prev, [d.photoUrl]: true }))}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-300 bg-zinc-50"><User size={24} /></div>
                              )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <h4 className="text-lg font-black text-zinc-900 truncate">{d.name}</h4>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                ID: {d.id.slice(0, 8)} • {d.phoneNumber}
                              </p>
                            </div>
                            <button onClick={() => deleteItem('drivers', d.id)} className="p-2 text-zinc-300 hover:text-nic-red hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                              <Trash2 size={18} />
                            </button>
                          </div>
                          <div className="mt-4 pt-4 border-t border-zinc-50">
                            <p className="text-xs text-zinc-500 line-clamp-2 italic">"{d.generalInfo || 'Sin información adicional'}"</p>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </motion.div>
            )}

            {activeSection === 'connections' && (
              <motion.div 
                key="connections"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="bg-white p-10 rounded-[2.5rem] border border-zinc-100 shadow-sm">
                  <h3 className="text-xl font-bold text-zinc-900 mb-8 flex items-center gap-3">
                    <List size={20} className="text-nic-blue" />
                    Planificación de Trayectos y Horarios
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Seleccionar Ruta</label>
                      <select 
                        value={newMapping.routeId}
                        onChange={e => setNewMapping({...newMapping, routeId: e.target.value})}
                        className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-4 focus:ring-nic-blue/5 focus:border-nic-blue outline-none transition-all font-medium appearance-none"
                      >
                        <option value="">-- Elige una ruta --</option>
                        {routes.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Seleccionar Bahía</label>
                      <select 
                        value={newMapping.stopId}
                        onChange={e => setNewMapping({...newMapping, stopId: e.target.value})}
                        className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-4 focus:ring-nic-blue/5 focus:border-nic-blue outline-none transition-all font-medium appearance-none"
                      >
                        <option value="">-- Elige una bahía --</option>
                        {stops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Hora Llegada</label>
                      <input 
                        type="time" value={newMapping.arrivalTime}
                        onChange={e => setNewMapping({...newMapping, arrivalTime: e.target.value})}
                        className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-4 focus:ring-nic-blue/5 focus:border-nic-blue outline-none transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Hora Salida</label>
                      <input 
                        type="time" value={newMapping.departureTime}
                        onChange={e => setNewMapping({...newMapping, departureTime: e.target.value})}
                        className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-4 focus:ring-nic-blue/5 focus:border-nic-blue outline-none transition-all font-medium"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                      <CheckCircle size={14} />
                      Explicación del Orden de Secuencia
                    </p>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      El **Orden de Secuencia** es la posición numérica que ocupa una bahía dentro del trayecto de la ruta. Por ejemplo, la primera parada es Orden 1, la segunda Orden 2, y así sucesivamente. 
                      El sistema utiliza este orden y las horas de llegada/salida para validar que no existan colisiones (mismo bus o buses distintos en la misma bahía al mismo tiempo, con un margen de seguridad de 5 minutos).
                    </p>
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Orden de Secuencia:</label>
                      <input 
                        type="number" value={newMapping.sequence}
                        onChange={e => setNewMapping({...newMapping, sequence: parseInt(e.target.value)})}
                        className="w-20 px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-sm font-bold text-zinc-900"
                      />
                    </div>
                    <button onClick={addMapping} className="px-10 py-4 bg-nic-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20">
                      Vincular y Programar
                    </button>
                  </div>
                </div>

                {/* Visual Optimization: Local Itinerary Filter and Controls */}
                <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-sans" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar itinerario por nombre o placa..." 
                      value={itinerarySearchQuery}
                      onChange={(e) => setItinerarySearchQuery(e.target.value)}
                      className="w-full pl-11 pr-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-semibold text-zinc-805 placeholder-zinc-400 focus:outline-none focus:border-nic-blue/40 focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                  <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const allExp: Record<string, boolean> = {};
                        routes.forEach(r => { allExp[r.id] = true; });
                        setExpandedRoutes(allExp);
                      }}
                      className="px-4 py-2.5 rounded-xl text-[10px] bg-zinc-900 text-white font-black uppercase tracking-widest transition-all hover:bg-zinc-800 active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <ChevronDown size={12} />
                      Expandir Todo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedRoutes({});
                      }}
                      className="px-4 py-2.5 rounded-xl text-[10px] bg-white text-zinc-700 border border-zinc-200 font-black uppercase tracking-widest transition-all hover:bg-zinc-50 active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <ChevronUp size={12} />
                      Colapsar Todo
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {routes.filter(route => {
                    const queryStr = itinerarySearchQuery.trim() !== '' ? itinerarySearchQuery : searchQuery;
                    return route.name.toLowerCase().includes(queryStr.toLowerCase()) || 
                           route.code.toLowerCase().includes(queryStr.toLowerCase());
                  }).map(route => {
                    const mappings = routeStops.filter(m => m.routeId === route.id).sort((a, b) => a.sequence - b.sequence);
                    if (mappings.length === 0) return null;
                    const isExpanded = !!expandedRoutes[route.id];

                    return (
                      <div key={route.id} className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-sm relative overflow-hidden group transition-all duration-350">
                        {/* Interactive Header Wrapper to expand/collapse */}
                        <div 
                          onClick={() => setExpandedRoutes(prev => ({ ...prev, [route.id]: !prev[route.id] }))}
                          className="p-8 pb-6 flex items-center justify-between cursor-pointer select-none hover:bg-zinc-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-nic-blue/10 text-nic-blue rounded-xl flex items-center justify-center font-black text-lg">
                              {route.code}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xl font-black text-zinc-900">{route.name}</h4>
                                <span className={`p-1 px-2.5 rounded-full text-[8px] font-black uppercase tracking-widest ${isExpanded ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-550"}`}>
                                  {isExpanded ? 'Desplegado' : 'Plegado'}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                Itinerario de Ruta 
                                <span className="text-zinc-300">•</span> 
                                <span className="text-nic-blue">Haz clic para {isExpanded ? 'colapsar' : 'desplegar'}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                               <p className="text-xs font-black text-zinc-300 uppercase tracking-[0.2em]">Total Bahías</p>
                               <p className="text-2xl font-black text-zinc-900">{mappings.length}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-nic-blue/10 group-hover:text-nic-blue transition-colors">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </div>
                        </div>

                        {/* Collapsible content container */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden border-t border-zinc-100 bg-zinc-50/20"
                            >
                              <div className="p-8 pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                  {mappings.map((m, idx) => {
                                    const stop = stops.find(s => s.id === m.stopId);
                                    return (
                                      <div key={m.id} className="p-5 bg-white rounded-3xl border border-zinc-100 hover:border-nic-blue/20 transition-all group/item relative shadow-sm">
                                        <span className="absolute -top-2 -left-2 w-8 h-8 bg-zinc-100 border border-zinc-200 rounded-full flex items-center justify-center text-[10px] font-black text-nic-blue shadow-sm">
                                          {m.sequence}
                                        </span>
                                        <div className="mb-4 pt-2">
                                          <p className="text-xs font-black text-zinc-900 truncate">{stop?.name || 'Bahía Desconocida'}</p>
                                          <p className="text-[9px] text-zinc-450 truncate uppercase font-bold tracking-tight">{stop?.generalInfo}</p>
                                        </div>
                                        <div className="flex items-center justify-between bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                                          <div>
                                            <p className="text-[8px] font-black text-zinc-300 uppercase">Llega</p>
                                            <p className="text-xs font-black text-zinc-900">{m.arrivalTime}</p>
                                          </div>
                                          <ChevronRight size={14} className="text-zinc-200" />
                                          <div className="text-right">
                                            <p className="text-[8px] font-black text-zinc-300 uppercase">Sale</p>
                                            <p className="text-xs font-black text-zinc-400">{m.departureTime}</p>
                                          </div>
                                        </div>
                                        <button 
                                          type="button"
                                          onClick={() => deleteItem('routeStops', m.id)}
                                          className="absolute top-4 right-4 p-2 text-zinc-200 hover:text-nic-red opacity-0 group-hover/item:opacity-100 transition-all"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {activeSection === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 animate-fadeIn"
              >
                {/* Header Container */}
                <div className="bg-white p-10 rounded-[2.5rem] border border-zinc-100 shadow-sm relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-nic-blue/5 rounded-full blur-[80px]" />
                  <div className="relative z-10">
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                      <Users className="text-nic-blue" size={32} />
                      Módulo de Usuarios
                    </h2>
                    <p className="text-sm font-medium text-zinc-500 mt-2 max-w-xl leading-relaxed">
                      Gestión centralizada de pasajeros y personal administrador. Consulta perfiles, edita detalles de contacto, crea nuevos accesos e inspecciona su historial de reportes.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsAddingPassenger(true);
                      setEditingPassengerId(null);
                      setNewPassenger({ name: '', email: '', phoneNumber: '', role: 'passenger', photoUrl: '' });
                      setSelectedUserId(null);
                    }}
                    className="px-6 py-4 bg-nic-blue hover:bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20 shrink-0 flex items-center gap-2 active:scale-95 cursor-pointer relative z-10"
                  >
                    <Plus size={16} />
                    Agregar Usuario
                  </button>
                </div>

                {/* Main Double-Pane Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Left Column: Alphabetical List of Users or Clean Panel */}
                  <div className="lg:col-span-5 bg-white p-6 rounded-[2.5rem] border border-zinc-100 shadow-sm flex flex-col gap-6">
                    <div className="flex flex-col gap-4">
                      <div className="relative w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input 
                          type="text" 
                          placeholder="Buscar por nombre o correo..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-11 pr-5 py-3.5 bg-zinc-50 border border-zinc-201 rounded-2xl text-xs font-semibold text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-nic-blue/40 focus:bg-white transition-all shadow-inner"
                        />
                      </div>
                      <div className="flex gap-2 w-full justify-end">
                        <button
                          onClick={() => setUserViewMode(userViewMode === 'all' ? 'hidden' : 'all')}
                          className={cn(
                            "flex-1 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border active:scale-95 cursor-pointer flex items-center justify-center gap-1.5",
                            userViewMode === 'all' ? "bg-zinc-900 text-white border-transparent" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                          )}
                        >
                          <Eye size={12} />
                          {userViewMode === 'all' ? 'Ocultar' : 'Ver todos'}
                        </button>
                        <button
                          onClick={() => setUserViewMode(userViewMode === 'alphabetical' ? 'hidden' : 'alphabetical')}
                          className={cn(
                            "flex-1 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border active:scale-95 cursor-pointer flex items-center justify-center gap-1.5",
                            userViewMode === 'alphabetical' ? "bg-zinc-900 text-white border-transparent" : "bg-white text-zinc-700 border-zinc-250 hover:bg-zinc-50"
                          )}
                        >
                          <SortAsc size={12} />
                          A-Z
                        </button>
                      </div>
                    </div>

                    {/* Active Mode indicator pill */}
                    {(userViewMode !== 'hidden' || searchQuery.trim() !== '') && (
                      <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200/50 px-4 py-2.5 rounded-xl animate-fadeIn">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-nic-blue animate-pulse" />
                          {searchQuery.trim() !== '' ? 'Resultados de Búsqueda' : userViewMode === 'alphabetical' ? 'Orden: Alfabético A-Z' : 'Lista: Todos los Usuarios'}
                        </span>
                        <button
                          onClick={() => {
                            setUserViewMode('hidden');
                            setSearchQuery('');
                          }}
                          className="text-[9px] font-black uppercase text-rose-500 hover:text-rose-600 tracking-widest flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          ✕ Limpiar Vista
                        </button>
                      </div>
                    )}

                    {userViewMode === 'hidden' && searchQuery.trim() === '' ? (
                      <div className="py-12 px-4 text-center space-y-6 animate-fadeIn bg-zinc-50/50 rounded-3xl border border-dashed border-zinc-200/80">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                          <Users size={24} />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Módulo Organizado</h4>
                          <p className="text-[10px] text-zinc-500 max-w-[240px] mx-auto leading-relaxed">
                            Para mantener la interfaz profesional, el listado directo está oculto. Use el buscador o escoja una opción para visualizar.
                          </p>
                        </div>
                        
                        <div className="pt-2 flex flex-col gap-2 max-w-[240px] mx-auto">
                          <button
                            onClick={() => setUserViewMode('all')}
                            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                          >
                            <Eye size={12} />
                            Mostrar todos los usuarios
                          </button>
                          
                          <button
                            onClick={() => setUserViewMode('alphabetical')}
                            className="w-full py-3 bg-white hover:bg-zinc-50 border border-zinc-250 text-zinc-900 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                          >
                            <SortAsc size={12} />
                            Mostrar por orden A-Z
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {(() => {
                          const filtered = usersList
                            .filter(u => 
                              u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              u.email.toLowerCase().includes(searchQuery.toLowerCase())
                            );

                          if (userViewMode === 'alphabetical' || searchQuery.trim() !== '') {
                            filtered.sort((a, b) => a.name.localeCompare(b.name));
                          }

                          if (filtered.length === 0) {
                            return (
                              <div className="text-center py-12 text-zinc-400">
                                <Users className="mx-auto text-zinc-200 mb-3" size={40} />
                                <p className="text-xs font-bold uppercase tracking-wider">No se encontraron usuarios</p>
                                <p className="text-[10px] text-zinc-400 mt-1">Prueba con otro término de búsqueda</p>
                              </div>
                            );
                          }

                          return filtered.map((u) => {
                            const isSelected = selectedUserId === u.id;
                            const userReports = reports.filter(r => r.userId === u.id || r.userId === u.email);
                            
                            return (
                              <div
                                key={u.id}
                                onClick={() => {
                                  setSelectedUserId(u.id);
                                  setIsAddingPassenger(false);
                                  setEditingPassengerId(null);
                                }}
                                className={cn(
                                  "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group active:scale-[0.99]",
                                  isSelected 
                                    ? "bg-zinc-900 border-zinc-900 text-white shadow-xl" 
                                    : "bg-zinc-50/50 hover:bg-zinc-100/50 border-zinc-100 text-zinc-900"
                                )}
                              >
                                <div className="w-11 h-11 rounded-xl bg-orange-100 shrink-0 overflow-hidden border border-white shadow-sm flex items-center justify-center">
                                  {u.photoUrl && !failedImages[u.photoUrl] ? (
                                    <img 
                                      src={u.photoUrl} 
                                      alt={u.name} 
                                      referrerPolicy="no-referrer" 
                                      className="w-full h-full object-cover"
                                      onError={() => setFailedImages(prev => ({ ...prev, [u.photoUrl]: true }))}
                                    />
                                  ) : (
                                    <span className={cn(
                                      "font-black text-sm",
                                      isSelected ? "text-zinc-900 animate-pulse" : "text-orange-600"
                                    )}>
                                      {u.name.slice(0, 2).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className={cn("text-xs font-black truncate", isSelected ? "text-white" : "text-zinc-900")}>
                                    {u.name}
                                  </h4>
                                  <p className={cn("text-[10px] truncate leading-tight mt-0.5", isSelected ? "text-zinc-400" : "text-zinc-400 font-medium")}>
                                    {u.email}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className={cn(
                                    "text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-full",
                                    u.role === 'admin' 
                                      ? "bg-rose-500/10 text-rose-500" 
                                      : "bg-blue-500/10 text-blue-500"
                                  )}>
                                    {u.role === 'admin' ? 'Admin' : 'Pasajero'}
                                  </span>
                                  {userReports.length > 0 && (
                                    <span className="block text-[8px] text-zinc-400 font-extrabold mt-1.5 uppercase tracking-tighter">
                                      ⚠️ {userReports.length} {userReports.length === 1 ? 'Reporte' : 'Reportes'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Right Column: User Detail or Create/Edit Form */}
                  <div className="lg:col-span-7">
                    {/* Add/Edit Form */}
                    {(isAddingPassenger || editingPassengerId) ? (
                      <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm animate-fadeIn">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-100">
                          <h3 className="text-xl font-black text-zinc-900">
                            {editingPassengerId ? '✏️ Editar Usuario' : '👤 Registrar Nuevo Usuario'}
                          </h3>
                          <button 
                            onClick={() => {
                              setIsAddingPassenger(false);
                              setEditingPassengerId(null);
                              setNewPassenger({ name: '', email: '', phoneNumber: '', role: 'passenger', photoUrl: '' });
                            }}
                            className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-600 font-bold tracking-wide"
                          >
                            ✕
                          </button>
                        </div>

                        <form onSubmit={handleSavePassenger} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-2">Nombre Completo</label>
                              <input 
                                type="text" 
                                required
                                value={newPassenger.name}
                                onChange={(e) => setNewPassenger({ ...newPassenger, name: e.target.value })}
                                placeholder="Ej. Ana María Rojas"
                                className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-semibold text-zinc-800 placeholder-zinc-350 focus:outline-none focus:border-nic-blue/40 focus:bg-white transition-all shadow-inner"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-2">Correo Electrónico</label>
                              <input 
                                type="email" 
                                required
                                value={newPassenger.email}
                                onChange={(e) => setNewPassenger({ ...newPassenger, email: e.target.value })}
                                placeholder="Ej. ana.rojas@correo.com"
                                className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-semibold text-zinc-800 placeholder-zinc-350 focus:outline-none focus:border-nic-blue/40 focus:bg-white transition-all shadow-inner"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-2">Teléfono (+505)</label>
                              <input 
                                type="text" 
                                value={newPassenger.phoneNumber}
                                onChange={(e) => setNewPassenger({ ...newPassenger, phoneNumber: e.target.value })}
                                placeholder="Ej. +505 8899-0011"
                                className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-semibold text-zinc-800 placeholder-zinc-350 focus:outline-none focus:border-nic-blue/40 focus:bg-white transition-all shadow-inner"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-2">Rol del Usuario</label>
                              <select 
                                value={newPassenger.role}
                                onChange={(e) => setNewPassenger({ ...newPassenger, role: e.target.value as 'passenger' | 'admin' })}
                                className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-semibold text-zinc-800 focus:outline-none focus:border-nic-blue/40 focus:bg-white transition-all shadow-inner"
                              >
                                <option value="passenger">Pasajero (Turista / Local)</option>
                                <option value="admin">Administrador del Sistema</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-2">
                                Foto de Perfil (Subir o URL)
                              </label>
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                                {/* Visual Upload Box / Area */}
                                <div className="md:col-span-3">
                                  <div className="relative group">
                                    <input 
                                      type="file" 
                                      accept="image/*"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          try {
                                            const url = await handleFileUpload(file, 'passengers');
                                            setNewPassenger(prev => ({ ...prev, photoUrl: url }));
                                          } catch (err) {
                                            alert('Error al subir la imagen. Inténtelo de nuevo.');
                                          }
                                        }
                                      }}
                                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    />
                                    <div className={cn(
                                      "w-full px-6 py-5 bg-zinc-50 border border-dashed border-zinc-300 hover:border-nic-blue/40 rounded-2xl text-xs flex flex-col items-center justify-center gap-2 transition-all cursor-pointer text-center",
                                      uploading === 'passengers' ? "animate-pulse border-nic-blue bg-zinc-100/50" : "group-hover:bg-zinc-150/10"
                                    )}>
                                      <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 group-hover:text-nic-blue transition-colors">
                                        <Camera size={16} />
                                      </div>
                                      <div>
                                        <p className="font-bold text-zinc-700">
                                          {uploading === 'passengers' ? 'Subiendo archivo...' : 'Seleccionar o arrastrar foto'}
                                        </p>
                                        <p className="text-[10px] text-zinc-400 mt-0.5">Dispositivo / Almacenamiento local</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Text Field Input / URL Manual */}
                                <div className="md:col-span-2 flex flex-col gap-2">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full border border-zinc-200 bg-zinc-50 flex-shrink-0 overflow-hidden flex items-center justify-center relative shadow-sm">
                                      {newPassenger.photoUrl ? (
                                        <img 
                                          src={newPassenger.photoUrl} 
                                          alt="Preview" 
                                          referrerPolicy="no-referrer"
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1554224155-1696413565d3?auto=format&fit=crop&q=80&w=200';
                                          }}
                                        />
                                      ) : (
                                        <User size={20} className="text-zinc-400" />
                                      )}
                                      {newPassenger.photoUrl && (
                                        <button
                                          type="button"
                                          onClick={() => setNewPassenger(prev => ({ ...prev, photoUrl: '' }))}
                                          className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                                          title="Eliminar foto"
                                        >
                                          <X size={14} className="font-extrabold" />
                                        </button>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Previsualización</p>
                                      <p className="text-[11px] text-zinc-500 truncate">
                                        {newPassenger.photoUrl ? 'Foto asignada correctamente' : 'Sin foto cargada'}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <input 
                                    type="url" 
                                    value={newPassenger.photoUrl}
                                    onChange={(e) => setNewPassenger(prev => ({ ...prev, photoUrl: e.target.value }))}
                                    placeholder="O pegue una dirección URL..."
                                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-[11px] font-semibold text-zinc-700 placeholder-zinc-350 focus:outline-none focus:border-nic-blue/40 focus:bg-white transition-all shadow-inner"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 flex gap-4">
                            <button 
                              type="button"
                              onClick={() => {
                                setIsAddingPassenger(false);
                                setEditingPassengerId(null);
                                setNewPassenger({ name: '', email: '', phoneNumber: '', role: 'passenger', photoUrl: '' });
                              }}
                              className="flex-1 py-4 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button 
                              type="submit"
                              className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 cursor-pointer"
                            >
                              {editingPassengerId ? 'Guardar Cambios' : 'Registrar Usuario'}
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : selectedUserId ? (
                      (() => {
                        const sUser = usersList.find(u => u.id === selectedUserId);
                        if (!sUser) return null;
                        
                        const sUserReports = reports.filter(r => r.userId === sUser.id || r.userId === sUser.email);
                        
                        return (
                          <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm animate-fadeIn space-y-8">
                            {/* Profile Header Block */}
                            <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-zinc-100">
                              <div className="w-24 h-24 rounded-3xl overflow-hidden bg-zinc-100 border-2 border-zinc-100 shadow-md shrink-0 flex items-center justify-center font-black">
                                {sUser.photoUrl && !failedImages[sUser.photoUrl] ? (
                                  <img 
                                    src={sUser.photoUrl} 
                                    alt={sUser.name} 
                                    referrerPolicy="no-referrer" 
                                    className="w-full h-full object-cover" 
                                    onError={() => setFailedImages(prev => ({ ...prev, [sUser.photoUrl]: true }))}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-zinc-100 text-zinc-400 font-bold text-2xl">
                                    {sUser.name.slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 text-center sm:text-left min-w-0">
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                  <h3 className="text-2xl font-black text-zinc-900 tracking-tight truncate max-w-full">{sUser.name}</h3>
                                  <span className={cn(
                                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider",
                                    sUser.role === 'admin' 
                                      ? "bg-rose-500/10 text-rose-500" 
                                      : "bg-blue-500/10 text-blue-500"
                                  )}>
                                    {sUser.role === 'admin' ? 'Administrador' : 'Pasajero'}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-400 font-bold mt-1.5">{sUser.email}</p>
                                <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mt-1.5">
                                  Registrado: {sUser.createdAt ? new Date(sUser.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Fecha no especificada'}
                                </p>
                              </div>
                            </div>

                            {/* Contact Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Celular / Teléfono</span>
                                <span className="text-xs font-extrabold text-zinc-800">{sUser.phoneNumber || 'Sin número registrado'}</span>
                              </div>
                              <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Incidentes Reportados</span>
                                <span className="text-xs font-extrabold text-zinc-800 flex items-center gap-1.5">
                                  {sUserReports.length} {sUserReports.length === 1 ? 'reporte de caso' : 'reportes de casos'}
                                </span>
                              </div>
                            </div>

                            {/* Reports List Linked */}
                            <div>
                              <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-4">Reportes de Incidentes de {sUser.name}</h4>
                              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                {sUserReports.length === 0 ? (
                                  <p className="text-xs text-zinc-400 italic py-4">Este usuario no ha registrado ningún incidente en el sistema.</p>
                                ) : (
                                  sUserReports.map(report => (
                                    <div key={report.id} className="p-4 bg-zinc-50 hover:bg-zinc-100/50 rounded-2xl border border-zinc-100 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black uppercase tracking-tight text-zinc-800">
                                            {report.type === 'driver' ? 'Chofer' : report.type === 'route' ? 'Ruta' : 'Bahía'}
                                          </span>
                                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                                          <span className="text-[9px] font-bold text-zinc-400">
                                            {new Date(report.createdAt).toLocaleDateString()}
                                          </span>
                                        </div>
                                        <p className="text-xs font-black text-zinc-900 mt-1">{report.description}</p>
                                        {report.adminResponse && (
                                          <p className="text-[10px] text-emerald-600 font-bold mt-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg inline-block">
                                            Respuesta: {report.adminResponse}
                                          </p>
                                        )}
                                      </div>
                                      <span className={cn(
                                        "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 self-start sm:self-center",
                                        report.status === 'resolved' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                                      )}>
                                        {report.status === 'resolved' ? 'Resuelto' : 'Pendiente'}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Historial de Búquedas de Rutas */}
                            <div>
                              <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <History size={14} className="text-nic-blue" />
                                Historial de Búsquedas de {sUser.name}
                              </h4>
                              <div className="space-y-3.5 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                {(() => {
                                  const userSearches = searchHistory.filter(h => h.userId === sUser.id || h.userId === sUser.email);
                                  if (userSearches.length === 0) {
                                    return <p className="text-xs text-zinc-400 italic py-4">Este usuario no cuenta con un historial de búsquedas recientes.</p>;
                                  }
                                  return userSearches.map(item => (
                                    <div key={item.id} className="p-4 bg-zinc-50 hover:bg-zinc-100/50 rounded-2xl border border-zinc-100 transition-all flex items-center justify-between gap-4">
                                      <div className="text-left">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-[9px] font-black uppercase tracking-wider text-nic-blue bg-blue-50 px-2.5 py-0.5 rounded-full">
                                            Búsqueda de Ruta
                                          </span>
                                          <span className="text-[9px] text-zinc-400 font-bold">
                                            {item.createdAt ? new Date(item.createdAt).toLocaleString('es-NI') : 'Hace un momento'}
                                          </span>
                                        </div>
                                        <p className="text-xs font-extrabold text-zinc-800">
                                          Origen: <span className="text-zinc-500 font-medium">{item.origin || 'Ubicación actual'}</span>
                                        </p>
                                        <p className="text-xs font-extrabold text-zinc-800 mt-0.5">
                                          Destino: <span className="text-zinc-900 font-extrabold">{item.destination}</span>
                                        </p>
                                      </div>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </div>

                            {/* Actions Group */}
                            <div className="pt-6 border-t border-zinc-100 flex justify-end gap-3.5">
                              <button 
                                onClick={() => deleteItem('users', sUser.id)}
                                className="px-5 py-3 border border-red-200 hover:bg-zinc-50 hover:border-red-305 text-red-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer active:scale-95"
                              >
                                Eliminar Usuario
                              </button>
                              <button 
                                onClick={() => {
                                  setEditingPassengerId(sUser.id);
                                  setNewPassenger({
                                    name: sUser.name,
                                    email: sUser.email,
                                    phoneNumber: sUser.phoneNumber || '',
                                    role: sUser.role,
                                    photoUrl: sUser.photoUrl || ''
                                  });
                                }}
                                className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                              >
                                Editar Informaciones
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="bg-zinc-50 rounded-[2.5rem] border-2 border-dashed border-zinc-200 p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-md rotate-3 flex items-center justify-center text-zinc-400 hover:rotate-0 transition-transform mb-6">
                          <User size={32} />
                        </div>
                        <h4 className="text-base font-black text-zinc-900 tracking-tight">Inspeccionar Perfil de Usuario</h4>
                        <p className="text-xs text-zinc-400 font-medium max-w-sm mt-2 leading-relaxed">
                          Haz clic sobre un usuario registrado en la lista de la izquierda para ver su información en detalle, editar sus campos o gestionar incidentes.
                        </p>
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            )}

            {activeSection === 'touristPosts' && (
              <motion.div 
                key="touristPosts"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 text-left font-sans"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-150">
                  <div>
                    <div className="flex items-center gap-2">
                      <Compass size={24} className="text-nic-blue" />
                      <h3 className="text-2xl font-black text-zinc-900 tracking-tight">Publicaciones & Sitios Turísticos</h3>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 font-medium">
                      Administra las publicaciones promocionales de lugares turísticos, sus fotos, horarios de atención y bahías de destino.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (isAddingTouristPost) {
                        setIsAddingTouristPost(false);
                        setEditingTouristPostId(null);
                      } else {
                        setIsAddingTouristPost(true);
                        setEditingTouristPostId(null);
                        setNewTouristPost({
                          title: '',
                          subtitle: '',
                          description: '',
                          category: 'Puerto & Recreación',
                          coverPhoto: '',
                          galleryPhotosStr: '',
                          schedule: 'Lunes a Domingo: 8:00 AM - 10:00 PM',
                          entryFee: 'Acceso Libre',
                          destinationStopName: stops.length > 0 ? stops[0].name : '',
                          recommendedRoutesStr: ''
                        });
                      }
                    }}
                    className="px-6 py-3.5 bg-nic-blue hover:bg-blue-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-900/10 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <Plus size={16} />
                    {isAddingTouristPost ? 'Cerrar Formulario' : 'Nueva Publicación Turística'}
                  </button>
                </div>

                {/* Form to Create or Edit Tourist Post */}
                <AnimatePresence>
                  {(isAddingTouristPost || editingTouristPostId) && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleSaveTouristPost}
                      className="bg-zinc-50 border border-zinc-200/80 p-6 sm:p-8 rounded-[2rem] space-y-6 shadow-inner"
                    >
                      <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
                        <h4 className="text-sm font-black uppercase tracking-wider text-nic-blue flex items-center gap-2">
                          <Sparkles size={16} />
                          {editingTouristPostId ? 'Editar Publicación Turística' : 'Crear Nueva Publicación Turística'}
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingTouristPost(false);
                            setEditingTouristPostId(null);
                          }}
                          className="p-1.5 hover:bg-zinc-200 rounded-xl text-zinc-500 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Título del Sitio / Atracción *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. Puerto Salvador Allende"
                            value={newTouristPost.title}
                            onChange={(e) => setNewTouristPost({ ...newTouristPost, title: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-nic-blue"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Subtítulo / Frase Corta</label>
                          <input
                            type="text"
                            placeholder="Ej. Malecón & Paseo del Lago Xolotlán"
                            value={newTouristPost.subtitle}
                            onChange={(e) => setNewTouristPost({ ...newTouristPost, subtitle: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-nic-blue"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Categoría</label>
                          <select
                            value={newTouristPost.category}
                            onChange={(e) => setNewTouristPost({ ...newTouristPost, category: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-nic-blue cursor-pointer"
                          >
                            <option value="Puerto & Recreación">Puerto & Recreación</option>
                            <option value="Parque & Mirador">Parque & Mirador</option>
                            <option value="Cultura & Museo">Cultura & Museo</option>
                            <option value="Artesanías & Gastronomía">Artesanías & Gastronomía</option>
                            <option value="Vida Nocturna">Vida Nocturna</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Horario de Atención</label>
                          <input
                            type="text"
                            placeholder="Ej. Lunes a Domingo: 8:00 AM - 11:00 PM"
                            value={newTouristPost.schedule}
                            onChange={(e) => setNewTouristPost({ ...newTouristPost, schedule: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-nic-blue"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Tarifa / Entrada</label>
                          <input
                            type="text"
                            placeholder="Ej. C$ 10 Córdobas o Gratis"
                            value={newTouristPost.entryFee}
                            onChange={(e) => setNewTouristPost({ ...newTouristPost, entryFee: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-nic-blue"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Bahía / Parada de Destino</label>
                          <select
                            value={newTouristPost.destinationStopName}
                            onChange={(e) => setNewTouristPost({ ...newTouristPost, destinationStopName: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-nic-blue cursor-pointer"
                          >
                            <option value="">-- Seleccionar Bahía Registrada --</option>
                            {stops.map((s) => (
                              <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Rutas Recomendadas (separadas por comas)</label>
                          <input
                            type="text"
                            placeholder="Ej. Ruta 101, Ruta 120, Ruta 114"
                            value={newTouristPost.recommendedRoutesStr}
                            onChange={(e) => setNewTouristPost({ ...newTouristPost, recommendedRoutesStr: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-nic-blue"
                          />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">URL Foto de Portada</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="https://images.unsplash.com/..."
                              value={newTouristPost.coverPhoto}
                              onChange={(e) => setNewTouristPost({ ...newTouristPost, coverPhoto: e.target.value })}
                              className="flex-1 px-4 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-nic-blue"
                            />
                            <label className="px-4 py-3 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5">
                              <Camera size={14} />
                              Subir
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    try {
                                      const url = await handleFileUpload(file, 'tourist_posts');
                                      setNewTouristPost({ ...newTouristPost, coverPhoto: url });
                                    } catch (err) {
                                      setNotification({ message: 'Error al subir la imagen', type: 'error' });
                                    }
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Galería de Fotos Adicionales (URLs separadas por comas)</label>
                          <textarea
                            rows={2}
                            placeholder="https://image1.jpg, https://image2.jpg"
                            value={newTouristPost.galleryPhotosStr}
                            onChange={(e) => setNewTouristPost({ ...newTouristPost, galleryPhotosStr: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-nic-blue"
                          />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Descripción Detallada del Lugar *</label>
                          <textarea
                            required
                            rows={3}
                            placeholder="Describe los principales atractivos, actividades familiares, gastronomía y recomendaciones para el pasajero..."
                            value={newTouristPost.description}
                            onChange={(e) => setNewTouristPost({ ...newTouristPost, description: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-nic-blue"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingTouristPost(false);
                            setEditingTouristPostId(null);
                          }}
                          className="px-6 py-3 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-8 py-3 bg-nic-blue hover:bg-blue-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md"
                        >
                          {editingTouristPostId ? 'Guardar Cambios' : 'Publicar Sitio Turístico'}
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* List / Grid of Tourist Posts */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {touristPosts.length === 0 ? (
                    <div className="col-span-full bg-zinc-50 p-12 rounded-[2rem] border-2 border-dashed border-zinc-200 text-center">
                      <Compass size={40} className="text-zinc-300 mx-auto mb-3" />
                      <p className="text-sm font-bold text-zinc-500">No hay publicaciones turísticas registradas.</p>
                      <p className="text-xs text-zinc-400 mt-1">Haz clic en "Nueva Publicación Turística" para agregar un sitio emblemático.</p>
                    </div>
                  ) : (
                    touristPosts.map((post) => (
                      <div key={post.id} className="bg-white border border-zinc-200/80 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col justify-between group">
                        <div>
                          <div className="relative h-44 w-full bg-zinc-100 overflow-hidden">
                            <img src={post.coverPhoto} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                            <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-md text-[9px] font-black uppercase text-nic-blue rounded-full">
                              {post.category}
                            </span>
                          </div>

                          <div className="p-5 space-y-3">
                            <div>
                              <h4 className="text-base font-black text-zinc-900 leading-tight">{post.title}</h4>
                              {post.subtitle && <p className="text-xs text-zinc-400 font-semibold mt-0.5">{post.subtitle}</p>}
                            </div>

                            <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed font-medium">
                              {post.description}
                            </p>

                            <div className="space-y-1 pt-2 border-t border-zinc-100 text-[10px] font-bold text-zinc-600">
                              <p className="flex items-center gap-1.5"><Clock size={12} className="text-nic-blue shrink-0" /> {post.schedule}</p>
                              <p className="flex items-center gap-1.5 text-emerald-700"><MapPin size={12} className="text-emerald-600 shrink-0" /> Bahía: {post.destinationStopName}</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between gap-2">
                          <button
                            onClick={() => {
                              setEditingTouristPostId(post.id);
                              setIsAddingTouristPost(false);
                              setNewTouristPost({
                                title: post.title,
                                subtitle: post.subtitle || '',
                                description: post.description,
                                category: post.category,
                                coverPhoto: post.coverPhoto,
                                galleryPhotosStr: post.galleryPhotos ? post.galleryPhotos.join(', ') : '',
                                schedule: post.schedule,
                                entryFee: post.entryFee || '',
                                destinationStopName: post.destinationStopName,
                                recommendedRoutesStr: post.recommendedRoutes ? post.recommendedRoutes.join(', ') : ''
                              });
                            }}
                            className="px-4 py-2 bg-white border border-zinc-200 hover:border-nic-blue text-nic-blue rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => setConfirmDelete({ coll: 'touristPosts', id: post.id, itemName: post.title })}
                            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold uppercase transition-all"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {activeSection === 'routeSearch' && (
              <motion.div 
                key="routeSearch"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 text-left"
              >
                <div>
                  <h3 className="text-2xl font-black text-zinc-900 tracking-tight">Consola de Búsqueda de Rutas del Operador (OC)</h3>
                  <p className="text-xs text-zinc-400 mt-1 font-medium">Busca, planifica transbordos y simula combinaciones interurbanas de paradas en tiempo real.</p>
                </div>

                <div className="max-w-2xl mx-auto">
                  <RouteSearch 
                    onRouteSelect={(routeOption) => {
                      setNotification({ message: `Ruta planificada con éxito. Contiene ${routeOption.steps.filter(s => s.type === 'ride' || s.type === 'board').length} tramos de autobús y ${routeOption.totalStops} paradas totales.`, type: 'success' });
                      setTimeout(() => setNotification(null), 4000);
                    }}
                    onOriginChange={(org) => console.log('Admin Origin changed:', org)}
                    onDestinationChange={(dst) => console.log('Admin Dest changed:', dst)}
                  />
                </div>
              </motion.div>
            )}



          </AnimatePresence>
        </div>

        {/* Notifications */}
        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ opacity: 0, y: 50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 50, x: '-50%' }}
              className={cn(
                "fixed bottom-10 left-1/2 z-[13000] px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border",
                notification.type === 'error' ? "bg-red-900 text-white border-red-800" : "bg-zinc-900 text-white border-zinc-800"
              )}
            >
              {notification.type === 'error' ? <AlertCircle size={20} className="text-red-400" /> : <CheckCircle size={20} className="text-emerald-400" />}
              <p className="text-sm font-bold tracking-tight">{notification.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Confirmation Modal */}
        <AnimatePresence>
          {confirmDelete && (
            <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmDelete(null)}
                className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
              />
              
              {/* Modal Card */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", duration: 0.4 }}
                className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-zinc-100 relative z-10 font-sans space-y-6"
              >
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner animate-pulse">
                    <Trash2 size={28} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight">Confirmar Eliminación</h3>
                    <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
                      ¿Estás completamente seguro de que deseas eliminar <span className="text-zinc-800 font-bold">{confirmDelete.itemName}</span>?
                    </p>
                    <p className="text-[10px] text-red-500 font-black uppercase tracking-wider bg-red-50 py-1.5 px-3 rounded-xl inline-block">
                      ⚠️ Esta acción es irreversible
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setConfirmDelete(null)}
                    type="button"
                    className="flex-1 py-3.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer active:scale-95"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleConfirmDelete}
                    type="button"
                    className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-red-900/10 cursor-pointer active:scale-95"
                  >
                    Sí, Eliminar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Settings / DB Seed Modal */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div className="fixed inset-0 z-[11500] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSettingsOpen(false)}
                className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
              />
              
              {/* Modal Body */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-200/60 relative z-10 font-sans"
              >
                {/* Close Button Button */}
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="absolute top-6 right-6 p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3.5 mb-6">
                  <div className="w-10 h-10 bg-nic-blue/10 rounded-xl flex items-center justify-center text-nic-blue">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-zinc-900 leading-tight">Ajustes & Datos</h3>
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider mt-0.5">Control de base de datos</p>
                  </div>
                </div>

                {/* DB Actions Content */}
                <div className="space-y-4">
                  <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/50">
                    <h4 className="text-[10px] font-black text-zinc-900 uppercase tracking-widest mb-1.5">5 Puntos de Conexión</h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed mb-4">
                      Recrea exactamente los 5 puntos de conexión principales (UCA, Metrocentro, Plaza Inter, Puerto Salvador Allende, Mercado Huembes) y sus 5 rutas conectadas.
                    </p>
                    <button 
                      onClick={async () => {
                        setIsSettingsOpen(false);
                        setNotification({ message: 'Limpiando y re-sembrando los 5 puntos...', type: 'success' });
                        try {
                          await clearDatabase();
                          await seedDatabase();
                          setNotification({ message: '¡5 Puntos de Conexión cargados con éxito!', type: 'success' });
                        } catch (err) {
                          setNotification({ message: 'Error al sembrar 5 puntos de conexión', type: 'error' });
                        }
                        setTimeout(() => setNotification(null), 3000);
                      }}
                      className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Activity size={14} />
                      Crear 5 Puntos de Conexión y Rutas
                    </button>
                  </div>

                  <div className="p-4 bg-rose-50/55 rounded-2xl border border-rose-100">
                    <h4 className="text-[10px] font-black text-rose-800 uppercase tracking-widest mb-1.5">Restablecer Sistema</h4>
                    <p className="text-[11px] text-zinc-500 leading-relaxed mb-4">
                      Se eliminarán de forma irreversible todas las rutas, bahías de parada, choferes y reportes agregados.
                    </p>
                    <button 
                      onClick={async () => {
                        setIsSettingsOpen(false);
                        setNotification({ message: 'Limpiando base de datos...', type: 'success' });
                        try {
                          await clearDatabase();
                          setNotification({ message: '¡Base de datos limpia correctamente!', type: 'success' });
                        } catch (err) {
                          setNotification({ message: 'Error al vaciar base de datos', type: 'error' });
                        }
                        setTimeout(() => setNotification(null), 3000);
                      }}
                      className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all rounded-xl text-[10px] font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Trash2 size={14} />
                      Limpiar Base de Datos
                    </button>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-100 text-center">
                  <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">NicaGo Consola v1.2</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
