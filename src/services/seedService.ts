import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Route, Stop, RouteStop, Driver, Schedule } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

// Coordinates for the 10 most common locations in Managua
const MANAGUA_STOPS_DATA = [
  { 
    name: 'Bahía Plaza Inter (Lomas de Tiscapa)', 
    lat: 12.1444, 
    lng: -86.2724, 
    generalInfo: 'Bahía principal junto al Centro Comercial Plaza Inter, excelente para conectar con la Avenida de Bolívar a Chávez.', 
    photoUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    name: 'Bahía Puerto Salvador Allende (Dupla Norte)', 
    lat: 12.1610, 
    lng: -86.2710, 
    generalInfo: 'Estación turística ubicada frente a la entrada principal del Puerto Salvador Allende, a orillas del Lago Xolotlán.', 
    photoUrl: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    name: 'Bahía Metrocentro (Avenida de Masaya)', 
    lat: 12.1284, 
    lng: -86.2654, 
    generalInfo: 'Estación central de alta afluencia frente a la entrada de Metrocentro y Plaza El Sol.', 
    photoUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    name: 'Bahía UCA (Pista de La Resistencia)', 
    lat: 12.1264, 
    lng: -86.2714, 
    generalInfo: 'Ubicada frente al portón principal de la Universidad Centroamericana, es el punto neurálgico para interurbanos.', 
    photoUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    name: 'Bahía Multicentro Las Américas (Rotonda)', 
    lat: 12.1384, 
    lng: -86.2294, 
    generalInfo: 'Ubicada en la entrada comercial este del mall Multicentro Las Américas, zona sumamente populosa.', 
    photoUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    name: 'Bahía Galerías Santo Domingo (Masaya Hwy)', 
    lat: 12.0984, 
    lng: -86.2504, 
    generalInfo: 'Ubicada sobre Carretera a Masaya, facilita el acceso a Galerías y residenciales aledaños.', 
    photoUrl: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    name: 'Bahía Linda Vista (Pista Juan Pablo II)', 
    lat: 12.1524, 
    lng: -86.3074, 
    generalInfo: 'Estación neurálgica de la zona occidental de Managua, cercana a zonas industriales y residenciales.', 
    photoUrl: 'https://images.unsplash.com/photo-1444724414314-11811a14130c?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    name: 'Bahía Mercado Roberto Huembes (Pista Solidaridad)', 
    lat: 12.1154, 
    lng: -86.2414, 
    generalInfo: 'Ubicada en el costado sur de las inmediaciones del populoso Mercado Roberto Huembes.', 
    photoUrl: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    name: 'Bahía Palacio Nacional (Plaza de la Revolución)', 
    lat: 12.1534, 
    lng: -86.2714, 
    generalInfo: 'Frente al Palacio Nacional de la Cultura, punto histórico y de gran interés cultural en el centro histórico.', 
    photoUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=400' 
  },
  { 
    name: 'Bahía Bello Horizonte (Rotonda de los Pollos)', 
    lat: 12.1414, 
    lng: -86.2444, 
    generalInfo: 'Localizada en la popular rotonda de Bello Horizonte, rodeada de comercios y zonas de recreación nocturnas.', 
    photoUrl: 'https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?auto=format&fit=crop&q=80&w=400' 
  }
];

const MANAGUA_ROUTES_DATA = [
  { name: 'Ruta 101 (UCA - Salvador Allende)', code: 'M101-99', color: '#0033a0', status: 'excellent' as const, photoUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800' },
  { name: 'Ruta 102 (Metrocentro - Bello Horizonte)', code: 'M102-15', color: '#e4002b', status: 'good' as const, photoUrl: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&q=80&w=800' },
  { name: 'Ruta 105 (Plaza Inter - Galerías)', code: 'M105-88', color: '#10b981', status: 'excellent' as const, photoUrl: 'https://images.unsplash.com/photo-1494510614310-79a1d5a896d4?auto=format&fit=crop&q=80&w=800' },
  { name: 'Ruta 110 (Linda Vista - Huembes)', code: 'M110-24', color: '#f59e0b', status: 'excellent' as const, photoUrl: 'https://images.unsplash.com/photo-1557223562-6c77ef16210f?auto=format&fit=crop&q=80&w=800' },
  { name: 'Ruta 114 (Multicentro - Palacio Nacional)', code: 'T114-45', color: '#7c3aed', status: 'good' as const, photoUrl: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&q=80&w=800' },
  { name: 'Ruta 119 (Linda Vista - Portón UCA)', code: 'O119-12', color: '#ec4899', status: 'bad' as const, photoUrl: 'https://images.unsplash.com/photo-1561361531-99e46a74659f?auto=format&fit=crop&q=80&w=800' },
  { name: 'Ruta 120 (Galerías - Puerto Allende)', code: 'M120-07', color: '#06b6d4', status: 'excellent' as const, photoUrl: 'https://images.unsplash.com/photo-1619542402915-dcaf30e4e2a1?auto=format&fit=crop&q=80&w=800' },
  { name: 'Ruta 125 (Plaza Inter - Bello Horizonte)', code: 'M125-66', color: '#f97316', status: 'good' as const, photoUrl: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?auto=format&fit=crop&q=80&w=800' },
  { name: 'Ruta 133 (Mercado Huembes - Metrocentro)', code: 'M133-31', color: '#84cc16', status: 'excellent' as const, photoUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&q=80&w=800' },
  { name: 'Ruta 168 (Linda Vista - Multicentro)', code: 'M168-54', color: '#64748b', status: 'good' as const, photoUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&q=80&w=800' }
];

const MANAGUA_DRIVERS_DATA = [
  { name: 'Juan Pérez Miranda', age: 38, photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400' },
  { name: 'Marcos Zelaya Duarte', age: 42, photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400' },
  { name: 'Elena García Solís', age: 35, photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400' },
  { name: 'Carlos Mendoza Ortega', age: 47, photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400' },
  { name: 'Ana Ruiz Blandón', age: 29, photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=400' },
  { name: 'Roberto López Torres', age: 51, photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400' },
  { name: 'Gabriela Ortega Ruiz', age: 33, photoUrl: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&q=80&w=400' },
  { name: 'Héctor Castillo Rivera', age: 41, photoUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=400' },
  { name: 'Sofía Martínez Valle', age: 31, photoUrl: 'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&q=80&w=400' },
  { name: 'Mario Gómez Montenegro', age: 45, photoUrl: 'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?auto=format&fit=crop&q=80&w=400' }
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

    // 2. Seed 10 Stops (Bays)
    const stopIds: string[] = [];
    for (let i = 0; i < MANAGUA_STOPS_DATA.length; i++) {
      const stop = MANAGUA_STOPS_DATA[i];
      const docRef = await addDoc(collection(db, 'stops'), stop);
      stopIds.push(docRef.id);
    }

    // 3. Seed 10 Routes, map with cyclic sliding stops and generate rich schedules
    for (let i = 0; i < MANAGUA_ROUTES_DATA.length; i++) {
      const routeData = MANAGUA_ROUTES_DATA[i];
      // Assign unique driver to each route
      const driverId = driverIds[i] || null;
      const routeRef = await addDoc(collection(db, 'routes'), {
        ...routeData,
        driverId
      });

      // Assign a cyclic sliding window of 6 stops for each route
      // Route i will pass through: i, i+1, i+2, i+3, i+4, i+5 (wrapped by 10)
      const stopsCount = 6;
      const routeStopIndices: number[] = [];
      for (let s = 0; s < stopsCount; s++) {
        routeStopIndices.push((i + s) % 10);
      }

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

      for (let seq = 0; seq < routeStopIndices.length; seq++) {
        const stopIndex = routeStopIndices[seq];
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
      const matchedStopIndex = MANAGUA_STOPS_DATA.findIndex(s => s.name === post.destinationStopName);
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
