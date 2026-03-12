/**
 * Zones interdites aux tricycles à Abidjan
 * Selon l'arrêté du Ministre-Gouverneur du District d'Abidjan
 */

export interface RestrictedZone {
  id: string;
  nom: string;
  description: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  type: 'polygon' | 'line';
  buffer?: number; // Distance en mètres autour de la ligne
}

/**
 * Liste des zones interdites aux tricycles
 */
export const RESTRICTED_ZONES: RestrictedZone[] = [
  {
    id: 'boulevard-fhb',
    nom: 'Boulevard Félix Houphouët-Boigny',
    description: 'Du carrefour Akwaba au pont FHB',
    type: 'line',
    buffer: 50, // 50m de chaque côté
    coordinates: [
      { latitude: 5.3599, longitude: -4.0083 }, // Carrefour Akwaba
      { latitude: 5.3400, longitude: -4.0200 },
      { latitude: 5.3247, longitude: -4.0300 }, // Pont FHB
    ],
  },
  {
    id: 'boulevard-lagunaire',
    nom: 'Boulevard Lagunaire',
    description: 'Du pont Général De Gaulle au Monument aux Martyrs',
    type: 'line',
    buffer: 50,
    coordinates: [
      { latitude: 5.3200, longitude: -4.0250 }, // Pont De Gaulle
      { latitude: 5.3150, longitude: -4.0180 },
      { latitude: 5.3100, longitude: -4.0100 }, // Monument aux Martyrs
    ],
  },
  {
    id: 'boulevard-republique',
    nom: 'Boulevard de la République',
    description: 'Place de la République - Cité Policière - INHP',
    type: 'line',
    buffer: 50,
    coordinates: [
      { latitude: 5.3247, longitude: -4.0127 }, // Place de la République
      { latitude: 5.3280, longitude: -4.0150 }, // Cité Policière
      { latitude: 5.3320, longitude: -4.0180 }, // INHP
    ],
  },
  {
    id: 'boulevard-latrille',
    nom: 'Boulevard Latrille',
    description: 'Du Sofitel Hôtel Ivoire à Angré Petro Ivoire',
    type: 'line',
    buffer: 50,
    coordinates: [
      { latitude: 5.3364, longitude: -4.0267 }, // Sofitel
      { latitude: 5.3450, longitude: -4.0150 },
      { latitude: 5.3550, longitude: -4.0050 }, // Angré Petro Ivoire
    ],
  },
  {
    id: 'avenue-attoban',
    nom: 'Avenue Robert Beugré Mambé (ex-Attoban)',
    description: 'Terminus 81/82 au rond-point Marie-Thérèse HB',
    type: 'line',
    buffer: 50,
    coordinates: [
      { latitude: 5.3650, longitude: -3.9950 }, // Terminus 81/82
      { latitude: 5.3700, longitude: -4.0000 },
      { latitude: 5.3750, longitude: -4.0050 }, // Rond-point MTHB
    ],
  },
  {
    id: 'boulevard-france',
    nom: 'Boulevard Marie-Thérèse Houphouët-Boigny',
    description: 'Église Saint-Jean - Université FHB - Riviera Golf',
    type: 'line',
    buffer: 50,
    coordinates: [
      { latitude: 5.3500, longitude: -3.9900 }, // Église Saint-Jean
      { latitude: 5.3600, longitude: -3.9850 }, // Université FHB
      { latitude: 5.3700, longitude: -3.9800 }, // Riviera Golf
    ],
  },
  {
    id: 'boulevard-mitterrand',
    nom: 'Boulevard Germain Coffi Gadeau (ex-Mitterrand)',
    description: 'Lycée Technique au rond-point Feh Kessé',
    type: 'line',
    buffer: 50,
    coordinates: [
      { latitude: 5.3450, longitude: -4.0350 }, // Lycée Technique
      { latitude: 5.3500, longitude: -4.0300 },
      { latitude: 5.3550, longitude: -4.0250 }, // Rond-point Feh Kessé
    ],
  },
  {
    id: 'rue-jardins',
    nom: 'Rue des Jardins',
    description: 'CHU de Cocody au Zoo d\'Abidjan',
    type: 'line',
    buffer: 50,
    coordinates: [
      { latitude: 5.3600, longitude: -3.9950 }, // CHU Cocody
      { latitude: 5.3650, longitude: -3.9900 },
      { latitude: 5.3700, longitude: -3.9850 }, // Zoo
    ],
  },
  {
    id: 'voie-ciad-mpouto',
    nom: 'Voie CIAD - M\'Pouto',
    description: 'Rond-point CIAD M\'Pouto au carrefour Mitterrand',
    type: 'line',
    buffer: 50,
    coordinates: [
      { latitude: 5.3400, longitude: -4.0400 }, // CIAD M'Pouto
      { latitude: 5.3450, longitude: -4.0350 },
      { latitude: 5.3500, longitude: -4.0300 }, // Carrefour Mitterrand
    ],
  },
  {
    id: 'pont-hkb',
    nom: 'Pont Henri-Konan Bédié',
    description: 'Pont HKB (3ème pont)',
    type: 'line',
    buffer: 100,
    coordinates: [
      { latitude: 5.3100, longitude: -4.0050 },
      { latitude: 5.3120, longitude: -4.0030 },
      { latitude: 5.3140, longitude: -4.0010 },
    ],
  },
  {
    id: 'pont-alassane-ouattara',
    nom: 'Pont Alassane Ouattara',
    description: 'Pont Alassane Ouattara',
    type: 'line',
    buffer: 100,
    coordinates: [
      { latitude: 5.3050, longitude: -4.0100 },
      { latitude: 5.3070, longitude: -4.0080 },
      { latitude: 5.3090, longitude: -4.0060 },
    ],
  },
  {
    id: 'quatrieme-pont',
    nom: '4ème Pont',
    description: '4ème pont d\'Abidjan',
    type: 'line',
    buffer: 100,
    coordinates: [
      { latitude: 5.2950, longitude: -4.0150 },
      { latitude: 5.2970, longitude: -4.0130 },
      { latitude: 5.2990, longitude: -4.0110 },
    ],
  },
];

/**
 * Vérifie si un point est dans une zone interdite
 */
export function isPointInRestrictedZone(
  latitude: number,
  longitude: number
): { isRestricted: boolean; zone?: RestrictedZone } {
  for (const zone of RESTRICTED_ZONES) {
    if (zone.type === 'line') {
      // Vérifier la distance par rapport à la ligne
      const distance = getDistanceToLine(
        latitude,
        longitude,
        zone.coordinates
      );
      if (distance <= (zone.buffer || 50)) {
        return { isRestricted: true, zone };
      }
    } else if (zone.type === 'polygon') {
      // Vérifier si le point est dans le polygone
      if (isPointInPolygon(latitude, longitude, zone.coordinates)) {
        return { isRestricted: true, zone };
      }
    }
  }
  return { isRestricted: false };
}

/**
 * Calcule la distance minimale d'un point à une ligne (polyligne)
 */
function getDistanceToLine(
  lat: number,
  lon: number,
  lineCoordinates: Array<{ latitude: number; longitude: number }>
): number {
  let minDistance = Infinity;

  for (let i = 0; i < lineCoordinates.length - 1; i++) {
    const p1 = lineCoordinates[i];
    const p2 = lineCoordinates[i + 1];
    const distance = getDistanceToSegment(lat, lon, p1, p2);
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

/**
 * Calcule la distance d'un point à un segment de ligne
 */
function getDistanceToSegment(
  lat: number,
  lon: number,
  p1: { latitude: number; longitude: number },
  p2: { latitude: number; longitude: number }
): number {
  const R = 6371e3; // Rayon de la Terre en mètres

  // Convertir en radians
  const φ1 = (p1.latitude * Math.PI) / 180;
  const φ2 = (p2.latitude * Math.PI) / 180;
  const φ = (lat * Math.PI) / 180;
  const λ1 = (p1.longitude * Math.PI) / 180;
  const λ2 = (p2.longitude * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;

  // Distance du point à p1
  const d1 = getDistance(lat, lon, p1.latitude, p1.longitude);
  // Distance du point à p2
  const d2 = getDistance(lat, lon, p2.latitude, p2.longitude);
  // Distance entre p1 et p2
  const d12 = getDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);

  // Si le segment est très court, retourner la distance au point le plus proche
  if (d12 < 1) {
    return Math.min(d1, d2);
  }

  // Calculer la projection du point sur le segment
  const t = Math.max(
    0,
    Math.min(
      1,
      ((lat - p1.latitude) * (p2.latitude - p1.latitude) +
        (lon - p1.longitude) * (p2.longitude - p1.longitude)) /
        (Math.pow(p2.latitude - p1.latitude, 2) +
          Math.pow(p2.longitude - p1.longitude, 2))
    )
  );

  const projLat = p1.latitude + t * (p2.latitude - p1.latitude);
  const projLon = p1.longitude + t * (p2.longitude - p1.longitude);

  return getDistance(lat, lon, projLat, projLon);
}

/**
 * Calcule la distance entre deux points (formule de Haversine)
 */
function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Vérifie si un point est dans un polygone (algorithme ray-casting)
 */
function isPointInPolygon(
  lat: number,
  lon: number,
  polygon: Array<{ latitude: number; longitude: number }>
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Vérifie si un trajet traverse une zone interdite
 */
export function doesRouteIntersectRestrictedZone(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): { intersects: boolean; zones: RestrictedZone[] } {
  const intersectedZones: RestrictedZone[] = [];

  // Vérifier le point de départ
  const startCheck = isPointInRestrictedZone(startLat, startLon);
  if (startCheck.isRestricted && startCheck.zone) {
    intersectedZones.push(startCheck.zone);
  }

  // Vérifier le point d'arrivée
  const endCheck = isPointInRestrictedZone(endLat, endLon);
  if (endCheck.isRestricted && endCheck.zone) {
    if (!intersectedZones.find((z) => z.id === endCheck.zone!.id)) {
      intersectedZones.push(endCheck.zone);
    }
  }

  // Vérifier des points intermédiaires (échantillonnage)
  const steps = 10;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const lat = startLat + t * (endLat - startLat);
    const lon = startLon + t * (endLon - startLon);
    const check = isPointInRestrictedZone(lat, lon);
    if (check.isRestricted && check.zone) {
      if (!intersectedZones.find((z) => z.id === check.zone!.id)) {
        intersectedZones.push(check.zone);
      }
    }
  }

  return {
    intersects: intersectedZones.length > 0,
    zones: intersectedZones,
  };
}
