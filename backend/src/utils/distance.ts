/**
 * Calcule la distance entre deux points GPS (formule de Haversine)
 * @returns distance en kilomètres
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100; // Arrondi à 2 décimales
};

const toRad = (value: number): number => {
  return (value * Math.PI) / 180;
};

/**
 * Calcule le prix d'une course en fonction de la distance
 */
export const calculateCoursePrice = (
  distance: number,
  dureeMinutes: number,
  tarif: { prixBase: number; prixParKm: number; prixParMinute: number; fraisService: number }
): number => {
  const prixDistance = distance * tarif.prixParKm;
  const prixTemps = dureeMinutes * tarif.prixParMinute;
  const sousTotal = tarif.prixBase + prixDistance + prixTemps;
  const total = sousTotal * (1 + tarif.fraisService);
  
  return Math.round(total);
};

/**
 * Estime la durée d'un trajet (vitesse moyenne 30 km/h en ville)
 */
export const estimateDuration = (distance: number): number => {
  const vitesseMoyenne = 30; // km/h
  const dureeHeures = distance / vitesseMoyenne;
  const dureeMinutes = Math.ceil(dureeHeures * 60);
  
  return dureeMinutes;
};

/**
 * Calcule l'ETA (Estimated Time of Arrival) en minutes
 */
export const calculateETA = (
  currentLat: number,
  currentLon: number,
  destLat: number,
  destLon: number
): number => {
  const distance = calculateDistance(currentLat, currentLon, destLat, destLon);
  return estimateDuration(distance);
};
