export interface Route {
  id: string;
  name: string; // Commercial name
  code: string; // License Plate (Placa)
  color: string;
  photoUrl?: string; // Unit photo
  driverId?: string;
  status: 'bad' | 'good' | 'excellent';
}

export interface Driver {
  id: string;
  name: string;
  age: number;
  photoUrl: string; // Driver face photo
  idCardPhotoUrl: string; // Cédula
  licensePhotoUrl: string; // License photo
  phoneNumber: string; // Phone number string
  experience: string; // Work experience
  generalInfo: string;
}

export interface ReportMessage {
  id: string;
  senderId: string; // 'admin' or uid of passenger
  senderName: string;
  text: string;
  createdAt: string;
}

export interface Report {
  id: string;
  userId: string;
  userName?: string;
  type: 'route' | 'stop' | 'driver';
  reportTarget?: 'route' | 'driver' | 'both';
  targetId: string; // ID of the route, stop, or driver
  driverId?: string;
  reason: 'drunk' | 'reckless' | 'bad_condition' | 'other';
  description: string;
  status: 'pending' | 'read' | 'resolved';
  adminResponse?: string;
  messages?: ReportMessage[];
  createdAt: string;
}

export interface Favorite {
  id: string;
  userId: string;
  routeId: string;
  createdAt: string;
}

export interface HistoryItem {
  id: string;
  userId: string;
  origin: string;
  destination: string;
  routeId?: string;
  createdAt: string;
}

export interface Stop {
  id: string;
  name: string; // Name or Number
  lat: number;
  lng: number;
  photoUrl?: string;
  generalInfo?: string;
}

export interface RouteStop {
  id: string;
  routeId: string;
  stopId: string;
  sequence: number; // Order in the route
  arrivalTime: string; // HH:mm format
  departureTime: string; // HH:mm format
}

// Keeping Schedule just in case or for legacy, but RouteStop will be the primary source now
export interface Schedule {
  id: string;
  routeId: string;
  stopId: string;
  arrivalTime: string; 
  departureTime: string;
  time: string; 
}

export interface PathStep {
  type: 'board' | 'transfer' | 'walk' | 'ride';
  routeId?: string;
  stopId: string;
  description: string;
  stopCount?: number;
  time?: string; // Passing time
}

export interface RouteOption {
  steps: PathStep[];
  totalStops: number;
  estimatedTimeMinutes: number;
  schedules?: string[]; // List of available times at the starting stop
  etaToBoardMinutes?: number; // Minutes until the bus arrives at the starting stop
}

export type UserRole = 'superadmin' | 'admin' | 'passenger' | 'driver';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  phoneNumber?: string;
  username?: string;
  password?: string;
  role: UserRole;
  assignedRouteId?: string;
  assignedRouteCode?: string;
  createdAt: string;
}

export interface TouristPost {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  category: string;
  coverPhoto: string;
  galleryPhotos: string[];
  schedule: string;
  entryFee?: string;
  destinationStopId?: string;
  destinationStopName: string;
  recommendedRoutes?: string[];
  createdAt: string;
}

export function isBoatRoute(routeName?: string): boolean {
  if (!routeName) return false;
  const lower = routeName.toLowerCase();
  return lower.includes('barco') || 
         lower.includes('boat') || 
         lower.includes('ferry') || 
         lower.includes('lancha') || 
         lower.includes('bote') || 
         lower.includes('embarcación') ||
         lower.includes('embarcacion') ||
         lower.includes('marítim') ||
         lower.includes('maritim') ||
         lower.includes('colectivo acuático') ||
         lower.includes('acuátic') ||
         lower.includes('acuatic') ||
         lower.includes('lago') ||
         lower.includes('allende'); // Puerto Salvador Allende water tour boats
}

