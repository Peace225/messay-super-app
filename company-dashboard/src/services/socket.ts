import { io, Socket } from 'socket.io-client'

const URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

// Singleton socket
export const socket: Socket = io(URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  auth: {
    token: localStorage.getItem('company_token') || '',
  },
})

// ===== HELPERS =====

export const connectSocket = (companyId: string) => {
  if (socket.connected) return socket
  
  socket.auth = { companyId, token: localStorage.getItem('company_token') }
  socket.connect()
  
  socket.on('connect', () => {
    console.log('[SOCKET] Connecté:', socket.id, 'Company:', companyId)
    // Rejoins la room de la compagnie pour recevoir uniquement ses events
    socket.emit('join-company', companyId)
  })
  
  socket.on('disconnect', (reason) => {
    console.log('[SOCKET] Déconnecté:', reason)
  })
  
  socket.on('connect_error', (err) => {
    console.error('[SOCKET] Erreur:', err.message)
  })
  
  return socket
}

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect()
  }
}

// ===== EVENTS COMPAGNIE → SERVEUR =====

// Mise à jour du statut d'une réservation depuis Reservations.tsx
export const emitReservationStatus = (payload: any, status?: string) => {
  // Gère à la fois l'envoi de l'objet complet Reservation ou un { reservationId, status }
  const data = typeof payload === 'string' 
    ? { reservationId: payload, status } 
    : payload;

  socket.emit('reservation:update-status', data)
}

// Quand compagnie ajoute un départ Gare Départ → Gare Arrivée
export const emitNewDepart = (payload: {
  company_id: string
  gare_depart_id: string
  gare_arrivee_id: string | null
  ville: string
  prix: number
}) => {
  socket.emit('gare:new-depart', payload)
}

// Quand billet vendu depuis une gare
export const emitTicketSold = (payload: {
  ticket_id: string
  destination_id: string
  gare_depart_id: string
  gare_arrivee_id: string
  company_id: string
}) => {
  socket.emit('ticket:sold', payload)
}

// Chauffeur met à jour sa position (appelé par le chauffeur, mais écouté par dashboard)
export const emitDriverLocation = (payload: {
  driver_id: string
  company_id: string
  gare_depart_id: string
  gare_arrivee_id: string
  lat: number
  lng: number
  speed: number
}) => {
  socket.emit('driver:location', payload)
}

// ===== EVENTS SERVEUR → COMPAGNIE (à écouter dans Dashboard) =====

// Écoute pour Reservations.tsx : Nouvelle réservation
export const onNewReservation = (cb: (reservation: any) => void) => {
  socket.on('reservation:new', cb)
  return () => socket.off('reservation:new', cb)
}

// Écoute pour Reservations.tsx : Mise à jour de la réservation
export const onReservationUpdate = (cb: (reservation: any) => void) => {
  socket.on('reservation:update', cb)
  return () => socket.off('reservation:update', cb)
}

export const onNewTicket = (cb: (ticket: any) => void) => {
  socket.on('ticket:new', cb)
  return () => socket.off('ticket:new', cb)
}

// Rétrocompatibilité avec les autres fichiers
export const onReservationUpdated = (cb: (data: any) => void) => {
  socket.on('reservation:updated', cb)
  return () => socket.off('reservation:updated', cb)
}

export const onTicketSoldFromGare = (cb: (data: { gare_depart_id: string, gare_arrivee_id: string, count: number }) => void) => {
  // Quand un billet est vendu pour une gare précise, met à jour le compteur Quota
  socket.on('gare:ticket-sold', cb)
  return () => socket.off('gare:ticket-sold', cb)
}

export const onDriverLocationUpdate = (cb: (data: any) => void) => {
  socket.on('driver:location-update', cb)
  return () => socket.off('driver:location-update', cb)
}

export const onGareDepartCreated = (cb: (gare: any) => void) => {
  socket.on('gare:created', cb)
  return () => socket.off('gare:created', cb)
}

export const onDepartAdded = (cb: (dest: any) => void) => {
  // Nouvelle ligne Gare Départ → Gare Arrivée ajoutée
  socket.on('gare:depart-added', cb)
  return () => socket.off('gare:depart-added', cb)
}

export const onDepartRemoved = (cb: (destId: string) => void) => {
  socket.on('gare:depart-removed', cb)
  return () => socket.off('gare:depart-removed', cb)
}

// Pour TrajetsReel.tsx
export const onTripStarted = (cb: (trip: { driver_id: string, gare_depart: any, gare_arrivee: any, heure: string }) => void) => {
  socket.on('trip:started', cb)
  return () => socket.off('trip:started', cb)
}

export const onTripFinished = (cb: (trip: any) => void) => {
  socket.on('trip:finished', cb)
  return () => socket.off('trip:finished', cb)
}

export default socket