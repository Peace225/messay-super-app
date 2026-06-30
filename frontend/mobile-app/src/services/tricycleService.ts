// src/services/tricycleService.ts
import { Alert } from 'react-native';

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
  name: string;
  vehicle: string;
  plate: string;
  phone: string;
  rating: number;
  photo?: string;
}

type LocationCallback = (data: { lat: number; lng: number }) => void;
type RideCallback = (data: { driver: Driver }) => void;

class TricycleServiceManager {
  private driverLocationInterval: ReturnType<typeof setInterval> | null = null;
  private rideAcceptedTimeout: ReturnType<typeof setTimeout> | null = null;
  private isConnected = false;
  private currentRideId: string | null = null;

  connect(userId?: string) {
    if (this.isConnected) {
      this.disconnect();
    }
    
    this.isConnected = true;
    console.log('🛺 Connecté au service:', userId || 'anonymous');
    
    return {
      disconnect: () => this.disconnect()
    };
  }

  disconnect() {
    this.isConnected = false;
    this.currentRideId = null;
    
    if (this.driverLocationInterval) {
      clearInterval(this.driverLocationInterval);
      this.driverLocationInterval = null;
    }
    
    if (this.rideAcceptedTimeout) {
      clearTimeout(this.rideAcceptedTimeout);
      this.rideAcceptedTimeout = null;
    }
    
    console.log('🔌 Déconnecté du service');
  }

  async createRide(rideData: any) {
    try {
      if (!this.isConnected) {
        this.connect();
      }
      
      console.log('📝 Création course:', rideData);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.currentRideId = 'RIDE_' + Date.now();
      
      return { 
        rideId: this.currentRideId, 
        status: 'searching',
        createdAt: new Date().toISOString(),
        ...rideData 
      };
    } catch (error) {
      console.error('Erreur createRide:', error);
      throw error;
    }
  }

  onDriverLocation(callback: LocationCallback) {
    // Nettoie l'ancien interval
    if (this.driverLocationInterval) {
      clearInterval(this.driverLocationInterval);
    }

    // Simulation trajet Yopougon → Plateau
    let lat = 5.357;
    let lng = -4.01;
    let step = 0;
    const maxSteps = 20;
    
    this.driverLocationInterval = setInterval(() => {
      step++;
      
      // Mouvement réaliste avec légère variation
      lat += 0.0004 + (Math.random() * 0.0002);
      lng += 0.0003 + (Math.random() * 0.0002);
      
      callback({ lat, lng });
      
      if (step >= maxSteps) {
        this.clearDriverLocation();
      }
    }, 2000);

    return () => this.clearDriverLocation();
  }

  private clearDriverLocation() {
    if (this.driverLocationInterval) {
      clearInterval(this.driverLocationInterval);
      this.driverLocationInterval = null;
    }
  }

  onRideAccepted(callback: RideCallback) {
    if (this.rideAcceptedTimeout) {
      clearTimeout(this.rideAcceptedTimeout);
    }

    // Simule acceptation après 2.5s
    this.rideAcceptedTimeout = setTimeout(() => {
      const drivers = [
        {
          name: 'Moussa Diabaté',
          vehicle: 'TVS King',
          plate: 'AB 1234 CI',
          phone: '+2250701234567',
          rating: 4.8,
        },
        {
          name: 'Awa Koné',
          vehicle: 'Bajaj RE',
          plate: 'AB 5678 CI',
          phone: '+2250702345678',
          rating: 4.9,
        },
        {
          name: 'Ibrahim Traoré',
          vehicle: 'TVS King',
          plate: 'AB 9012 CI',
          phone: '+2250703456789',
          rating: 4.7,
        }
      ];
      
      const randomDriver = drivers[Math.floor(Math.random() * drivers.length)];
      
      callback({ driver: randomDriver });
    }, 2500);

    return () => {
      if (this.rideAcceptedTimeout) {
        clearTimeout(this.rideAcceptedTimeout);
        this.rideAcceptedTimeout = null;
      }
    };
  }

  async findNearby(latitude: number, longitude: number): Promise<Tricycle[]> {
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Chauffeurs réels Abidjan avec positions variées
      return [
        {
          id: 'tri_001',
          latitude: latitude + 0.002,
          longitude: longitude + 0.001,
          driverName: 'Moussa Diabaté',
          rating: 4.8,
          distance: 0.3,
          eta: 2,
          price: 500,
          vehicle: 'TVS King',
          plate: 'AB 1234 CI',
          phone: '+2250701234567',
        },
        {
          id: 'tri_002',
          latitude: latitude - 0.0015,
          longitude: longitude + 0.002,
          driverName: 'Awa Koné',
          rating: 4.9,
          distance: 0.5,
          eta: 3,
          price: 500,
          vehicle: 'Bajaj RE',
          plate: 'AB 5678 CI',
          phone: '+2250702345678',
        },
        {
          id: 'tri_003',
          latitude: latitude + 0.001,
          longitude: longitude - 0.002,
          driverName: 'Ibrahim Traoré',
          rating: 4.7,
          distance: 0.7,
          eta: 4,
          price: 500,
          vehicle: 'TVS King',
          plate: 'AB 9012 CI',
          phone: '+2250703456789',
        },
        {
          id: 'tri_004',
          latitude: latitude - 0.002,
          longitude: longitude - 0.001,
          driverName: 'Kouadio Kouamé',
          rating: 4.6,
          distance: 0.9,
          eta: 5,
          price: 500,
          vehicle: 'Piaggio Ape',
          plate: 'AB 3456 CI',
          phone: '+2250704567890',
        },
      ];
    } catch (error) {
      console.error('Erreur findNearby:', error);
      return [];
    }
  }

  async requestRide(tricycleId: string, destination?: any) {
    try {
      Alert.alert(
        '✅ Course confirmée', 
        `Tricycle #${tricycleId} arrive dans 2 min`,
        [{ text: 'OK', style: 'default' }]
      );
      
      return { 
        success: true, 
        rideId: this.currentRideId || 'RIDE_' + Date.now(),
        tricycleId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erreur requestRide:', error);
      Alert.alert('Erreur', 'Impossible de commander. Réessayez.');
      return { success: false, error };
    }
  }

  // Méthode utilitaire
  isServiceConnected(): boolean {
    return this.isConnected;
  }

  getCurrentRideId(): string | null {
    return this.currentRideId;
  }
}

export const tricycleService = new TricycleServiceManager();