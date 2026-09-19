import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = url && key ? createClient(url, key) : null as any

// Helpers avec fallback mock si pas de supabase
export const api = {
  async getCompanies() {
    if (!supabase) return mockCompanies
    const { data } = await supabase.from('companies').select('*')
    return data || mockCompanies
  },
  async getGares(companyId: string) {
    if (!supabase) return mockGares.filter(g => g.company_id === companyId)
    const { data } = await supabase.from('gares').select('*').eq('company_id', companyId).order('ville')
    return data || []
  },
  async getAllGares() {
    if (!supabase) return mockGares
    const { data } = await supabase.from('gares').select('*').limit(200)
    return data || []
  },
  async getDestinationsByGareDepart(gareDepartId: string) {
    if (!supabase) return mockDests.filter(d => d.gare_depart_id === gareDepartId)
    const { data } = await supabase.from('destinations')
      .select('*, horaires(*), gare_arrivee:gares!destinations_gare_arrivee_id_fkey(id,nom,ville)')
      .eq('gare_depart_id', gareDepartId)
    return data || []
  },
  async addGare(gare: any) {
    if (!supabase) return { ...gare, id: Date.now().toString() }
    const { data } = await supabase.from('gares').insert(gare).select().single()
    return data
  },
  async addDestination(dest: any, horaires: string[]) {
    if (!supabase) return { ...dest, id: Date.now().toString(), horaires: horaires.map(h => ({ heure_depart: h })) }
    const { data: d } = await supabase.from('destinations').insert(dest).select().single()
    if (d && horaires.length) {
      await supabase.from('horaires').insert(horaires.map(h => ({ destination_id: d.id, heure_depart: h })))
    }
    return d
  },
  async deleteDestination(id: string) {
    if (!supabase) return true
    await supabase.from('destinations').delete().eq('id', id)
    return true
  }
}

const mockCompanies = [
  { id: '1', name: 'MD Transport', color: '#EF4444', logo_url: '', ville: 'Abidjan', balance: 1250000 },
  { id: '2', name: 'UTB CI', color: '#7C3AED', logo_url: '', ville: 'Abidjan', balance: 890000 },
]

const mockGares = [
  { id: 'g1', company_id: '1', nom: 'Gare Yopougon', ville: 'Abidjan', adresse: 'Yopougon Siporex', chef_nom: 'Koffi', chef_tel: '0700000001', latitude: 5.34, longitude: -4.08 },
  { id: 'g2', company_id: '1', nom: 'Gare Adjamé', ville: 'Abidjan', adresse: 'Adjamé Liberté', chef_nom: 'Yao', chef_tel: '0700000002', latitude: 5.35, longitude: -4.02 },
  { id: 'g3', company_id: '1', nom: 'Gare Centre Akoupé', ville: 'Akoupé', adresse: 'Centre ville', chef_nom: 'Nguessan', chef_tel: '0700000003' },
  { id: 'g4', company_id: '1', nom: 'Gare Daloa', ville: 'Daloa', adresse: 'Quartier commerce', chef_nom: 'Bamba', chef_tel: '0700000004' },
]

const mockDests = [
  { id: 'd1', company_id: '1', gare_depart_id: 'g1', gare_arrivee_id: 'g3', ville: 'Akoupé', prix: 5000, duree: '3h30', quota: 50, billets_vendus: 12, horaires: [{ heure_depart: '07:00' }, { heure_depart: '14:00' }] },
  { id: 'd2', company_id: '1', gare_depart_id: 'g1', gare_arrivee_id: 'g4', ville: 'Daloa', prix: 8000, duree: '6h', quota: 50, billets_vendus: 5, horaires: [{ heure_depart: '08:00' }] },
]
