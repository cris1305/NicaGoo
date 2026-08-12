import { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { RouteOption, Stop, Route, RouteStop, Driver } from '../types';
import { Bell, Navigation, Compass } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import L from 'leaflet';
import 'leaflet-rotate';

// Helper to calculate distance between two points in meters
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

// Helper to calculate bearing between two points in degrees
const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const fLat1 = lat1 * Math.PI / 180;
  const fLat2 = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(fLat2);
  const x = Math.cos(fLat1) * Math.sin(fLat2) -
            Math.sin(fLat1) * Math.cos(fLat2) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360; // 0-360 degrees
};

interface MapViewProps {
  origin: { lat: number; lng: number; address: string } | null;
  destination: { lat: number; lng: number; address: string } | null;
  selectedRoute: RouteOption | null;
  onArrival?: () => void;
}

export default function MapView({ origin, destination, selectedRoute, onArrival }: MapViewProps) {
  const { language } = useLanguage();
  const [stops, setStops] = useState<Stop[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [proximityAlert, setProximityAlert] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const lastAlertedStop = useRef<string | null>(null);
  const arrivalTriggeredRef = useRef<boolean>(false);

  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false);
  const [showLocHelp, setShowLocHelp] = useState<boolean>(false);
  const [dismissedPrompt, setDismissedPrompt] = useState<boolean>(false);
  const isSimulationModeRef = useRef<boolean>(false);

  useEffect(() => {
    isSimulationModeRef.current = isSimulationMode;
  }, [isSimulationMode]);

  // Reset trigger ref when selectedRoute changes
  useEffect(() => {
    arrivalTriggeredRef.current = false;
  }, [selectedRoute]);

  // Real-time telemetires
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [etaInfo, setEtaInfo] = useState<{
    distanceM: number;
    minutes: number;
    routeName: string;
    stopName: string;
    isActive: boolean;
  } | null>(null);

  // Street-conformed route path coordinates from OSRM
  const [streetPath, setStreetPath] = useState<L.LatLngExpression[]>([]);
  const [isLoadingPath, setIsLoadingPath] = useState<boolean>(false);

  // Creative Compass Navigation states
  const [zoomLevel, setZoomLevel] = useState<number>(13);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 12.1364, lng: -86.2514 });
  const [rotation, setRotation] = useState<number>(0);

  // Refs to control fitting bounds to prevent constant snapping and resetting
  const lastRouteIdRef = useRef<string | null>(null);
  const lastOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastDestinationRef = useRef<{ lat: number; lng: number } | null>(null);
  const hasBoundedInitialUserLocationRef = useRef<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const stopMarkersGroupRef = useRef<L.FeatureGroup | null>(null);
  const routePolylineGroupRef = useRef<L.FeatureGroup | null>(null);
  const locationMarkersGroupRef = useRef<L.FeatureGroup | null>(null);
  const busMarkersGroupRef = useRef<L.FeatureGroup | null>(null);

  const handleRecenter = () => {
    if (isSimulationMode) {
      if (userLocation && mapRef.current) {
        mapRef.current.flyTo([userLocation.lat, userLocation.lng], 16, {
          animate: true,
          duration: 1.2
        });
      } else {
        const message = language === 'en'
          ? "Click/tap anywhere on the map to set your initial simulated location first!"
          : "¡Haz clic o toca cualquier parte del mapa para fijar tu ubicación simulada primero!";
        setLocError(message);
        setTimeout(() => setLocError(null), 8500);
      }
      return;
    }

    setLocating(true);
    setLocError(null);

    const onLocationSuccess = (lat: number, lng: number) => {
      const newLoc = { lat, lng };
      setUserLocation(newLoc);
      setLocating(false);
      
      if (mapRef.current) {
        mapRef.current.flyTo([lat, lng], 16, {
          animate: true,
          duration: 1.5
        });
      }
    };

    const onLocationError = (error: GeolocationPositionError) => {
      console.error("GPS error:", error);
      setLocating(false);
      
      let message = "No se pudo acceder a tu ubicación actual.";
      if (error.code === error.PERMISSION_DENIED) {
        message = language === 'en' 
          ? "Location permission denied. If you are using the AI Studio preview, click 'Shared URL / Open in a new tab' at the top-right of your screen so your mobile browser can access the GPS." 
          : language === 'zh'
          ? "定位权限被拒绝。若在 AI Studio 预览中，请点击右上角 'Shared URL / 在新标签页中打开' 以来授予 GPS 权限。"
          : "Permiso de ubicación denegado. Si estás usando la vista previa de AI Studio, haz clic arriba a la derecha en 'Shared URL / Abrir en pestaña nueva' para que el navegador de tu móvil acceda al GPS.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = language === 'en'
          ? "Location unavailable. Ensure your GPS is active."
          : language === 'zh'
          ? "无法获取位置。请确认您的GPS已开启。"
          : "Ubicación no disponible (IP/red). Asegúrate de que el GPS de tu dispositivo o navegador esté activo.";
      } else if (error.code === error.TIMEOUT) {
        message = language === 'en'
          ? "Request timed out while acquiring location."
          : language === 'zh'
          ? "获取位置超时。"
          : "Tiempo de espera de GPS agotado (falló alta precisión).";
      }

      setLocError(message);
      setTimeout(() => setLocError(null), 15000);
    };

    const tryGetPosition = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          onLocationSuccess(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          if (highAccuracy) {
            console.warn("High accuracy failed, trying standard accuracy (IP/Wi-Fi)...", error);
            tryGetPosition(false);
          } else {
            onLocationError(error);
          }
        },
        { 
          enableHighAccuracy: highAccuracy, 
          timeout: highAccuracy ? 5000 : 10000, 
          maximumAge: highAccuracy ? 0 : 30000 
        }
      );
    };

    if ("geolocation" in navigator) {
      tryGetPosition(true);
    } else {
      setLocating(false);
      const message = language === 'en'
        ? "Geolocation is not supported by this browser."
        : language === 'zh'
        ? "您的浏览器不支持地理定位。"
        : "La geolocalización no está soportada por este navegador.";
      setLocError(message);
      setTimeout(() => setLocError(null), 5000);
    }
  };
  const mapRef = useRef<L.Map | null>(null);

  // 1. Snapshot for stops database
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'stops'), (snapshot) => {
      const stopsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stop));
      setStops(stopsData);
    }, (error) => {
      console.error("Error in stops snapshot:", error);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 1a. Real-time subscriber for routes database
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'routes'), (snapshot) => {
      const routesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route));
      setRoutes(routesData);
    }, (error) => {
      console.error("Error in routes snapshot:", error);
    });
    return () => unsubscribe();
  }, []);

  // 1b. Real-time subscriber for routeStops database
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'routeStops'), (snapshot) => {
      const routeStopsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RouteStop));
      setRouteStops(routeStopsData);
    }, (error) => {
      console.error("Error in routeStops snapshot:", error);
    });
    return () => unsubscribe();
  }, []);

  // 1c. Real-time subscriber for drivers database
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      const driversData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver));
      setDrivers(driversData);
    }, (error) => {
      console.error("Error in drivers snapshot:", error);
    });
    return () => unsubscribe();
  }, []);

  // 1d. Live bus interpolation and passenger proximity ETA tracking hook (Disabled to hide live bus location - user requested "no le salga dónde está la ruta")
  useEffect(() => {
    const map = mapRef.current;
    const group = busMarkersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    setEtaInfo(null);
  }, [selectedRoute]);

  // 2. Real-time location tracking (standard GPS receiver)
  useEffect(() => {
    if (isSimulationMode) return;
    let watchId: number;

    const startTracking = (highAccuracy: boolean) => {
      if (!("geolocation" in navigator)) return;

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(newLoc);
        },
        (error) => {
          console.warn("Tracking location error:", error);
          if (highAccuracy) {
            console.warn("Real-time tracking downgrade to standard accuracy (IP/Wi-Fi)...");
            navigator.geolocation.clearWatch(watchId);
            startTracking(false);
          }
        },
        { 
          enableHighAccuracy: highAccuracy, 
          maximumAge: highAccuracy ? 10000 : 30000, 
          timeout: highAccuracy ? 5000 : 15000 
        }
      );
    };

    startTracking(true);

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isSimulationMode]);

  // 2b. Proximity warning check & Automatic arrival trigger (Runs for both real GPS & simulated manual pins!)
  useEffect(() => {
    if (!userLocation || !selectedRoute || stops.length === 0) return;

    // Check proximity to stops in selected route
    selectedRoute.steps.forEach(step => {
      const stop = stops.find(s => s.id === step.stopId);
      if (stop) {
        const dist = getDistance(userLocation.lat, userLocation.lng, stop.lat, stop.lng);
        // Within 100 meters
        if (dist < 100 && lastAlertedStop.current !== stop.id) {
          setProximityAlert(`Estás cerca de la bahía: ${stop.name}`);
          lastAlertedStop.current = stop.id;
          setTimeout(() => {
            setProximityAlert(null);
          }, 5000);
        }
      }
    });

    // Automatic arrival check: once user is within 40 meters of the destination stop/landmark
    if (!arrivalTriggeredRef.current && onArrival) {
      const finalStep = selectedRoute.steps[selectedRoute.steps.length - 1];
      const finalStop = stops.find(s => s.id === finalStep.stopId);
      if (finalStop) {
        const distToDest = getDistance(userLocation.lat, userLocation.lng, finalStop.lat, finalStop.lng);
        if (distToDest < 40) {
          arrivalTriggeredRef.current = true;
          onArrival();
        }
      } else if (destination) {
        const distToDest = getDistance(userLocation.lat, userLocation.lng, destination.lat, destination.lng);
        if (distToDest < 40) {
          arrivalTriggeredRef.current = true;
          onArrival();
        }
      }
    }
  }, [userLocation, selectedRoute, stops, destination, onArrival]);

  // 3. Leaflet Map setup on load
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Remove any existing map instance and clear Leaflet internal ID to avoid "Map container is already initialized" crash
    if (mapRef.current) {
      try {
        mapRef.current.off();
        mapRef.current.remove();
      } catch (err) {
        console.warn("Previous map cleanup warning:", err);
      }
      mapRef.current = null;
    }

    if ((container as any)._leaflet_id) {
      try {
        delete (container as any)._leaflet_id;
      } catch (err) {
        (container as any)._leaflet_id = undefined;
      }
    }

    let map: L.Map | null = null;
    try {
      // Initialize map with explicit dragging and touch interaction options
      const customCanvasRenderer = L.canvas({ padding: 0.5 });

      map = L.map(container, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        tap: false, // Prevent click/drag lag or block on touch screen devices
        rotate: true, // Enable live rotation support
        bearing: 0,
        rotateControl: false, // Only show our premium custom UI
        touchRotate: true, // Enable direct two-finger pinch gesture to rotate map naturally!
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        zoomSnap: 0, // Continuous fluid zoom matching Google Maps behavior
        zoomDelta: 0.25,
        renderer: customCanvasRenderer
      } as any).setView([12.1364, -86.2514], 13); // Managua center

      // Explicitly guarantee dragging is enabled
      if (map.dragging && !map.dragging.enabled()) {
        map.dragging.enable();
      }

      // Premium light map layers (CartoDB Positron)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }).addTo(map);

      // Zoom buttons styling in bottom right
      L.control.zoom({
        position: 'bottomright'
      }).addTo(map);

      // Minimal elegant attribution in bottom left
      L.control.attribution({
        position: 'bottomleft',
        prefix: false
      }).addTo(map);

      mapRef.current = map;

      // Create groups
      const stopMarkersGroup = L.featureGroup().addTo(map);
      const routePolylineGroup = L.featureGroup().addTo(map);
      const locationMarkersGroup = L.featureGroup().addTo(map);
      const busMarkersGroup = L.featureGroup().addTo(map);

      stopMarkersGroupRef.current = stopMarkersGroup;
      routePolylineGroupRef.current = routePolylineGroup;
      locationMarkersGroupRef.current = locationMarkersGroup;
      busMarkersGroupRef.current = busMarkersGroup;

      // Track active zoom changes to keep HUD synced without unnecessary high-frequency re-renders during drag
      setZoomLevel(map.getZoom());

      map.on('zoomend', () => {
        if (mapRef.current) setZoomLevel(mapRef.current.getZoom());
      });

      map.on('rotate' as any, () => {
        if (mapRef.current) {
          try {
            setRotation((mapRef.current as any).getBearing() || 0);
          } catch (e) {}
        }
      });

      map.on('click', (e: any) => {
        if (isSimulationModeRef.current) {
          const { lat, lng } = e.latlng;
          setUserLocation({ lat, lng });
        }
      });
    } catch (err) {
      console.error("Error creating Leaflet map instance:", err);
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.off();
          mapRef.current.remove();
        } catch (err) {
          console.warn("Leaflet map cleanup ignored:", err);
        }
        mapRef.current = null;
      }
      if (container && (container as any)._leaflet_id) {
        try {
          delete (container as any)._leaflet_id;
        } catch (err) {
          (container as any)._leaflet_id = undefined;
        }
      }
    };
  }, []);

  // 4. Track container resizing so map fits viewport correctly
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || !mapRef.current) return;

    const invalidate = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      invalidate();
    });

    resizeObserver.observe(container);

    // Initial timeout invalidation to fix mobile viewport rendering gaps
    const timer1 = setTimeout(invalidate, 150);
    const timer2 = setTimeout(invalidate, 500);

    window.addEventListener('resize', invalidate);
    window.addEventListener('orientationchange', invalidate);

    return () => {
      resizeObserver.unobserve(container);
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('orientationchange', invalidate);
    };
  }, []);

  // 5. Drawing stop markers
  useEffect(() => {
    const map = mapRef.current;
    const group = stopMarkersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const stopIcon = L.divIcon({
      html: `<div class="bg-white p-1 rounded-full shadow-md border border-zinc-200 hover:scale-110 hover:border-[#0033a0] transition-transform cursor-pointer flex items-center justify-center">
                <div class="bg-[#0033a0]/10 p-1.5 rounded-full text-[#0033a0] flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 11V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7"/><path d="M12 11V2"/><path d="m8 11-2 4a2 2 0 0 0-2 2v2h16v-2a2 2 0 0 0-2-2l-2-4"/><path d="M6 15h12"/><circle cx="8" cy="18" r="1"/><circle cx="16" cy="18" r="1"/></svg>
                </div>
              </div>`,
      className: 'custom-stop-marker-wrapper',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    // Clean up interface: only draw stops that the user will actually use once a route is selected; otherwise, don't show any stops at all (keeps map perfectly clean)
    let stopsToRender: Stop[] = [];
    if (selectedRoute && selectedRoute.steps && selectedRoute.steps.length > 0) {
      const activeStopIds = selectedRoute.steps.map(step => step.stopId);
      stopsToRender = stops.filter(stop => activeStopIds.includes(stop.id));
    }

    stopsToRender.forEach(stop => {
      const marker = L.marker([stop.lat, stop.lng], { icon: stopIcon });

      const popupContent = `
        <div class="p-1 max-w-[240px] font-sans">
          ${stop.photoUrl ? `<img src="${stop.photoUrl}" alt="${stop.name}" class="w-full h-24 object-cover rounded-lg mb-2" referrerPolicy="no-referrer" />` : ''}
          <h3 class="font-black text-zinc-900 text-xs mb-0.5">${stop.name}</h3>
          ${stop.generalInfo ? `
            <div class="bg-zinc-50 p-2 rounded-lg border border-zinc-100 flex gap-1.5 items-start mt-1">
              <span class="text-[#0033a0] mt-0.5 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </span>
              <p class="text-[9px] text-zinc-600 font-bold leading-tight">${stop.generalInfo}</p>
            </div>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 260, className: 'custom-leaflet-popup' });
      group.addLayer(marker);
    });
  }, [stops, selectedRoute]);

  // 6. Drawing location markers (User location, Origin, Destination)
  useEffect(() => {
    const map = mapRef.current;
    const group = locationMarkersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // Draw Origin
    if (selectedRoute && origin) {
      const originIcon = L.divIcon({
        html: `<div class="flex flex-col items-center">
          <div class="w-8 h-8 rounded-full bg-[#0033a0] border-2 border-white shadow-xl flex items-center justify-center text-white relative group">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span class="absolute -bottom-6 bg-zinc-900 text-white font-bold text-[8px] tracking-wider px-1.5 py-0.5 rounded uppercase leading-none border border-zinc-800 pointer-events-none shadow-md">Inicio</span>
          </div>
        </div>`,
        className: 'custom-origin-marker',
        iconSize: [32, 40],
        iconAnchor: [16, 32]
      });
      const marker = L.marker([origin.lat, origin.lng], { icon: originIcon });
      group.addLayer(marker);
    }

    // Draw Destination
    if (selectedRoute && destination) {
      const destIcon = L.divIcon({
        html: `<div class="flex flex-col items-center">
          <div class="w-8 h-8 rounded-full bg-[#e4002b] border-2 border-white shadow-xl flex items-center justify-center text-white relative group">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span class="absolute -bottom-6 bg-zinc-900 text-white font-bold text-[8px] tracking-wider px-1.5 py-0.5 rounded uppercase leading-none border border-zinc-800 pointer-events-none shadow-md">Destino</span>
          </div>
        </div>`,
        className: 'custom-destination-marker',
        iconSize: [32, 40],
        iconAnchor: [16, 32]
      });
      const marker = L.marker([destination.lat, destination.lng], { icon: destIcon });
      group.addLayer(marker);
    }

    // Draw User Location marker
    if (userLocation) {
      const userIcon = L.divIcon({
        html: `<div class="relative flex items-center justify-center">
                  <div class="absolute w-8 h-8 bg-[#0033a0] rounded-full animate-ping opacity-25"></div>
                  <div class="relative w-7 h-7 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-[#0033a0]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-[#0033a0]"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                  </div>
                </div>`,
        className: 'custom-user-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      const marker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon });
      group.addLayer(marker);
    }
  }, [origin, destination, userLocation, selectedRoute]);

  // 6b. Fetch street-conformed routing coordinates from OSRM
  useEffect(() => {
    if (!selectedRoute) {
      setStreetPath([]);
      return;
    }

    const stopCoords: [number, number][] = selectedRoute.steps
      .map(step => {
        const stop = stops.find(s => s.id === step.stopId);
        return stop ? [stop.lat, stop.lng] as [number, number] : null;
      })
      .filter((p): p is [number, number] => p !== null);

    if (stopCoords.length < 2) {
      setStreetPath([]);
      return;
    }

    let isMounted = true;
    setIsLoadingPath(true);

    const fetchStreetRoute = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      try {
        // Construct coordinates list for OSRM URL: "lng,lat;lng,lat;..."
        const coordsQuery = stopCoords.map(([lat, lng]) => `${lng},${lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsQuery}?overview=full&geometries=geojson`;

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`OSRM HTTP error status: ${response.status}`);
        }
        const data = await response.json();

        if (data.routes && data.routes.length > 0 && isMounted) {
          const coordinates = data.routes[0].geometry.coordinates as [number, number][];
          // OSRM coordinates are in [longitude, latitude] format, transform to [latitude, longitude] for Leaflet
          const leafletCoords = coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngExpression);
          setStreetPath(leafletCoords);
        } else if (isMounted) {
          // Fallback directly to straight lines if OSRM doesn't return route shapes
          const pathBackup = stopCoords.map(([lat, lng]) => [lat, lng] as L.LatLngExpression);
          setStreetPath(pathBackup);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        // Soft fallback to stop-to-stop path without triggering error overlays
        if (isMounted) {
          const pathBackup = stopCoords.map(([lat, lng]) => [lat, lng] as L.LatLngExpression);
          setStreetPath(pathBackup);
        }
      } finally {
        if (isMounted) {
          setIsLoadingPath(false);
        }
      }
    };

    fetchStreetRoute();

    return () => {
      isMounted = false;
    };
  }, [selectedRoute, stops]);

  // 7. Drawing selected route polyline
  useEffect(() => {
    const map = mapRef.current;
    const group = routePolylineGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (!selectedRoute) {
      lastRouteIdRef.current = null;
      return;
    }

    const pathStraight: L.LatLngExpression[] = selectedRoute.steps
      .map(step => {
        const stop = stops.find(s => s.id === step.stopId);
        return stop ? ([stop.lat, stop.lng] as L.LatLngExpression) : null;
      })
      .filter(p => p !== null) as L.LatLngExpression[];

    // Prefer streetPath coordinates, fall back to straight point-to-point lines
    const activePath = streetPath.length > 1 ? streetPath : pathStraight;

    if (activePath.length > 1) {
      const canvasRenderer = L.canvas({ padding: 0.5 });

      // Glow background line for beautiful aesthetics
      const glowLine = L.polyline(activePath, {
        color: '#0033a0',
        weight: 9,
        opacity: 0.15,
        lineCap: 'round',
        lineJoin: 'round',
        renderer: canvasRenderer
      });

      // Main line in high contrast blue
      const mainLine = L.polyline(activePath, {
        color: '#0033a0',
        weight: 4,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        renderer: canvasRenderer
      });

      group.addLayer(glowLine);
      group.addLayer(mainLine);

      // Auto fit bounds only if the route has actually changed, representing a distinct user action click
      const routeKey = selectedRoute.steps.map(s => s.stopId).join('-');
      if (routeKey !== lastRouteIdRef.current) {
        lastRouteIdRef.current = routeKey;
        const bounds = L.latLngBounds(activePath);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [selectedRoute, stops, streetPath]);

  // 8. Auto bounding fits whenever landmarks change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Avoid overriding fitbounds immediately if route coordinates just updated
    if (selectedRoute) return;

    const points: L.LatLngExpression[] = [];
    let hasChanges = false;

    if (origin) {
      points.push([origin.lat, origin.lng]);
      if (!lastOriginRef.current || lastOriginRef.current.lat !== origin.lat || lastOriginRef.current.lng !== origin.lng) {
        hasChanges = true;
        lastOriginRef.current = { lat: origin.lat, lng: origin.lng };
      }
    } else if (lastOriginRef.current) {
      hasChanges = true;
      lastOriginRef.current = null;
    }

    if (destination) {
      points.push([destination.lat, destination.lng]);
      if (!lastDestinationRef.current || lastDestinationRef.current.lat !== destination.lat || lastDestinationRef.current.lng !== destination.lng) {
        hasChanges = true;
        lastDestinationRef.current = { lat: destination.lat, lng: destination.lng };
      }
    } else if (lastDestinationRef.current) {
      hasChanges = true;
      lastDestinationRef.current = null;
    }

    // Auto-bound user location ONLY on first load if no start/end markers are set
    if (userLocation && !origin && !destination && !hasBoundedInitialUserLocationRef.current) {
      hasBoundedInitialUserLocationRef.current = true;
      map.setView([userLocation.lat, userLocation.lng], 15);
      return;
    }

    // Fit mapping bounds strictly when manual origin/destination parameters first change
    if (hasChanges && points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [origin, destination, userLocation]);

  return (
    <div className="w-full h-full bg-zinc-200 rounded-3xl overflow-hidden shadow-inner relative border border-zinc-200">
      {/* Location Mode Switcher UI has been removed as requested by the user */}

      {/* Proximity Alert Notification */}
      {proximityAlert && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-sm">
          <div className="bg-[#0033a0] text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce border border-white/20">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Bell size={20} className="text-white animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Alerta de Bahía</p>
              <p className="text-xs font-black">{proximityAlert}</p>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Approaching Bus Telemetry Notification (Disabled as requested to hide "dónde" live position alerts) */}



      {/* Geolocation/GPS Centering Button */}
      <button
        onClick={handleRecenter}
        disabled={locating}
        className="absolute bottom-28 right-6 z-[1000] w-12 h-12 bg-white hover:bg-zinc-50 active:scale-95 text-[#0033a0] rounded-full shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] border border-zinc-200/80 flex items-center justify-center transition-all group cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
        title={language === 'en' ? 'My Location' : language === 'zh' ? '我的位置' : 'Mi Ubicación'}
      >
        <Navigation 
          size={18} 
          className={`fill-[#0033a0] text-[#0033a0] transition-all duration-500 ${locating ? 'animate-pulse scale-110 rotate-45 text-amber-500 fill-amber-500' : 'group-hover:rotate-12'}`} 
        />
      </button>

      {/* Locate Error Message Toast with Immediate Solutions */}
      {locError && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-sm">
          <div className="bg-rose-600 text-white p-4 rounded-2xl shadow-xl flex items-start gap-3 border border-white/15 animate-in fade-in slide-in-from-top-4 duration-300 relative">
            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div className="pr-6 w-full text-left">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-80">
                {language === 'en' ? 'GPS Status' : 'Estado de GPS'}
              </p>
              <p className="text-xs font-black leading-relaxed mb-3">{locError}</p>
              
              <div className="flex flex-wrap gap-2 pt-2.5 border-t border-white/20">
                <button
                  type="button"
                  onClick={() => setShowLocHelp(true)}
                  className="px-2.5 py-1.5 bg-black/25 hover:bg-black/35 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 border border-white/10"
                >
                  💡 {language === 'en' ? 'Troubleshoot' : 'Guía de Solución'}
                </button>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => setLocError(null)}
              className="absolute top-3 right-3 text-white/75 hover:text-white bg-white/10 hover:bg-white/20 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black cursor-pointer transition-all"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* GPS Troubleshooting Modal */}
      {showLocHelp && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] border border-zinc-200 max-w-lg w-full overflow-hidden shadow-2xl relative text-left text-zinc-800 font-sans">
            <div className="p-6 bg-[#0033a0] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                  <span className="text-xl">🛰️</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                    {language === 'en' ? 'GPS & Location Guide' : 'Guía de Ubicación GPS'}
                  </h3>
                  <p className="text-[10px] opacity-90 font-mono tracking-widest uppercase">Solución de Problemas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLocHelp(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer font-black text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              <div>
                <h4 className="text-xs font-black uppercase text-[#0033a0] tracking-wider mb-1.5 flex items-center gap-1.5">
                  🛡️ 1. Bloqueo de WebView / iFrame (AI Studio)
                </h4>
                <p className="text-xs font-semibold text-zinc-500 leading-relaxed">
                  Por seguridad, los navegadores de móviles bloquean el acceso al GPS real cuando la página web se carga en un marco embebido (la previsualización de AI Studio).
                </p>
                <div className="mt-2.5 p-3 bg-blue-50/70 border border-blue-105 rounded-2xl">
                  <p className="text-xs font-black text-[#0033a0] flex items-center gap-2">
                    <span>💡</span> {language === 'en' ? 'Direct URL Solution:' : 'Solución Inmediata:'}
                  </p>
                  <p className="text-[11px] font-bold text-zinc-600 mt-1 leading-normal">
                    Toca en <strong>"Shared URL / Abrir en pestaña nueva"</strong> arriba a la derecha en AI Studio para cargar la aplicación directamente en la barra de tu navegador Safari o Chrome, desbloqueando el GPS.
                  </p>
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4">
                <h4 className="text-xs font-black uppercase text-[#0033a0] tracking-wider mb-1.5 flex items-center gap-1.5">
                  ⚙️ 2. Permisos del Navegador en el Móvil
                </h4>
                
                <div className="space-y-3">
                  <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-200/80">
                    <p className="text-xs font-black text-zinc-700 flex items-center gap-2 mb-1">
                      🤖 En Chrome (Android/PC)
                    </p>
                    <p className="text-[11px] font-medium text-zinc-500 leading-relaxed">
                      Toca el ícono de candado o configuración junto al enlace URL ➡️ selecciona <strong>Configuración del sitio / Permisos</strong> ➡️ cambia <strong>Ubicación</strong> a "Permitir" o "Autorizar".
                    </p>
                  </div>

                  <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-200/80">
                    <p className="text-xs font-black text-zinc-700 flex items-center gap-2 mb-1">
                      🍏 En Safari (iPhone/iOS)
                    </p>
                    <p className="text-[11px] font-medium text-zinc-500 leading-relaxed">
                      Ve a la app de Configuración de iOS ➡️ <strong>Privacidad y seguridad</strong> ➡️ <strong>Localización</strong> ➡️ asegúrate de que **Sitios web de Safari** esté activo "Al usar la app". Además, dentro de Safari toca los ajustes ("aA") para habilitar "Ubicación".
                    </p>
                  </div>
                </div>
              </div>


            </div>

            <div className="p-4 bg-zinc-100 border-t border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLocHelp(false)}
                className="px-5 py-2.5 bg-zinc-850 hover:bg-zinc-950 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding / Location Prompt Banner when real GPS is empty and non-simulation */}
      {!userLocation && !isSimulationMode && !dismissedPrompt && !locating && (
        <div className="absolute bottom-6 left-6 right-6 sm:left-6 sm:right-auto sm:max-w-sm z-[1001] animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-zinc-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] relative text-left">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setDismissedPrompt(true)}
              className="absolute top-4 right-4 w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
              title={language === 'en' ? 'Close' : 'Cerrar'}
            >
              ✕
            </button>

            {/* Insecure HTTP Context Alert (The primary reason mobile views fail to prompt) */}
            {typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-amber-600">
                  <span className="text-xl">⚠️</span>
                  <p className="text-xs font-black uppercase tracking-wider">
                    {language === 'en' ? 'Insecure HTTP Connection' : 'Conexión HTTP Insegura'}
                  </p>
                </div>
                <p className="text-xs font-semibold text-zinc-500 leading-relaxed">
                  {language === 'en'
                    ? "Your phone is connected via HTTP. Modern browsers strictly block GPS access in non-HTTPS connections. Please share/open the secure HTTPS URL instead!"
                    : "Estás accediendo mediante HTTP. Los navegadores de celulares bloquean el GPS por seguridad en conexiones no cifradas. Por favor, abre el enlace seguro ('https://...')."}
                </p>
              </div>
            ) : (
              // Secure Context - Standard Permission Onboarding Triggered by User Gesture
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-[#0033a0]">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center font-bold text-lg animate-pulse">
                    📡
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#0033a0]">
                      {language === 'en' ? 'Enable Live GPS' : '¿Activar tu GPS Real?'}
                    </h4>
                    <p className="text-[9px] font-mono opacity-85 tracking-widest uppercase text-[#0033a0]">NicaGo Navigation</p>
                  </div>
                </div>
                
                <p className="text-xs font-semibold text-zinc-500 leading-relaxed">
                  {language === 'en'
                    ? "Welcome! To display your real-time position on the map and receive direction alerts, we need your coordinate permission."
                    : "¡Hola! Para mostrar tu posición real en el mapa sobre el vehículo y darte avisos de llegada, necesitamos tu permiso de ubicación."}
                </p>

                <div className="flex flex-col gap-2 pt-1 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => {
                      handleRecenter();
                    }}
                    className="w-full py-2.5 bg-[#0033a0] hover:bg-blue-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95 text-center flex items-center justify-center gap-2 cursor-pointer"
                  >
                    🚀 {language === 'en' ? 'Allow & Center GPS' : 'Autorizar y Centrar GPS'}
                  </button>
                  
                  <div className="flex justify-center items-center text-[10px] font-bold text-zinc-400 px-1 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowLocHelp(true)}
                      className="hover:text-[#0033a0] hover:underline transition-all cursor-pointer flex items-center gap-1"
                    >
                      💡 {language === 'en' ? 'Help guide & troubleshooting' : 'Ver guía de ayuda y resolución'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaflet Map Div */}
      <div ref={mapContainerRef} className="w-full h-full" id="nicago-leaflet-map" />
    </div>
  );
}
