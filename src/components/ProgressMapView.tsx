import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Route, Stop, RouteStop, Driver, isBoatRoute } from '../types';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Compass, 
  ZoomIn, 
  ZoomOut, 
  Activity, 
  Search, 
  MapPin, 
  Bus, 
  Phone, 
  CreditCard, 
  ChevronRight, 
  Sliders, 
  Battery, 
  Wifi, 
  AlertTriangle, 
  Check, 
  Info, 
  User, 
  CheckCircle,
  Eye,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Helper to calculate distance between two points in meters (Haversine Formula)
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Extractor of neat name labels (e.g. Route 119 -> "119")
const getRouteLabel = (routeName: string) => {
  const match = routeName.match(/Ruta\s+(\d+)/i);
  if (match) return match[1];
  const numMatch = routeName.match(/(\d+[A-Za-z]?)/);
  if (numMatch) return numMatch[1];
  return routeName.slice(0, 7);
};

// Deterministic generator of perfect Nicaraguan National ID (Cédula) format
const genNicaId = (name: string) => {
  const codeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const birthDay = (codeSum % 28) + 1;
  const birthMonth = (codeSum % 12) + 1;
  const birthYear = 73 + (codeSum % 25);
  const sequenceNum = 1000 + (codeSum % 1000);
  const letter = String.fromCharCode(65 + (codeSum % 26));

  const dd = String(birthDay).padStart(2, '0');
  const mm = String(birthMonth).padStart(2, '0');
  const yy = String(birthYear).padStart(2, '0');

  return `001-${dd}${mm}${yy}-${sequenceNum}${letter}`;
};

interface ProgressMapViewProps {
  routes: Route[];
  stops: Stop[];
  routeStops: RouteStop[];
  drivers: Driver[];
  driverDevices: {
    [driverId: string]: {
      gpsActive: boolean;
      internetConnected: boolean;
      batteryLevel: number;
      speedKmh: number;
      latencyMs: number;
    }
  };
  setDriverDevices?: React.Dispatch<React.SetStateAction<{
    [driverId: string]: {
      gpsActive: boolean;
      internetConnected: boolean;
      batteryLevel: number;
      speedKmh: number;
      latencyMs: number;
    }
  }>>;
}

// Generate circular mock routes around center coordinates for routes that have no stops assigned yet
const generateMockCoordinates = (centerLat: number, centerLng: number, radius: number, pointsCount = 12) => {
  const coords: { lat: number; lng: number }[] = [];
  for (let i = 0; i < pointsCount; i++) {
    const angle = (i / pointsCount) * 2 * Math.PI;
    const latOffset = (radius * Math.sin(angle)) / 111000;
    const lngOffset = (radius * Math.cos(angle)) / (111000 * Math.cos(centerLat * Math.PI / 180));
    coords.push({
      lat: centerLat + latOffset,
      lng: centerLng + lngOffset
    });
  }
  // close the loop
  coords.push({ ...coords[0] });
  return coords;
};

export default function ProgressMapView({ 
  routes, 
  stops, 
  routeStops, 
  drivers, 
  driverDevices,
  setDriverDevices 
}: ProgressMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const stopMarkersGroupRef = useRef<L.FeatureGroup | null>(null);
  const polylinesGroupRef = useRef<L.FeatureGroup | null>(null);
  const busMarkersGroupRef = useRef<L.FeatureGroup | null>(null);

  // Layout mode controls
  const [vizMode, setVizMode] = useState<'routes' | 'bays'>('routes');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  // Simulation controls and animation states
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [simTime, setSimTime] = useState<string>('08:00');
  
  // Keep in-memory real-time progress for each active route
  const [routeProgress, setRouteProgress] = useState<{ [routeId: string]: number }>({});
  const progressIntervalRef = useRef<any>(null);

  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Initialize progress of routes on mount or query updates
  useEffect(() => {
    setRouteProgress(prev => {
      const next = { ...prev };
      routes.forEach(route => {
        if (next[route.id] === undefined) {
          next[route.id] = Math.random() * 5; // Start at random fraction
        }
      });
      return next;
    });
  }, [routes]);

  // Animated ticking loops
  useEffect(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    if (isPlaying) {
      const frameRateMs = 120; // Fast and fluid rendering updates
      progressIntervalRef.current = setInterval(() => {
        // Increment SIM clock time mockup
        setSimTime(prev => {
          const [hrs, mins] = prev.split(':').map(Number);
          let newMins = mins + 1;
          let newHrs = hrs;
          if (newMins >= 60) {
            newMins = 0;
            newHrs = (hrs + 1) % 24;
          }
          return `${String(newHrs).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
        });

        // Advance route progresses
        setRouteProgress(prev => {
          const next = { ...prev };
          routes.forEach((route, idx) => {
            const driverDev = route.driverId ? driverDevices[route.driverId] : null;
            const speedKmh = driverDev ? (driverDev.gpsActive && driverDev.internetConnected ? driverDev.speedKmh : 0) : 25;
            
            // Find stops sequence on this route
            const associatedRouteStops = routeStops
              .filter(rs => rs.routeId === route.id)
              .sort((a, b) => a.sequence - b.sequence);

            let pathCoords: { lat: number; lng: number }[] = [];
            
            if (associatedRouteStops.length >= 2) {
              associatedRouteStops.forEach(rs => {
                const stop = stops.find(s => s.id === rs.stopId);
                if (stop) {
                  pathCoords.push({ lat: stop.lat, lng: stop.lng });
                }
              });
            }

            // Fallback circular pattern
            if (pathCoords.length < 2) {
              const centerLat = 12.1364;
              const centerLng = -86.2514;
              const radius = 1000 + (idx * 550);
              const pointsCount = 16;
              for (let i = 0; i < pointsCount; i++) {
                const angle = (i / pointsCount) * 2 * Math.PI;
                const latOffset = (radius * Math.sin(angle)) / 111000;
                const lngOffset = (radius * Math.cos(angle)) / (111000 * Math.cos(centerLat * Math.PI / 180));
                pathCoords.push({ lat: centerLat + latOffset, lng: centerLng + lngOffset });
              }
              pathCoords.push({ ...pathCoords[0] });
            }

            // Calculate total route distance in meters
            let totalRouteMeters = 0;
            for (let i = 0; i < pathCoords.length - 1; i++) {
              totalRouteMeters += getDistance(pathCoords[i].lat, pathCoords[i].lng, pathCoords[i + 1].lat, pathCoords[i + 1].lng);
            }

            if (totalRouteMeters <= 0) totalRouteMeters = 5000;

            const metersCovered = ((speedKmh * 1000) / 3600) * (frameRateMs / 1000) * speedMultiplier;
            const segmentsCount = pathCoords.length - 1;
            const averageSegmentLength = totalRouteMeters / segmentsCount;
            const stepIncrement = averageSegmentLength > 0 ? (metersCovered / averageSegmentLength) : 0.005;

            next[route.id] = (prev[route.id] || 0) + stepIncrement;
          });
          return next;
        });
      }, frameRateMs);
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, speedMultiplier, routes, driverDevices, stops, routeStops]);

  // Synchronize route progress to Firestore at a stable rate (every 1.5s)
  useEffect(() => {
    if (!isPlaying) return;

    const syncInterval = setInterval(async () => {
      const currentProgresses = { ...routeProgress };
      const promises = routes.map(async (route) => {
        const progressVal = currentProgresses[route.id];
        if (progressVal !== undefined) {
          try {
            await updateDoc(doc(db, 'routes', route.id), {
              currentProgress: progressVal
            });
          } catch (error) {
            console.error(`Error syncing firebase progress for route ${route.id}:`, error);
          }
        }
      });
      await Promise.all(promises);
    }, 1500);

    return () => clearInterval(syncInterval);
  }, [routeProgress, routes, isPlaying]);

  // Center on map helper for selected item
  const getRouteInterpolatedCoords = (routeId: string) => {
    const route = routes.find(r => r.id === routeId);
    if (!route) return null;
    
    const associatedRouteStops = routeStops
      .filter(rs => rs.routeId === route.id)
      .sort((a, b) => a.sequence - b.sequence);

    let pathCoords: { lat: number; lng: number }[] = [];
    if (associatedRouteStops.length >= 2) {
      associatedRouteStops.forEach(rs => {
        const stop = stops.find(s => s.id === rs.stopId);
        if (stop) pathCoords.push({ lat: stop.lat, lng: stop.lng });
      });
    }
    if (pathCoords.length < 2) {
      const idx = routes.findIndex(r => r.id === routeId);
      const radius = 1000 + (idx * 550);
      pathCoords = generateMockCoordinates(12.1364, -86.2514, radius, 16);
    }

    const progressVal = routeProgress[route.id] || 0;
    const totalPoints = pathCoords.length;
    const idxFloat = progressVal % (totalPoints - 1);
    const prevIdx = Math.floor(idxFloat);
    const nextIdx = (prevIdx + 1) % totalPoints;
    const fraction = idxFloat - prevIdx;

    const pA = pathCoords[prevIdx];
    const pB = pathCoords[nextIdx];
    if (pA && pB) {
      return {
        lat: pA.lat + (pB.lat - pA.lat) * fraction,
        lng: pA.lng + (pB.lng - pA.lng) * fraction
      };
    }
    return null;
  };

  // Focus map when route is clicked / selected
  useEffect(() => {
    if (selectedRouteId && mapRef.current) {
      const coords = getRouteInterpolatedCoords(selectedRouteId);
      if (coords) {
        mapRef.current.setView([coords.lat, coords.lng], 16);
      }
    }
  }, [selectedRouteId]);

  // Focus map when stop/bay is clicked / selected
  useEffect(() => {
    if (selectedStopId && mapRef.current) {
      const stop = stops.find(s => s.id === selectedStopId);
      if (stop) {
        mapRef.current.setView([stop.lat, stop.lng], 16);
      }
    }
  }, [selectedStopId]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      tap: false,
    } as any).setView([12.1364, -86.2514], 14); // Centered in Managua

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Allocate layered groups
    const stopMarkersGroup = L.featureGroup().addTo(map);
    const polylinesGroup = L.featureGroup().addTo(map);
    const busMarkersGroup = L.featureGroup().addTo(map);

    stopMarkersGroupRef.current = stopMarkersGroup;
    polylinesGroupRef.current = polylinesGroup;
    busMarkersGroupRef.current = busMarkersGroup;

    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle ResizeObserver
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || !mapRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });

    resizeObserver.observe(container);
    return () => {
      resizeObserver.unobserve(container);
    };
  }, []);

  // Map Mode 1: Render stops ONLY IF vizMode is 'bays'
  useEffect(() => {
    const map = mapRef.current;
    const group = stopMarkersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // Hide if in routes mode
    if (vizMode !== 'bays') return;

    stops.forEach(stop => {
      const stopHtmlIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center cursor-pointer">
            <div class="absolute -inset-1 rounded-full bg-nic-blue/30 blur-sm animate-pulse"></div>
            <div class="w-7 h-7 rounded-full bg-white border-2 border-nic-blue flex items-center justify-center shadow-md hover:scale-125 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-nic-blue">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          </div>`,
        className: 'progress-stop-node-custom',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const popupHtml = `
        <div class="p-3.5 max-w-[240px] font-sans">
          <span class="text-[8px] font-black uppercase tracking-widest text-nic-blue block">Bahía de Abordaje</span>
          <h4 class="font-extrabold text-zinc-950 text-sm leading-snug mt-1">${stop.name}</h4>
          <p class="text-xs text-zinc-500 font-semibold mt-1.5">${stop.generalInfo || 'Punto rápido de abordaje comercial.'}</p>
          <div class="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400 font-bold">
            <span>Ubicación:</span>
            <span>${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}</span>
          </div>
        </div>
      `;

      const marker = L.marker([stop.lat, stop.lng], { icon: stopHtmlIcon })
        .on('click', () => {
          setSelectedStopId(stop.id);
          setSelectedRouteId(null);
        })
        .bindPopup(popupHtml, { maxWidth: 280, className: 'custom-leaflet-popup shadow-2xl rounded-3xl' });
      
      group.addLayer(marker);
    });
  }, [stops, vizMode]);

  // Map Mode 2: Draw active route pathways / simulated buses smoothly ONLY IF vizMode is 'routes'
  useEffect(() => {
    const map = mapRef.current;
    const polyGroup = polylinesGroupRef.current;
    const busGroup = busMarkersGroupRef.current;
    if (!map || !polyGroup || !busGroup) return;

    polyGroup.clearLayers();
    busGroup.clearLayers();

    // Hide if in bays mode
    if (vizMode !== 'routes') return;

    routes.forEach((route, idx) => {
      const associatedRouteStops = routeStops
        .filter(rs => rs.routeId === route.id)
        .sort((a, b) => a.sequence - b.sequence);

      let pathCoords: { lat: number; lng: number }[] = [];
      
      if (associatedRouteStops.length >= 2) {
        associatedRouteStops.forEach(rs => {
          const stop = stops.find(s => s.id === rs.stopId);
          if (stop) {
            pathCoords.push({ lat: stop.lat, lng: stop.lng });
          }
        });
      }

      if (pathCoords.length < 2) {
        const radius = 1000 + (idx * 550);
        pathCoords = generateMockCoordinates(12.1364, -86.2514, radius, 16);
      }

      const assignedDriver = drivers.find(d => d.id === route.driverId);
      const device = route.driverId ? driverDevices[route.driverId] : null;
      const isActive = assignedDriver && device && device.gpsActive && device.internetConnected;

      // Draw dashed trajectory of route
      const leafCoords = pathCoords.map(c => [c.lat, c.lng] as L.LatLngExpression);

      const glowLine = L.polyline(leafCoords, {
        color: route.color || '#3b82f6',
        weight: 6,
        opacity: isActive ? 0.12 : 0.05,
        lineCap: 'round',
        lineJoin: 'round'
      });

      const flowLine = L.polyline(leafCoords, {
        color: route.color || '#3b82f6',
        weight: isActive ? 3 : 1.5,
        opacity: isActive ? 0.8 : 0.3,
        dashArray: isActive ? '8, 8' : '4, 4',
        lineCap: 'round',
        lineJoin: 'round'
      });

      polyGroup.addLayer(glowLine);
      polyGroup.addLayer(flowLine);

      if (isActive) {
        const progressVal = routeProgress[route.id] || 0;
        const totalPoints = pathCoords.length;
        
        const idxFloat = progressVal % (totalPoints - 1);
        const prevIdx = Math.floor(idxFloat);
        const nextIdx = (prevIdx + 1) % totalPoints;
        const fraction = idxFloat - prevIdx;

        const pA = pathCoords[prevIdx];
        const pB = pathCoords[nextIdx];

        if (pA && pB) {
          const interpolatedLat = pA.lat + (pB.lat - pA.lat) * fraction;
          const interpolatedLng = pA.lng + (pB.lng - pA.lng) * fraction;

          const routeNum = getRouteLabel(route.name);
          const driverIdCard = genNicaId(assignedDriver.name);
          const routeStateLabel = route.status === 'excellent' 
            ? 'Excelente estado comercial' 
            : route.status === 'good' 
              ? 'Buen estado operacional' 
              : 'Estado regular (en observación)';

          const liveBusHtml = `
            <div class="relative flex items-center justify-center cursor-pointer">
              <div class="absolute -inset-1.5 rounded-full blur-md opacity-40 animate-pulse" style="background-color: ${route.color || '#3b82f6'}"></div>
              <div class="absolute w-14 h-9 rounded-full animate-ping opacity-15" style="background-color: ${route.color || '#3b82f6'}"></div>
              
              <div class="flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full text-white font-sans select-none tracking-tight transition-all duration-300 hover:scale-110" 
                   style="background: linear-gradient(135deg, ${route.color || '#3b82f6'} 0%, #18181b 100%); border: 2px solid ${route.color || '#3b82f6'}; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.45); height: 32px; min-width: 64px; justify-content: center;">
                
                <div class="w-4.5 h-4.5 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/35">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="text-white">
                    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h2"/>
                    <circle cx="7" cy="17" r="2"/>
                    <path d="M9 17h6"/>
                    <circle cx="17" cy="17" r="2"/>
                  </svg>
                </div>
                
                <span class="leading-none text-[11px] font-black tracking-wide pr-0.5 text-white" style="text-shadow: 0 1px 2px rgba(0,0,0,0.55);">${routeNum}</span>
              </div>
            </div>
          `;

          const busIcon = L.divIcon({
            html: liveBusHtml,
            className: 'live-simulated-bus-avatar-marker-pill',
            iconSize: [80, 36],
            iconAnchor: [40, 18]
          });

          // Informative popup answering exactly the plate, condition, driver name, ID number, and contact info
          const popupMarkup = `
            <div class="p-4 max-w-[270px] font-sans text-zinc-800 space-y-3">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-2xl flex items-center justify-center text-white" style="background-color: ${route.color || '#3b82f6'}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="16" height="16" x="4" y="4" rx="2" ry="2"/><rect width="12" height="6" x="6" y="8" rx="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>
                </div>
                <div class="min-w-0">
                  <h4 class="font-extrabold text-zinc-950 text-sm leading-tight truncate">${route.name}</h4>
                  <p class="text-[10px] font-black text-nic-blue uppercase tracking-wide mt-0.5">Placa: ${route.code}</p>
                </div>
              </div>

              <!-- General condition badge -->
              <div class="p-2 bg-zinc-50 border border-zinc-150 rounded-xl text-[10px] space-y-0.5">
                <span class="text-[9px] text-zinc-400 font-extrabold block uppercase tracking-wider">Estado Técnico</span>
                <span class="font-bold text-zinc-800">${routeStateLabel}</span>
              </div>

              <!-- Driver details side card -->
              <div class="bg-zinc-50 border border-zinc-200/50 p-2.5 rounded-2xl flex items-center gap-2.5">
                <img src="${assignedDriver.photoUrl}" class="w-10 h-10 rounded-xl object-cover border border-white shadow-sm" referrerPolicy="no-referrer" />
                <div class="min-w-0 flex-1">
                  <span class="text-[7.5px] font-black text-nic-blue uppercase tracking-widest block">Chofer Designado</span>
                  <p class="text-[11px] font-black text-zinc-950 truncate">${assignedDriver.name}</p>
                  <p class="text-[9px] font-bold text-zinc-500 font-sans tracking-tight mt-0.5">Cédula: ${driverIdCard}</p>
                  <p class="text-[9px] font-bold text-zinc-600 font-mono mt-0.5">${assignedDriver.phoneNumber || '+505 8888-8888'}</p>
                </div>
              </div>

              <!-- Realtime flow message -->
              <div class="text-[8.5px] font-bold text-center text-emerald-600 bg-emerald-50 border border-emerald-100/50 py-1 rounded-lg uppercase tracking-widest flex items-center justify-center gap-1">
                <span class="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                Transmitiendo Monitoreo
              </div>
            </div>
          `;

          const busMarker = L.marker([interpolatedLat, interpolatedLng], { icon: busIcon })
            .on('click', () => {
              setSelectedRouteId(route.id);
              setSelectedStopId(null);
            })
            .bindPopup(popupMarkup, { maxWidth: 290, className: 'custom-leaflet-popup shadow-2xl rounded-3xl' });

          busGroup.addLayer(busMarker);
        }
      }
    });
  }, [routes, stops, routeStops, drivers, driverDevices, routeProgress, vizMode]);

  // Adjust coordinates fit
  const handleRecenter = () => {
    if (!mapRef.current) return;
    mapRef.current.setView([12.1364, -86.2514], 14);
  };

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  // Filtered lists for ordered sections
  const filteredRoutes = routes.filter(route => {
    const assignedDriver = drivers.find(d => d.id === route.driverId);
    const query = searchQuery.toLowerCase();
    const matchesRoute = route.name.toLowerCase().includes(query) || route.code.toLowerCase().includes(query);
    const matchesDriver = assignedDriver ? assignedDriver.name.toLowerCase().includes(query) : false;
    return matchesRoute || matchesDriver;
  });

  const filteredStops = stops.filter(stop => {
    const query = searchQuery.toLowerCase();
    return stop.name.toLowerCase().includes(query) || (stop.generalInfo && stop.generalInfo.toLowerCase().includes(query));
  });

  return (
    <div className="bg-white rounded-[2.5rem] border border-zinc-200/60 shadow-xl overflow-hidden relative flex flex-col h-[680px]">
      
      {/* Upper Mode Selection Control Room Header */}
      <div className="bg-zinc-950 text-white p-5 px-6 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 border-b border-zinc-900 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Activity className="animate-pulse" size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black text-white">Visualizador Táctico de Tránsito</h4>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mt-0.5">Control Inteligente de Flotas</span>
          </div>
        </div>

        {/* CLICKABLE Presets for separate maps */}
        <div className="flex items-center gap-2.5 bg-zinc-900/60 border border-zinc-800 p-1.5 rounded-2xl">
          <button
            onClick={() => {
              setVizMode('routes');
              setSelectedStopId(null);
            }}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
              vizMode === 'routes' 
                ? "bg-nic-blue text-white shadow-lg shadow-blue-500/15" 
                : "text-zinc-400 hover:text-white hover:bg-zinc-850"
            )}
          >
            <Bus size={13.5} />
            Visualizar Rutas
          </button>
          <button
            onClick={() => {
              setVizMode('bays');
              setSelectedRouteId(null);
            }}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
              vizMode === 'bays' 
                ? "bg-nic-blue text-white shadow-lg shadow-blue-500/15" 
                : "text-zinc-400 hover:text-white hover:bg-zinc-850"
            )}
          >
            <MapPin size={13.5} />
            Visualizar Bahías
          </button>
        </div>

        {/* Playback simulation toolbar */}
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-1 rounded-xl flex-wrap shrink-0">
          <div className="px-3 py-1.5 bg-zinc-950 border border-zinc-850 rounded-lg text-[11px] font-mono font-black text-amber-500">
            ⏰ HORA: {simTime}
          </div>

          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1 px-2.5 hover:bg-zinc-800 text-zinc-300 rounded-lg transition-all cursor-pointer flex items-center justify-center"
            title={isPlaying ? "Pausar" : "Reanudar"}
          >
            {isPlaying ? <Pause size={13} className="text-zinc-100" /> : <Play size={13} className="text-emerald-400" />}
          </button>

          <button 
            onClick={() => {
              setRouteProgress(prev => {
                const reset: typeof prev = {};
                routes.forEach(r => { reset[r.id] = 0; });
                return reset;
              });
            }}
            className="p-1 px-2.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center"
            title="Reiniciar Itinerario"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {/* Main Panel Content: Split sidebar and map layout */}
      <div className="flex-1 flex flex-col lg:flex-row relative z-10 overflow-hidden">
        
        {/* Ordered Section / Sidebar */}
        <div className="w-full lg:w-[380px] bg-zinc-50 border-r border-zinc-200/80 flex flex-col shrink-0 h-[280px] lg:h-full overflow-hidden select-none">
          
          {selectedRouteId ? (() => {
            // Detailed View for pressed Route in motion
            const pathRoute = routes.find(r => r.id === selectedRouteId);
            if (!pathRoute) return null;
            const assignedDriver = drivers.find(d => d.id === pathRoute.driverId);
            const dev = pathRoute.driverId ? driverDevices[pathRoute.driverId] : null;
            const isLive = assignedDriver && dev && dev.gpsActive && dev.internetConnected;
            const routeIdCard = assignedDriver ? genNicaId(assignedDriver.name) : '---';

            return (
              <div className="flex flex-col h-full bg-white animate-fadeIn">
                {/* Header with back button */}
                <div className="p-4 border-b border-zinc-150 flex items-center justify-between bg-zinc-50/50">
                  <button 
                    onClick={() => setSelectedRouteId(null)}
                    className="flex items-center gap-1.5 text-[10px] font-black text-zinc-700 hover:text-black bg-zinc-100 p-2 px-3 rounded-xl transition-all uppercase tracking-wider cursor-pointer border border-zinc-200"
                  >
                    ← Volver
                  </button>
                  <span className="text-[9px] font-black uppercase text-nic-blue tracking-wide">Ficha de Tránsito</span>
                </div>

                {/* Color Strip Indicator */}
                <div className="h-2 w-full" style={{ backgroundColor: pathRoute.color || '#e4e4e7' }} />

                {/* Content scroll box */}
                <div className="flex-1 p-5 overflow-y-auto space-y-5">
                  <div>
                    <span className="bg-zinc-100 text-zinc-700 border border-zinc-200 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">Unidad de Transporte</span>
                    <h3 className="text-lg font-black text-zinc-950 mt-1.5">{pathRoute.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono font-bold bg-zinc-100 text-zinc-650 px-2 py-0.5 rounded-md border border-zinc-200">Placa: {pathRoute.code}</span>
                      
                      {/* Condition state rendering */}
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md border",
                        pathRoute.status === 'excellent' 
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                          : pathRoute.status === 'good'
                            ? "bg-blue-50 border-blue-200 text-nic-blue"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                      )}>
                        {pathRoute.status === 'excellent' ? 'Excelente' : pathRoute.status === 'good' ? 'Buen estado' : 'Regular'}
                      </span>
                    </div>
                  </div>

                  {/* Driver Side Section with dynamic Cédula ID Card */}
                  <div className="bg-zinc-50 rounded-2xl border border-zinc-150 p-4 space-y-4">
                    <span className="text-[8.5px] font-black uppercase tracking-widest text-zinc-400 block border-b border-zinc-200/50 pb-2">Conductor Asignado</span>
                    
                    {assignedDriver ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <img 
                            src={assignedDriver.photoUrl} 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(assignedDriver.name)}`;
                            }}
                            className="w-12 h-12 rounded-xl object-cover border border-zinc-200 bg-white" 
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-black text-zinc-950 leading-tight">{assignedDriver.name}</h4>
                            <p className="text-[10px] text-zinc-400 font-bold mt-1">Cargo: Chofer de Turno</p>
                          </div>
                        </div>

                        {/* Driver credentials ordered section */}
                        <div className="bg-white rounded-xl border border-zinc-200/60 p-3 space-y-2 text-[11px] font-semibold text-zinc-600">
                          <div className="flex justify-between items-center">
                            <span className="text-zinc-400 font-bold">Cédula ID:</span>
                            <span className="font-mono text-zinc-800 font-bold">{routeIdCard}</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-zinc-100 pt-2">
                            <span className="text-zinc-400 font-bold">Contacto:</span>
                            <a href={`tel:${assignedDriver.phoneNumber}`} className="text-nic-blue font-bold flex items-center gap-1 hover:underline">
                              <Phone size={10} />
                              {assignedDriver.phoneNumber || '+505 8888-8888'}
                            </a>
                          </div>
                          <div className="flex justify-between items-start border-t border-zinc-100 pt-2">
                            <span className="text-zinc-400 font-bold shrink-0 pr-1.5">Exp:</span>
                            <span className="text-zinc-700 text-right">{assignedDriver.experience || '8 años de servicio'}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 text-center bg-amber-50 rounded-xl border border-amber-200">
                        <span className="text-[10px] text-amber-600 font-bold">⚠️ Sin chofer activo registrado en base de datos</span>
                      </div>
                    )}
                  </div>

                  {/* Device connectivity status */}
                  {dev && (
                    <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-3xl space-y-3.5">
                      <div className="flex items-center justify-between border-b border-zinc-200/50 pb-2">
                        <span className="text-[8.5px] font-black uppercase tracking-widest text-zinc-400">Canal de Dispositivo</span>
                        <span className={cn(
                          "w-2.5 h-2.5 rounded-full",
                          isLive ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                        )} />
                      </div>

                      <div className="grid grid-cols-2 gap-3 pb-1 text-[11px] font-semibold text-zinc-600 font-sans">
                        <div className="bg-white border border-zinc-200/40 p-2 rounded-xl text-center">
                          <span className="text-[8px] text-zinc-400 font-black block uppercase tracking-wider mb-1">Carga Batería</span>
                          <span className="font-mono font-bold text-zinc-900 flex items-center justify-center gap-1">
                            <Battery size={11} className="text-emerald-500" />
                            {dev.batteryLevel}%
                          </span>
                        </div>
                        <div className="bg-white border border-zinc-200/40 p-2 rounded-xl text-center">
                          <span className="text-[8px] text-zinc-400 font-black block uppercase tracking-wider mb-1">Velocidad</span>
                          <span className="font-mono font-bold text-zinc-900">
                            {isLive ? `${dev.speedKmh} KM/H` : '0 KM/H'}
                          </span>
                        </div>
                      </div>

                      {/* Tactical simulation buttons toggler inside sidebar! */}
                      {setDriverDevices && assignedDriver && (
                        <div className="pt-2 border-t border-zinc-150 space-y-2">
                          <span className="text-[8px] font-black uppercase text-zinc-400 block tracking-widest">Controles de Simulación</span>
                          
                          <div className="grid grid-cols-2 gap-2">
                            {/* GPS SATELITE TRIGGER */}
                            <button
                              onClick={() => {
                                setDriverDevices(prev => ({
                                  ...prev,
                                  [assignedDriver.id]: {
                                    ...prev[assignedDriver.id],
                                    gpsActive: !prev[assignedDriver.id].gpsActive
                                  }
                                }));
                              }}
                              className={cn(
                                "p-2.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 cursor-pointer text-center select-none transition-all active:scale-95 text-[10px]",
                                dev.gpsActive 
                                  ? "bg-emerald-50 border-emerald-250 text-emerald-700 font-black" 
                                  : "bg-zinc-100 border-zinc-200 text-zinc-400"
                              )}
                            >
                              <span className="text-[8px] font-black uppercase tracking-widest">GPS Satélite</span>
                              <span className="font-extrabold">{dev.gpsActive ? '🟢 SÍ' : '🔴 NO'}</span>
                            </button>

                            {/* SIGNAL CONNECTION TRIGGER */}
                            <button
                              onClick={() => {
                                setDriverDevices(prev => ({
                                  ...prev,
                                  [assignedDriver.id]: {
                                    ...prev[assignedDriver.id],
                                    internetConnected: !prev[assignedDriver.id].internetConnected
                                  }
                                }));
                              }}
                              className={cn(
                                "p-2.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 cursor-pointer text-center select-none transition-all active:scale-95 text-[10px]",
                                dev.internetConnected 
                                  ? "bg-purple-50 border-purple-250 text-purple-700 font-black" 
                                  : "bg-zinc-100 border-zinc-200 text-zinc-400"
                              )}
                            >
                              <span className="text-[8px] font-black uppercase tracking-widest">Internet LTE</span>
                              <span className="font-extrabold">{dev.internetConnected ? '🟢 SÍ' : '🔴 NO'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })() : selectedStopId ? (() => {
            // Detailed View for pressed Stop / Bay
            const stopPoint = stops.find(s => s.id === selectedStopId);
            if (!stopPoint) return null;

            return (
              <div className="flex flex-col h-full bg-white animate-fadeIn">
                {/* Header with back button */}
                <div className="p-4 border-b border-zinc-150 flex items-center justify-between bg-zinc-50/50">
                  <button 
                    onClick={() => setSelectedStopId(null)}
                    className="flex items-center gap-1.5 text-[10px] font-black text-zinc-700 hover:text-black bg-zinc-100 p-2 px-3 rounded-xl transition-all uppercase tracking-wider cursor-pointer border border-zinc-200"
                  >
                    ← Volver
                  </button>
                  <span className="text-[9px] font-black uppercase text-nic-blue tracking-wide">Ficha de Infraestructura</span>
                </div>

                <div className="h-2 w-full bg-nic-blue" />

                {/* Content scroll box */}
                <div className="flex-1 p-5 overflow-y-auto space-y-4">
                  <div>
                    <span className="bg-blue-50 text-nic-blue border border-blue-200 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">Bahía / Paradero Oficial</span>
                    <h3 className="text-base font-black text-zinc-950 mt-1.5">{stopPoint.name}</h3>
                  </div>

                  <div className="bg-zinc-50 rounded-2xl border border-zinc-150 p-4 space-y-2.5 text-[11px] font-semibold text-zinc-650">
                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 block border-b border-zinc-200/50 pb-2">Detalles Generales</span>
                    <p className="text-zinc-800 leading-relaxed font-bold">
                      {stopPoint.generalInfo || 'Bahía de abordaje rápido techada con rampa accesible.'}
                    </p>
                  </div>

                  <div className="bg-zinc-50 rounded-2xl border border-zinc-150 p-4 space-y-2 text-[11px] font-mono text-zinc-500">
                    <div className="flex justify-between">
                      <span className="font-bold">Latitud:</span>
                      <span className="font-extrabold text-zinc-800">{stopPoint.lat.toFixed(6)}°</span>
                    </div>
                    <div className="flex justify-between border-t border-zinc-200/40 pt-2">
                      <span className="font-bold">Longitud:</span>
                      <span className="font-extrabold text-zinc-800">{stopPoint.lng.toFixed(6)}°</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (mapRef.current) {
                        mapRef.current.setView([stopPoint.lat, stopPoint.lng], 16);
                      }
                    }}
                    className="w-full py-3 bg-nic-blue hover:bg-zinc-950 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Compass size={12} />
                    Centrar Bahía en Mapa
                  </button>
                </div>
              </div>
            );
          })() : (
            // Default Sidebar List View: depending on the selected vizMode
            <div className="flex flex-col h-full bg-zinc-50">
              
              {/* Search Box / Search Route part */}
              <div className="p-4 bg-white border-b border-zinc-250 shrink-0">
                <span className="text-[8.5px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 leading-none">Canal de Búsqueda</span>
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={vizMode === 'routes' ? "Buscar ruta, placa o chofer..." : "Buscar bahía o parada..."}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-zinc-800 placeholder-zinc-400 outline-none focus:border-nic-blue focus:ring-4 focus:ring-blue-500/10 transition-all font-sans"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs hover:text-black font-black uppercase"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Head stats badge */}
              <div className="px-4 py-2.5 bg-zinc-100 border-b border-zinc-200/50 flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest shrink-0">
                <span>{vizMode === 'routes' ? 'Listado: Rutas en Movimiento' : 'Listado de Bahías'}</span>
                <span className="bg-zinc-250 text-zinc-700 px-2 py-0.5 rounded font-mono font-extrabold text-[9px]">
                  {vizMode === 'routes' ? filteredRoutes.length : filteredStops.length}
                </span>
              </div>

              {/* Scrollable ordered items list */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 scrollbar-thin">
                {vizMode === 'routes' ? (
                  // Render Route in motion list
                  filteredRoutes.length > 0 ? (
                    filteredRoutes.map((routeObj) => {
                      const assignedDriver = drivers.find(d => d.id === routeObj.driverId);
                      const dev = routeObj.driverId ? driverDevices[routeObj.driverId] : null;
                      const isActive = assignedDriver && dev && dev.gpsActive && dev.internetConnected;
                      
                      return (
                        <div
                          key={routeObj.id}
                          onClick={() => setSelectedRouteId(routeObj.id)}
                          className={cn(
                            "group bg-white p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs hover:shadow-md",
                            selectedRouteId === routeObj.id 
                              ? "border-nic-blue ring-2 ring-blue-500/10" 
                              : "border-zinc-200/80 hover:border-zinc-300"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: routeObj.color || '#cbd5e1' }} />
                              <h4 className="text-xs font-black text-zinc-950 group-hover:text-nic-blue transition-colors truncate">
                                {routeObj.name}
                              </h4>
                            </div>

                            <p className="text-[10px] font-bold text-zinc-400 mt-1 pl-4 uppercase">
                              Placa: <span className="font-mono text-zinc-650">{routeObj.code}</span>
                            </p>

                            {assignedDriver && (
                              <p className="text-[10px] font-semibold text-zinc-500 mt-0.5 pl-4 truncate">
                                🧑‍✈️ Chofer: <span className="font-bold text-zinc-700">{assignedDriver.name}</span>
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {/* In motion / active state indicators */}
                            {isActive ? (
                              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md leading-none">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                                Movimiento
                              </span>
                            ) : (
                              <span className="bg-zinc-150 text-zinc-400 border border-zinc-200 text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md leading-none">
                                Inactiva
                              </span>
                            )}

                            {/* State badge condition */}
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
                              routeObj.status === 'excellent' 
                                ? "bg-emerald-50 text-emerald-600" 
                                : routeObj.status === 'good'
                                  ? "bg-blue-50 text-nic-blue"
                                  : "bg-amber-50 text-amber-600"
                            )}>
                              {routeObj.status === 'excellent' ? 'Excelente' : routeObj.status === 'good' ? 'Bueno' : 'Regular'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-zinc-400 text-xs font-semibold">
                      ❌ No se encontraron rutas que coincidan
                    </div>
                  )
                ) : (
                  // Render Stop / Bay list
                  filteredStops.length > 0 ? (
                    filteredStops.map((stopObj) => (
                      <div
                        key={stopObj.id}
                        onClick={() => setSelectedStopId(stopObj.id)}
                        className={cn(
                          "group bg-white p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs hover:border-nic-blue",
                          selectedStopId === stopObj.id 
                            ? "border-nic-blue ring-2 ring-blue-500/10" 
                            : "border-zinc-200/80"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <MapPin size={12} className="text-nic-blue shrink-0" />
                            <h4 className="text-xs font-black text-zinc-950 truncate max-w-[210px]">
                              {stopObj.name}
                            </h4>
                          </div>
                          <p className="text-[10px] text-zinc-405 font-medium block truncate pl-5 mt-0.5">
                            {stopObj.generalInfo || 'Bahía del sistema central.'}
                          </p>
                        </div>

                        <ChevronRight size={12} className="text-zinc-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-zinc-400 text-xs font-semibold">
                      ❌ No se encontraron bahías registradas
                    </div>
                  )
                )}
              </div>
            </div>
          )}

        </div>

        {/* Map Stage Element Area */}
        <div className="flex-1 relative bg-zinc-100 h-[400px] lg:h-full">
          <div ref={mapContainerRef} className="absolute inset-0 z-10 w-full h-full" />

          {/* Quick recency controls layer float bottom right */}
          <div className="absolute top-5 right-5 z-20 flex flex-col gap-2">
            <button 
              onClick={handleZoomIn}
              className="w-10 h-10 bg-white/95 backdrop-blur border border-zinc-200 text-zinc-700 hover:text-zinc-950 rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Acercar"
            >
              <ZoomIn size={18} />
            </button>
            <button 
              onClick={handleZoomOut}
              className="w-10 h-10 bg-white/95 backdrop-blur border border-zinc-200 text-zinc-700 hover:text-zinc-950 rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Alejar"
            >
              <ZoomOut size={18} />
            </button>
            <button 
              onClick={handleRecenter}
              className="w-10 h-10 bg-white/95 backdrop-blur border border-zinc-300 text-nic-blue rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer border-2"
              title="Recentrar Managua"
            >
              <Compass size={20} className="animate-spin-slow" />
            </button>
          </div>

          {/* Connection status nomenclature legend */}
          <div className="absolute bottom-5 right-5 z-20 bg-zinc-950/90 backdrop-blur-md text-white px-5 py-4 rounded-3xl shadow-xl max-w-[200px] text-[10px] space-y-2.5 font-sans border border-zinc-800">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#10b981] block border-b border-zinc-800 pb-1.5">Nomenclatura</span>
            
            {vizMode === 'routes' ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border border-white/40 shadow bg-[#10b981] animate-pulse shrink-0" />
                  <span className="font-semibold text-zinc-300">Ruta / Conductor Activo</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-sky-400 tracking-tighter shrink-0" />
                  <span className="font-semibold text-zinc-300">Itinerario de trayecto</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border border-nic-blue bg-white flex items-center justify-center shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-nic-blue" />
                </span>
                <span className="font-semibold text-zinc-300">Punto de Control (Bahía)</span>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
