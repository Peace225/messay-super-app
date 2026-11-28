/** MESSAY – courses tricycle réelles, sans simulation GPS ou conducteur. */
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import api from './api';
import { courseService } from './courseService';

export interface Tricycle {
  id: string;
  latitude: number;
  longitude: number;
  driverName: string;
  rating: number;
  distance: number;
  eta: number;
  price: number;
  vehicle?: string;
  plate?: string;
  phone?: string;
}

export interface Driver {
  id: string;
  name: string;
  vehicle?: string;
  plate?: string;
  phone?: string;
  rating?: number;
  photo?: string;
}

type RideId = string | number;
export type RideEvent = {
  rideId: RideId;
  driver?: Driver;
  lat?: number;
  lng?: number;
  status?: string;
};
export type CreateRideInput = {
  pickup: string;
  dest: string;
  pickupCoords: { latitude: number; longitude: number };
  service: 'course' | 'colis';
  prix: number;
  pay: 'cash' | 'momo';
  op: string;
  destCoords: { latitude: number; longitude: number };
};
export type CreateRideResult = { rideId: string; status?: string; driver?: Driver };
type Subscriber = (event: RideEvent) => void;
type RecordValue = Record<string, unknown>;

function asObject(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue : null;
}
function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function validCoords(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}
function rideIdOf(raw: unknown): string | null {
  const value = asObject(raw);
  if (!value) return null;
  const nested = asObject(value.ride) ?? asObject(value.course) ?? asObject(value.data);
  const id = value.rideId ?? value.courseId ?? value.id ??
    nested?.rideId ?? nested?.courseId ?? nested?.id;
  return (typeof id === 'string' || typeof id === 'number') && String(id).trim()
    ? String(id) : null;
}
function driverOf(raw: unknown): Driver | undefined {
  const value = asObject(raw);
  if (!value) return undefined;
  const course = asObject(value.course);
  const driver = asObject(value.driver) ?? asObject(value.conducteur) ??
    asObject(course?.driver) ?? asObject(course?.conducteur);
  if (!driver) return undefined;
  const id = driver.id ?? driver.userId;
  if (typeof id !== 'string' && typeof id !== 'number') return undefined;
  const user = asObject(driver.user);
  const tricycle = asObject(driver.tricycle);
  const firstAndLast = [asString(user?.prenom), asString(user?.nom)].filter(Boolean).join(' ');
  const name = asString(driver.name) ?? firstAndLast ?? asString(driver.nom) ?? '';
  if (!name.trim()) return undefined;
  return {
    id: String(id), name,
    vehicle: asString(driver.vehicle) ?? asString(tricycle?.modele),
    plate: asString(driver.plate) ?? asString(tricycle?.immatriculation),
    phone: asString(driver.phone) ?? asString(driver.telephone) ?? asString(user?.telephone),
    rating: numberOrUndefined(driver.rating),
    photo: asString(driver.photo) ?? asString(user?.photo),
  };
}
function driverEvent(raw: unknown): RideEvent | null {
  const rideId = rideIdOf(raw);
  const driver = driverOf(raw);
  return rideId && driver ? { rideId, driver } : null;
}
function locationEvent(raw: unknown): RideEvent | null {
  const value = asObject(raw);
  if (!value) return null;
  const rideId = rideIdOf(value);
  const coordinates = asObject(value.location) ?? asObject(value.position) ?? value;
  const lat = numberOrUndefined(coordinates.lat ?? coordinates.latitude);
  const lng = numberOrUndefined(coordinates.lng ?? coordinates.longitude);
  if (!rideId || lat === undefined || lng === undefined || !validCoords(lat, lng)) return null;
  return { rideId, lat, lng };
}
function getSocketUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();
  const apiBase = api.defaults.baseURL?.trim() ?? process.env.EXPO_PUBLIC_API_URL?.trim();
  const url = (configured || apiBase?.replace(/\/api\/?$/i, '') || '').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) throw new Error('URL du serveur Socket.IO non configurée.');
  return url;
}
function requireToken(): string {
  const token = useAuthStore.getState().accessToken;
  if (!token) throw new Error('Connectez-vous à MESSAY pour commander une course.');
  return token;
}

class TricycleServiceManager {
  private socket: Socket | null = null;
  private connectedToken: string | null = null;
  private currentRideId: string | null = null;
  private accepted = new Set<Subscriber>();
  private locations = new Set<Subscriber>();
  private cancelled = new Set<Subscriber>();
  private pendingAcceptance = new Set<string>();
  private generation = 0;

  private joinCurrentCourse = () => {
    if (this.currentRideId && this.socket?.connected) {
      this.socket.emit('join-course', { courseId: this.currentRideId });
    }
  };

  private refreshCurrentRide = async (id: string, generation = this.generation): Promise<void> => {
    try {
      const course = await courseService.getCourseById(id);
      if (generation !== this.generation || this.currentRideId !== id) return;
      if (course.statut === 'ANNULEE' || course.statut === 'TERMINEE') {
        this.cancelled.forEach(cb => cb({ rideId: id, status: course.statut }));
        this.clearRide(id);
        return;
      }
      if (course.statut === 'ACCEPTEE' || course.statut === 'EN_COURS') {
        const event = driverEvent({ courseId: id, conducteur: course.conducteur });
        if (event) this.accepted.forEach(cb => cb(event));
        const gps = course as typeof course & {
          positionLiveLatitude?: number | null;
          positionLiveLongitude?: number | null;
        };
        const lat = gps.positionLiveLatitude;
        const lng = gps.positionLiveLongitude;
        if (typeof lat === 'number' && typeof lng === 'number' && validCoords(lat, lng)) {
          this.locations.forEach(cb => cb({ rideId: id, lat, lng }));
        }
      }
    } catch (error) {
      console.warn('[MESSAY/TRICYCLE] Synchronisation course impossible :', error);
    }
  };

  private handleAccepted = (raw: unknown) => {
    const id = rideIdOf(raw);
    if (!id) return;
    if (!this.currentRideId) {
      if (this.pendingAcceptance.size >= 10) this.pendingAcceptance.clear();
      this.pendingAcceptance.add(id);
    } else if (id === this.currentRideId) {
      void this.refreshCurrentRide(id);
    }
  };

  private handleLocation = (raw: unknown) => {
    const event = locationEvent(raw);
    if (event && event.rideId === this.currentRideId) {
      this.locations.forEach(cb => cb(event));
    }
  };

  private handleStatusChanged = (raw: unknown) => {
    const id = rideIdOf(raw);
    if (id && id === this.currentRideId) void this.refreshCurrentRide(id);
  };

  private handleCancellation = (raw: unknown) => {
    const id = rideIdOf(raw);
    if (!id || id !== this.currentRideId) return;
    void this.refreshCurrentRide(id); // Statut confirmé par PostgreSQL / API.
  };

  connect(_userId?: string): { disconnect: () => void } {
    const authToken = requireToken();
    if (this.socket && this.connectedToken === authToken) {
      if (!this.socket.connected) this.socket.connect();
      return { disconnect: () => this.disconnect() };
    }
    this.disconnect();
    this.connectedToken = authToken;
    const socket = io(getSocketUrl(), {
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    this.socket = socket;
    socket.on('connect', () => {
      this.joinCurrentCourse();
      if (this.currentRideId) void this.refreshCurrentRide(this.currentRideId);
    });
    socket.on('connect_error', err => console.warn('[MESSAY/TRICYCLE] Socket :', err.message));
    socket.on('course_accepted', this.handleAccepted);
    socket.on('ride_accepted', this.handleAccepted);
    socket.on('status-changed', this.handleStatusChanged);
    socket.on('course_cancelled', this.handleCancellation);
    socket.on('course_annulee', this.handleCancellation);
    socket.on('course_finished', this.handleStatusChanged);
    socket.on('driver_location', this.handleLocation);
    socket.on('driver-location', this.handleLocation);
    return { disconnect: () => this.disconnect() };
  }

  disconnect(): void {
    ++this.generation;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.connectedToken = null;
    this.currentRideId = null;
    this.accepted.clear();
    this.locations.clear();
    this.cancelled.clear();
    this.pendingAcceptance.clear();
  }

  private clearRide(id: string): void {
    if (this.currentRideId !== id) return;
    this.socket?.emit('leave-course', { courseId: id });
    this.currentRideId = null;
    this.pendingAcceptance.delete(id);
  }

  /** Permet de reprendre une course existante après navigation ou redémarrage de l'écran. */
  setCurrentRideId(id: string | null): void {
    const previous = this.currentRideId;
    if (previous && previous !== id) this.socket?.emit('leave-course', { courseId: previous });
    this.currentRideId = id;
    if (id) {
      this.joinCurrentCourse();
      void this.refreshCurrentRide(id);
    }
  }

  async createRide(data: CreateRideInput): Promise<CreateRideResult> {
    requireToken();
    if (data.service !== 'course') throw new Error('Le transport de colis nécessite une API dédiée.');
    if (!validCoords(data.pickupCoords.latitude, data.pickupCoords.longitude) ||
        !validCoords(data.destCoords.latitude, data.destCoords.longitude)) {
      throw new Error('Coordonnées de départ ou de destination invalides.');
    }
    // Le tarif client ne fait pas autorité : seul le backend calcule le montant.
    const course = await courseService.createCourse({
      departLatitude: data.pickupCoords.latitude,
      departLongitude: data.pickupCoords.longitude,
      departAdresse: data.pickup,
      destinationLatitude: data.destCoords.latitude,
      destinationLongitude: data.destCoords.longitude,
      destinationAdresse: data.dest,
    });
    if (!course?.id) throw new Error('Course créée sans identifiant confirmé ; consultez votre historique.');
    const id = String(course.id);
    this.setCurrentRideId(id);
    if (this.pendingAcceptance.has(id) || course.statut === 'ACCEPTEE' || course.statut === 'EN_COURS') {
      void this.refreshCurrentRide(id);
    }
    this.pendingAcceptance.clear();
    return { rideId: id, status: course.statut };
  }

  onRideAccepted(callback: Subscriber): () => void {
    this.accepted.add(callback);
    return () => { this.accepted.delete(callback); };
  }
  onDriverLocation(callback: Subscriber): () => void {
    this.locations.add(callback);
    return () => { this.locations.delete(callback); };
  }
  onRideCancelled(callback: Subscriber): () => void {
    this.cancelled.add(callback);
    return () => { this.cancelled.delete(callback); };
  }

  async findNearby(latitude: number, longitude: number): Promise<Tricycle[]> {
    if (!validCoords(latitude, longitude)) throw new Error('Position GPS invalide.');
    const drivers = await courseService.findNearbyDrivers(latitude, longitude);
    return drivers.filter(d =>
      d.positionLatitude !== null && d.positionLongitude !== null &&
      validCoords(d.positionLatitude, d.positionLongitude)
    ).map(d => ({
      id: d.id,
      latitude: d.positionLatitude!, longitude: d.positionLongitude!,
      driverName: [d.user?.prenom, d.user?.nom].filter(Boolean).join(' ') || 'Conducteur',
      rating: d.rating,
      distance: d.distanceKm,
      eta: 0, // Aucune estimation fictive.
      price: 0, // Tarif calculé exclusivement au backend.
      vehicle: d.tricycle?.modele,
    }));
  }

  async requestRide(_tricycleId: string, _destination?: unknown): Promise<never> {
    throw new Error('Utilisez createRide() pour réserver une course réelle via /courses.');
  }
  isServiceConnected(): boolean { return Boolean(this.socket?.connected); }
  getCurrentRideId(): string | null { return this.currentRideId; }
}

export const tricycleService = new TricycleServiceManager();
