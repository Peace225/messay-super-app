import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = url && key ? createClient(url, key) : null as any

// Helpers avec fallback mock si pas de supabase
export const api = {
  async getCompanies() {
    if (!supabase) throw new Error('Connexion Supabase non configurée.')
    const { data, error } = await supabase.from('companies').select('*')
    if (error) throw error
    return data ?? []
  },
  async getGares(companyId: string) {
    if (!supabase) throw new Error('Connexion Supabase non configurée.')
    const { data, error } = await supabase.from('gares').select('*').eq('company_id', companyId).order('ville')
    if (error) throw error
    return data ?? []
  },
  async getAllGares() {
    if (!supabase) throw new Error('Connexion Supabase non configurée.')
    const { data, error } = await supabase.from('gares').select('*').limit(200)
    if (error) throw error
    return data ?? []
  },
  async getDestinationsByGareDepart(gareDepartId: string) {
    if (!supabase) throw new Error('Connexion Supabase non configurée.')
    const { data, error } = await supabase.from('destinations')
      .select('*, horaires(*), gare_arrivee:gares!destinations_gare_arrivee_id_fkey(id,nom,ville)')
      .eq('gare_depart_id', gareDepartId)
    if (error) throw error
    return data ?? []
  },
  async addGare(gare: any) {
    if (!supabase) throw new Error('Connexion Supabase non configurée.')
    const { data, error } = await supabase.from('gares').insert(gare).select().single()
    if (error) throw error
    return data
  },
  async addDestination(dest: any, horaires: string[]) {
    if (!supabase) throw new Error('Connexion Supabase non configurée.')
    const { data: d } = await supabase.from('destinations').insert(dest).select().single()
    if (d && horaires.length) {
      await supabase.from('horaires').insert(horaires.map(h => ({ destination_id: d.id, heure_depart: h })))
    }
    return d
  },
  async deleteDestination(id: string) {
    if (!supabase) throw new Error('Connexion Supabase non configurée.')
    await supabase.from('destinations').delete().eq('id', id)
    return true
  }
}
