import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Route, Stop, RouteStop, RouteOption, PathStep, Schedule } from '../types';

export class RouteService {
  static async getAllRoutes(): Promise<Route[]> {
    const snapshot = await getDocs(collection(db, 'routes'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route));
  }

  static async getAllStops(): Promise<Stop[]> {
    const snapshot = await getDocs(collection(db, 'stops'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stop));
  }

  static async getRouteStops(): Promise<RouteStop[]> {
    const snapshot = await getDocs(collection(db, 'routeStops'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RouteStop));
  }

  static async getSchedules(): Promise<Schedule[]> {
    const snapshot = await getDocs(collection(db, 'schedules'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule));
  }

  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static async findBestRoutes(
    origin: { lat: number; lng: number; address?: string },
    destination: { lat: number; lng: number; address?: string }
  ): Promise<RouteOption[]> {
    const routes = await this.getAllRoutes();
    const stops = await this.getAllStops();
    const routeStops = await this.getRouteStops();
    const schedules = await this.getSchedules();

    if (stops.length === 0) return [];

    // 1. Find multiple candidate stops close to origin and destination (up to 4 closest, max 2.5 km)
    const startCandidates = stops
      .map(stop => ({
        stop,
        distance: this.calculateDistance(origin.lat, origin.lng, stop.lat, stop.lng)
      }))
      .filter(item => item.distance <= 2.5)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);

    const endCandidates = stops
      .map(stop => ({
        stop,
        distance: this.calculateDistance(destination.lat, destination.lng, stop.lat, stop.lng)
      }))
      .filter(item => item.distance <= 2.5)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);

    // Fallbacks if no candidates are found within 2.5 km
    if (startCandidates.length === 0 && stops.length > 0) {
      const closest = stops.reduce((prev, curr) => {
        const prevDist = this.calculateDistance(origin.lat, origin.lng, prev.lat, prev.lng);
        const currDist = this.calculateDistance(origin.lat, origin.lng, curr.lat, curr.lng);
        return currDist < prevDist ? curr : prev;
      });
      startCandidates.push({ stop: closest, distance: this.calculateDistance(origin.lat, origin.lng, closest.lat, closest.lng) });
    }

    if (endCandidates.length === 0 && stops.length > 0) {
      const closest = stops.reduce((prev, curr) => {
        const prevDist = this.calculateDistance(destination.lat, destination.lng, prev.lat, prev.lng);
        const currDist = this.calculateDistance(destination.lat, destination.lng, curr.lat, curr.lng);
        return currDist < prevDist ? curr : prev;
      });
      endCandidates.push({ stop: closest, distance: this.calculateDistance(destination.lat, destination.lng, closest.lat, closest.lng) });
    }

    const directOptions: RouteOption[] = [];
    const transferOptions: RouteOption[] = [];

    // Evaluate all pairs of start and end candidate stops to find any potential routes
    for (const startCand of startCandidates) {
      const startStop = startCand.stop;
      for (const endCand of endCandidates) {
        const endStop = endCand.stop;
        if (startStop.id === endStop.id) continue;

        // 2. Find Direct routes
        for (const route of routes) {
          const stopsInRoute = routeStops
            .filter(rs => rs.routeId === route.id)
            .sort((a, b) => Number(a.sequence) - Number(b.sequence));
          
          const startIndex = stopsInRoute.findIndex(rs => rs.stopId === startStop.id);
          const endIndex = stopsInRoute.findIndex(rs => rs.stopId === endStop.id);

          if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
            const stopCount = endIndex - startIndex;
            const routeSchedules = schedules
              .filter(s => s.routeId === route.id && s.stopId === startStop.id)
              .map(s => s.arrivalTime || s.time)
              .sort();

            const charSum = route.name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + (route.code ? route.code.charCodeAt(0) : 0);
            const etaToBoardMinutes = (charSum % 11) + 3; // between 3 and 13 minutes

            directOptions.push({
              steps: [
                {
                  type: 'board',
                  routeId: route.id,
                  stopId: startStop.id,
                  description: `Aborda la ruta ${route.code} en ${startStop.name}`,
                  stopCount,
                  time: routeSchedules[0] // Show the earliest available time
                },
                {
                  type: 'ride',
                  routeId: route.id,
                  stopId: endStop.id,
                  description: `Recorre ${stopCount} paradas hasta ${endStop.name}`,
                  stopCount
                }
              ],
              totalStops: stopCount,
              estimatedTimeMinutes: stopCount * 3 + 5,
              schedules: routeSchedules,
              etaToBoardMinutes
            });
          }
        }

        // 3. Simple Transfer Search (One transfer)
        const startRoutes = routeStops.filter(rs => rs.stopId === startStop.id).map(rs => rs.routeId);
        const endRoutes = routeStops.filter(rs => rs.stopId === endStop.id).map(rs => rs.routeId);

        for (const sRouteId of startRoutes) {
          const sRouteStops = routeStops.filter(rs => rs.routeId === sRouteId);
          for (const eRouteId of endRoutes) {
            if (sRouteId === eRouteId) continue;
            
            const eRouteStops = routeStops.filter(rs => rs.routeId === eRouteId);
            const intersection = sRouteStops.find(srs => eRouteStops.some(ers => ers.stopId === srs.stopId));
            
            if (intersection) {
              const sRoute = routes.find(r => r.id === sRouteId);
              const eRoute = routes.find(r => r.id === eRouteId);
              if (!sRoute || !eRoute) continue;

              const interStop = stops.find(s => s.id === intersection.stopId);
              if (!interStop) continue;

              const sStartIndexObj = sRouteStops.find(rs => rs.stopId === startStop.id);
              const eEndIndexObj = eRouteStops.find(rs => rs.stopId === endStop.id);
              if (!sStartIndexObj || !eEndIndexObj) continue;

              const sStartIndex = sStartIndexObj.sequence;
              const sInterIndex = intersection.sequence;
              
              const eInterIndexObj = eRouteStops.find(rs => rs.stopId === interStop.id);
              if (!eInterIndexObj) continue;
              const eInterIndex = eInterIndexObj.sequence;
              const eEndIndex = eEndIndexObj.sequence;

              if (sStartIndex < sInterIndex && eInterIndex < eEndIndex) {
                const totalStops = (sInterIndex - sStartIndex) + (eEndIndex - eInterIndex);
                const routeSchedules = schedules
                  .filter(s => s.routeId === sRoute.id && s.stopId === startStop.id)
                  .map(s => s.arrivalTime || s.time)
                  .sort();

                const charSum = sRoute.name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + (sRoute.code ? sRoute.code.charCodeAt(0) : 0);
                const etaToBoardMinutes = (charSum % 11) + 6; // between 6 and 16 minutes for transfer board

                transferOptions.push({
                  steps: [
                    {
                      type: 'board',
                      routeId: sRoute.id,
                      stopId: startStop.id,
                      description: `Aborda la ruta ${sRoute.code} en ${startStop.name}`,
                      time: routeSchedules[0]
                    },
                    {
                      type: 'transfer',
                      routeId: eRoute.id,
                      stopId: interStop.id,
                      description: `Bájate en ${interStop.name} y transborda a la ruta ${eRoute.code}`
                    },
                    {
                      type: 'ride',
                      routeId: eRoute.id,
                      stopId: endStop.id,
                      description: `Llega a tu destino en ${endStop.name}`
                    }
                  ],
                  totalStops,
                  estimatedTimeMinutes: totalStops * 3 + 15,
                  schedules: routeSchedules,
                  etaToBoardMinutes
                });
              }
            }
          }
        }
      }
    }

    // 4. Direct Route/ID/Name Search Fallback
    // If user's search queries match any Route's database ID, code, or name, we explicitly construct a direct route choice.
    const searchTerms = [origin.address, destination.address]
      .map(t => t ? t.trim().toLowerCase() : '')
      .filter(Boolean);

    if (searchTerms.length > 0) {
      const matchedRoutes = routes.filter(r => {
        return searchTerms.some(term => {
          if (!term) return false;
          const rId = r.id ? r.id.toLowerCase() : '';
          const rCode = r.code ? r.code.toLowerCase() : '';
          const rName = r.name ? r.name.toLowerCase() : '';
          return rId === term || 
                 rCode === term || 
                 rCode.includes(term) || 
                 rName.includes(term) || 
                 term.includes(rCode) || 
                 term.includes(rName);
        });
      });

      for (const mRoute of matchedRoutes) {
        const stopsInRoute = routeStops
          .filter(rs => rs.routeId === mRoute.id)
          .sort((a, b) => Number(a.sequence) - Number(b.sequence));

        if (stopsInRoute.length > 0) {
          const startRS = stopsInRoute[0];
          const endRS = stopsInRoute[stopsInRoute.length - 1];
          const startStop = stops.find(s => s.id === startRS.stopId);
          const endStop = stops.find(s => s.id === endRS.stopId);

          if (startStop && endStop) {
            const stopCount = Math.max(stopsInRoute.length - 1, 1);
            const routeSchedules = schedules
              .filter(s => s.routeId === mRoute.id && s.stopId === startStop.id)
              .map(s => s.arrivalTime || s.time)
              .sort();

            const charSum = mRoute.name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) + (mRoute.code ? mRoute.code.charCodeAt(0) : 0);
            const etaToBoardMinutes = (charSum % 11) + 3;

            const alreadyExists = directOptions.some(opt => 
              opt.steps.some(step => step.routeId === mRoute.id)
            );

            if (!alreadyExists) {
              directOptions.push({
                steps: [
                  {
                    type: 'board',
                    routeId: mRoute.id,
                    stopId: startStop.id,
                    description: `Aborda la ruta ${mRoute.code || mRoute.name} en ${startStop.name}`,
                    stopCount,
                    time: routeSchedules[0] || '06:00'
                  },
                  {
                    type: 'ride',
                    routeId: mRoute.id,
                    stopId: endStop.id,
                    description: `Recorre ${stopCount} paradas hasta ${endStop.name}`,
                    stopCount
                  }
                ],
                totalStops: stopCount,
                estimatedTimeMinutes: stopCount * 3 + 5,
                schedules: routeSchedules,
                etaToBoardMinutes
              });
            }
          }
        }
      }
    }

    const combinedOptions = [...directOptions, ...transferOptions];

    // Double-pass deduplication logic:
    // 1. Deduplicate by route-sequence (e.g. "R1" or "R1->R2") so users see only one choice per unique path setup
    // 2. Filter redundant segments
    const uniqueOptionsMap = new Map<string, RouteOption>();

    for (const option of combinedOptions) {
      // Extract unique sequential route IDs used in this option (filtering out consecutive duplicates)
      const routeSeq: string[] = [];
      for (const step of option.steps) {
        if (step.routeId) {
          if (routeSeq.length === 0 || routeSeq[routeSeq.length - 1] !== step.routeId) {
            routeSeq.push(step.routeId);
          }
        }
      }

      // Check if there are any non-consecutive duplicate route IDs (e.g. Route A -> Route B -> Route A)
      const hasDuplicateInSequence = new Set(routeSeq).size !== routeSeq.length;
      if (hasDuplicateInSequence) {
        continue;
      }

      // Generate Route ID Sequence Fingerprint
      const routeSeqFingerprint = option.steps
        .map(s => s.routeId)
        .filter(Boolean)
        .join('->');

      // Generate Visual Step Fingerprint
      const visualFingerprint = option.steps
        .map(step => {
          const stop = stops.find(s => s.id === step.stopId);
          const stopName = stop ? stop.name.trim().toLowerCase() : '';
          const route = step.routeId ? routes.find(r => r.id === step.routeId) : null;
          const routeCode = (route && route.code) ? route.code.trim().toUpperCase() : '';
          return `${step.type}:${routeCode}:${stopName}`;
        })
        .join(' | ');

      // Use a combined key of route sequence and visual fingerprint to fully avoid duplicated options
      const dedupeKey = `${routeSeqFingerprint}_${visualFingerprint}`;

      const existing = uniqueOptionsMap.get(dedupeKey);
      if (!existing) {
        uniqueOptionsMap.set(dedupeKey, option);
      } else {
        const currTime = option.estimatedTimeMinutes;
        const prevTime = existing.estimatedTimeMinutes;
        const currStops = option.totalStops;
        const prevStops = existing.totalStops;

        if (currTime < prevTime || (currTime === prevTime && currStops < prevStops)) {
          uniqueOptionsMap.set(dedupeKey, option);
        }
      }
    }

    // Now, further thin out redundant identical route-sequences (preferring the most optimal stops option)
    const finalThinMap = new Map<string, RouteOption>();
    for (const option of uniqueOptionsMap.values()) {
      const routeSeqFingerprint = option.steps
        .map(s => s.routeId)
        .filter(Boolean)
        .join('->');

      const existing = finalThinMap.get(routeSeqFingerprint);
      if (!existing) {
        finalThinMap.set(routeSeqFingerprint, option);
      } else {
        const currTime = option.estimatedTimeMinutes;
        const prevTime = existing.estimatedTimeMinutes;
        const currStops = option.totalStops;
        const prevStops = existing.totalStops;

        if (currTime < prevTime || (currTime === prevTime && currStops < prevStops)) {
          finalThinMap.set(routeSeqFingerprint, option);
        }
      }
    }

    const uniqueOptionsList = Array.from(finalThinMap.values());

    // Sort to prioritize those that pass first (lowest etaToBoardMinutes) or arrive sooner (lowest estimatedTimeMinutes)
    const sortedOptions = uniqueOptionsList.sort((a, b) => {
      const aFirst = a.etaToBoardMinutes ?? 99;
      const bFirst = b.etaToBoardMinutes ?? 99;
      if (aFirst !== bFirst) {
        return aFirst - bFirst;
      }
      return a.estimatedTimeMinutes - b.estimatedTimeMinutes;
    });

    // Return top 8 options
    return sortedOptions.slice(0, 8);
  }
}
