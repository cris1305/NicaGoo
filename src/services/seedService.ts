import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Route, Stop, RouteStop, Driver, Schedule } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

import busImg1 from '../assets/images/managua_bus_route_1_1786548148778.jpg';
import busImg2 from '../assets/images/managua_bus_route_2_1786548159770.jpg';
import busImg3 from '../assets/images/managua_bus_route_3_1786548170710.jpg';

// Coordinates for the 5 key connection points (Bahías/Paradas) of Managua
const FIVE_CONNECTION_STOPS = [
  { 
    name: 'Bahía UCA (Pista Juan Pablo II)', 
    lat: 12.1264, 
    lng: -86.2714, 
    generalInfo: 'Punto de conexión #1: Ubicada frente al portón principal de la Universidad Centroamericana (UCA). Interconexión neurálgica.', 
    photoUrl: busImg1 
  },
  { 
    name: 'Bahía Metrocentro (Avenida de Masaya)', 
    lat: 12.1284, 
    lng: -86.2654, 
    generalInfo: 'Punto de conexión #2: Estación central frente a Metrocentro y Plaza El Sol.', 
    photoUrl: busImg2 
  },
  { 
    name: 'Bahía Plaza Inter (Lomas de Tiscapa)', 
    lat: 12.1444, 
    lng: -86.2724, 
    generalInfo: 'Punto de conexión #3: Bahía junto a Plaza Inter y acceso a la Avenida Bolívar.', 
    photoUrl: busImg3 
  },
  { 
    name: 'Bahía Puerto Salvador Allende (Dupla Norte)', 
    lat: 12.1610, 
    lng: -86.2710, 
    generalInfo: 'Punto de conexión #4: Estación turística a orillas del Lago Xolotlán.', 
    photoUrl: busImg1 
  },
  { 
    name: 'Bahía Mercado Roberto Huembes (Pista Solidaridad)', 
    lat: 12.1154, 
    lng: -86.2414, 
    generalInfo: 'Punto de conexión #5: Estación del Mercado Roberto Huembes y Terminal de Autobuses.', 
    photoUrl: busImg2 
  }
];

// 5 Interconnected Routes
const FIVE_CONNECTION_ROUTES = [
  { 
    name: 'Ruta 101 (UCA - Salvador Allende)', 
    code: 'M101', 
    color: '#0033a0', 
    status: 'excellent' as const, 
    photoUrl: busImg1,
    stopIndices: [0, 1, 2, 3] // UCA -> Metrocentro -> Plaza Inter -> Salvador Allende
  },
  { 
    name: 'Ruta 105 (UCA - Mercado Huembes)', 
    code: 'M105', 
    color: '#10b981', 
    status: 'excellent' as const, 
    photoUrl: busImg2,
    stopIndices: [0, 1, 4] // UCA -> Metrocentro -> Mercado Huembes
  },
  { 
    name: 'Ruta 114 (Huembes - Plaza Inter)', 
    code: 'T114', 
    color: '#7c3aed', 
    status: 'good' as const, 
    photoUrl: busImg3,
    stopIndices: [4, 1, 2] // Mercado Huembes -> Metrocentro -> Plaza Inter
  },
  { 
    name: 'Ruta 119 (UCA - Salvador Allende Express)', 
    code: 'O119', 
    color: '#ec4899', 
    status: 'excellent' as const, 
    photoUrl: busImg1,
    stopIndices: [0, 2, 3] // UCA -> Plaza Inter -> Salvador Allende
  },
  { 
    name: 'Ruta 120 (Mercado Huembes - Salvador Allende)', 
    code: 'M120', 
    color: '#06b6d4', 
    status: 'excellent' as const, 
    photoUrl: busImg2,
    stopIndices: [4, 0, 3] // Mercado Huembes -> UCA -> Salvador Allende
  }
];

const MANAGUA_DRIVERS_DATA = [
  { name: 'Juan Pérez Miranda', age: 38, photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400' },
  { name: 'Marcos Zelaya Duarte', age: 42, photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400' },
  { name: 'Elena García Solís', age: 35, photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400' },
  { name: 'Carlos Mendoza Ortega', age: 47, photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400' },
  { name: 'Ana Ruiz Blandón', age: 29, photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=400' }
];

// Helper to pad numbers with leading zeros (e.g. 6 -> "06")
const padNum = (n: number): string => n < 10 ? `0${n}` : `${n}`;

export const clearDatabase = async () => {
  try {
    const collectionsToClear = ['routes', 'stops', 'routeStops', 'drivers', 'schedules', 'reports', 'favorites', 'history', 'users', 'touristPosts'];
    for (const colName of collectionsToClear) {
      const snap = await getDocs(collection(db, colName));
      const promises = snap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(promises);
    }
    console.log('Database cleared completely!');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'clear_data');
  }
};

export const seedDatabase = async () => {
  try {
    console.log('Clearing database first to ensure clean seed...');
    await clearDatabase();

    console.log('Seeding fresh new 10x10x10 dataset...');

    // 1. Seed 10 Drivers
    const driverIds: string[] = [];
    for (let i = 0; i < MANAGUA_DRIVERS_DATA.length; i++) {
      const driver = MANAGUA_DRIVERS_DATA[i];
      const docRef = await addDoc(collection(db, 'drivers'), {
        name: driver.name,
        age: driver.age,
        photoUrl: driver.photoUrl,
        licensePhotoUrl: 'https://images.unsplash.com/photo-1554224155-1696413565d3?auto=format&fit=crop&q=80&w=400',
        idCardPhotoUrl: 'https://images.unsplash.com/photo-1554224155-1696413565d3?auto=format&fit=crop&q=80&w=400',
        phoneNumber: `+505 8${padNum(Math.floor(Math.random() * 90) + 10)}-${padNum(Math.floor(Math.random() * 90) + 10)}${padNum(Math.floor(Math.random() * 90) + 10)}`,
        experience: `${Math.floor(Math.random() * 15) + 5} años de experiencia conduciendo autobuses urbanos de Managua.`,
        generalInfo: 'Conductor capacitado en relaciones humanas, seguridad vial y primeros auxilios.'
      });
      driverIds.push(docRef.id);
    }

    // 2. Seed 5 Connection Stops (Bays)
    const stopIds: string[] = [];
    for (let i = 0; i < FIVE_CONNECTION_STOPS.length; i++) {
      const stop = FIVE_CONNECTION_STOPS[i];
      const docRef = await addDoc(collection(db, 'stops'), stop);
      stopIds.push(docRef.id);
    }

    // 3. Seed 5 Interconnected Routes
    for (let i = 0; i < FIVE_CONNECTION_ROUTES.length; i++) {
      const routeData = FIVE_CONNECTION_ROUTES[i];
      const driverId = driverIds[i % driverIds.length] || null;
      
      const { stopIndices, ...cleanRouteProps } = routeData;
      const routeRef = await addDoc(collection(db, 'routes'), {
        ...cleanRouteProps,
        driverId
      });

      // Base schedule morning starting times for this route
      const baseMinutes = [
        360,  // 06:00
        435,  // 07:15
        510,  // 08:30
        600,  // 10:00
        735,  // 12:15
        870,  // 14:30
        1005, // 16:45
        1110  // 18:30
      ];

      for (let seq = 0; seq < stopIndices.length; seq++) {
        const stopIndex = stopIndices[seq];
        const stopId = stopIds[stopIndex];

        // Travel transit delay is roughly 15 minutes per stop sequence
        const stopTransitOffset = seq * 15;

        // Arrival / departure times formatted helper
        const formatTime = (totalMin: number) => {
          const hour = Math.floor(totalMin / 60) % 24;
          const min = totalMin % 60;
          return `${padNum(hour)}:${padNum(min)}`;
        };

        const firstArrivalMin = baseMinutes[0] + stopTransitOffset;
        const firstDepartureMin = firstArrivalMin + 5; // 5 mins stops for boarding

        // Save Route Stop layout connection
        await addDoc(collection(db, 'routeStops'), {
          routeId: routeRef.id,
          stopId,
          sequence: seq,
          arrivalTime: formatTime(firstArrivalMin),
          departureTime: formatTime(firstDepartureMin)
        });

        // Add corresponding schedule list per stop
        for (const baseMin of baseMinutes) {
          const stopArrivalMin = baseMin + stopTransitOffset;
          const stopDepartureMin = stopArrivalMin + 5;
          const arrivalTimeStr = formatTime(stopArrivalMin);
          const departureTimeStr = formatTime(stopDepartureMin);

          await addDoc(collection(db, 'schedules'), {
            routeId: routeRef.id,
            stopId,
            arrivalTime: arrivalTimeStr,
            departureTime: departureTimeStr,
            time: arrivalTimeStr // legacy compatibility support
          });
        }
      }
    }

    // 4. Seed Mock Users
    const mockUsers = [
      { name: 'Abelardo Solórzano', email: 'abelardo.solorzano@correo.ni', role: 'passenger', phoneNumber: '+505 8899-2311', photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200', createdAt: '2026-05-15T14:30:00.000Z' },
      { name: 'Blanca Estela Treminio', email: 'blanca.estela@yahoo.com', role: 'passenger', phoneNumber: '+505 7744-8855', photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200', createdAt: '2026-05-18T10:15:00.000Z' },
      { name: 'Cristopher Ramírez', email: 'cristopheramirez20@gmail.com', role: 'admin', phoneNumber: '+505 8456-7890', photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200', createdAt: '2026-05-01T08:00:00.000Z' },
      { name: 'Denis José Mayorga', email: 'denis.mayorga@gmail.com', role: 'passenger', phoneNumber: '+505 8122-3344', photoUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200', createdAt: '2026-05-20T16:45:00.000Z' },
      { name: 'Fabiola Vanessa Ortiz', email: 'fabiola.ortiz@outlook.com', role: 'passenger', phoneNumber: '+505 8677-4499', photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200', createdAt: '2026-05-22T11:20:00.000Z' },
      { name: 'Guillermo Antonio Sequeira', email: 'g.sequeira@gmail.com', role: 'passenger', phoneNumber: '+505 5566-7788', photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200', createdAt: '2026-05-24T09:10:00.000Z' }
    ];

    for (const u of mockUsers) {
      await addDoc(collection(db, 'users'), u);
    }

    // 5. Seed Tourist / Promotional Posts
    const touristPostsData = [
      {
        title: 'Puerto Salvador Allende',
        subtitle: 'Malecón & Paseo del Lago Xolotlán',
        description: 'El destino turístico #1 de Managua a orillas del Lago Xolotlán. Ofrece restaurantes gastronómicos, paseos en bote, juegos infantiles, pista de Go Karts y el Paseo de los Leones.',
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
        title: 'Lomas de Tiscapa & Canopy',
        subtitle: 'Reserva Natural Cráter de Tiscapa',
        description: 'Parque histórico y mirador natural sobre el cráter de la Laguna de Tiscapa. Destaca la efigie monumental del General Sandino y tirolesa canopy extrema sobre la laguna.',
        category: 'Parque & Mirador',
        coverPhoto: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800',
        galleryPhotos: [
          'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800',
          'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&q=80&w=800'
        ],
        schedule: 'Todos los días: 6:00 AM - 6:00 PM',
        entryFee: 'Acceso Gratuito (Canopy C$ 150)',
        destinationStopName: 'Bahía Plaza Inter (Lomas de Tiscapa)',
        recommendedRoutes: ['Ruta 105', 'Ruta 125'],
        createdAt: new Date().toISOString()
      },
      {
        title: 'Palacio Nacional de la Cultura',
        subtitle: 'Centro Histórico de Managua',
        description: 'Joya neoclásica frente a la Plaza de la Revolución. Alberga el Museo Nacional con piezas arqueológicas precolombinas, pintura contemporánea y salones coloniales.',
        category: 'Cultura & Museo',
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
        title: 'Mercado Artesanal Roberto Huembes',
        subtitle: 'Feria de Artesanías & Gastronomía',
        description: 'El punto neurálgico de las artesanías nicaragüenses: hamacas de Masaya, tallados en madera, calzado de cuero, dulces tradicionales y comedores de comida típica.',
        category: 'Artesanías & Gastronomía',
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
      },
      {
        title: 'Zona Nocturna Bello Horizonte',
        subtitle: 'Gastronomía & Música en Vivo',
        description: 'Zona de alta concurrencia gastronómica y musical. Famosa por sus asados tradicionales, mariachis, bares familiares y ambiente festivo nocturno.',
        category: 'Vida Nocturna',
        coverPhoto: 'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?auto=format&fit=crop&q=80&w=800',
        galleryPhotos: [
          'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?auto=format&fit=crop&q=80&w=800'
        ],
        schedule: 'Abierto 24 Horas (Zona Comercial)',
        entryFee: 'Acceso Libre',
        destinationStopName: 'Bahía Bello Horizonte (Rotonda de los Pollos)',
        recommendedRoutes: ['Ruta 102', 'Ruta 125'],
        createdAt: new Date().toISOString()
      }
    ];

    for (const post of touristPostsData) {
      // Find stop id matching destinationStopName if present
      const matchedStopIndex = FIVE_CONNECTION_STOPS.findIndex(s => s.name === post.destinationStopName);
      const destinationStopId = matchedStopIndex >= 0 ? stopIds[matchedStopIndex] : undefined;
      await addDoc(collection(db, 'touristPosts'), {
        ...post,
        destinationStopId
      });
    }

    console.log('Seeding 10x10x10 and Tourist Posts successful under Firestore and local context!');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed_data');
  }
};
