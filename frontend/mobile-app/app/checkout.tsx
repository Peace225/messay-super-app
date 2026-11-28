/**
 * MESSAY G1 — checkout interurbain aligné sur les routes HTTP de production.
 * Jamais de paiement/émission de billet sans confirmation serveur.
 * Les paiements sont désactivés par défaut dans toute build Expo.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { getMessayBackendToken } from '../src/services/messayBackendToken';
import { useAuthStore } from '../src/store/authStore';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const BASE = (
  process.env.EXPO_PUBLIC_MESSAY_API_URL?.trim() ||
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  ''
);
const LIVE = process.env.EXPO_PUBLIC_MESSAY_PAYMENT_MODE === 'production' &&
  process.env.EXPO_PUBLIC_MESSAY_LIVE_CHECKOUT_ENABLED === 'true';
function trustedApi(raw: string): string | null {
  try {
    const u = new URL(raw);

    const allowedOrigins = new Set([
      'https://api.messay.ci',
      'https://messay-api.onrender.com',
    ]);

    if (
      u.protocol !== 'https:' ||
      !allowedOrigins.has(u.origin) ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      u.port ||
      !['/', '/api', '/api/'].includes(u.pathname)
    ) {
      return null;
    }

    // Les requêtes ajoutent déjà /api/interurbain/mobile.
    return u.origin;
  } catch {
    return null;
  }
}
const API = trustedApi(BASE);
const ENABLED = LIVE && API !== null;
const one = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v || '').trim();
const validUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const xof = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`;
const newId = (): string => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16);
});
function trustedCheckoutUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 2048) return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && u.origin === 'https://geniuspay.ci' &&
      /^\/checkout\/[a-zA-Z0-9_-]{4,200}$/.test(u.pathname) &&
      !u.search && !u.hash && !u.username && !u.password;
  } catch { return false; }
}
async function post(path: string, payload: Record<string,string>, expectedUserId: string): Promise<{http:number;body:unknown}> {
  if (useAuthStore.getState().user?.id !== expectedUserId) throw new Error('Compte modifié : veuillez vous reconnecter.');
  if (!API) throw new Error('API de production non configurée.');
  const jwt = await getMessayBackendToken();
  if (!jwt) throw new Error('Connectez-vous au compte MESSAY pour continuer.');
  if (useAuthStore.getState().user?.id !== expectedUserId) throw new Error('Compte modifié : paiement interrompu.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${API}/api/interurbain/mobile/${path}`, {
      method:'POST', headers:{Authorization:`Bearer ${jwt}`,'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify(payload),signal:controller.signal,
    });
    const body:unknown = await response.json().catch(()=>null);
    if (useAuthStore.getState().user?.id !== expectedUserId) throw new Error('Compte modifié : réponse ignorée.');
    return {http:response.status,body};
  } finally { clearTimeout(timer); }
}
type Journal = { affectationId:string; requestId:string; reservationId?:string; intentId?:string; expiry?:string; amount?:number; checkoutUrl?:string; phase:'attempted'|'hold'|'intent'|'checkout'|'review' };
type PaymentStatus = { financial_status:string; issuance_status:string; paiement_confirme:boolean; billet_emis:boolean; billet_id:string|null; message?:string };
export default function Checkout() {
  const router=useRouter();
  const p=useLocalSearchParams<{affectationId?:string;company?:string;depart?:string;destination?:string;nom?:string;phone?:string}>();
  const affectationId=one(p.affectationId);
  // Le journal ne doit jamais être partagé entre deux comptes sur le même appareil.
  const userId=useAuthStore(state => state.user?.id ?? null);
  const storageKey=validUuid(affectationId) && validUuid(userId)
    ? `messay:interurbain:checkout:g2:${userId}:${affectationId}` : null;
  const [journal,setJournal]=useState<Journal|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('Vérification de votre dossier…');
  const [status,setStatus]=useState<PaymentStatus|null>(null);
  const busyRef=useRef(false);
  const save=useCallback(async (j:Journal) => {
    if (!storageKey || !userId || useAuthStore.getState().user?.id !== userId)
      throw new Error('Session de paiement invalide ou compte modifié.');
    await AsyncStorage.setItem(storageKey,JSON.stringify(j));
    setJournal(j);
  },[storageKey,userId]);
  useEffect(()=>{
    setJournal(null);
    setStatus(null);
    setLoading(true);
    let active=true;
    (async()=>{
      if (!storageKey){if(active){setMessage('Connectez-vous avec un compte valide et sélectionnez un départ.');setLoading(false);}return;}
      try {
        const v=await AsyncStorage.getItem(storageKey);
        if (!active)return;
        if(v){
          const parsed:unknown=JSON.parse(v);
          if (!isObject(parsed)||parsed.affectationId!==affectationId||!validUuid(parsed.requestId)) {
            setMessage('Dossier local incohérent : vérification par le support requise.');
          } else {
            const j=parsed as Journal;
            setJournal(j);
            setMessage(j.intentId?'Dossier retrouvé. Consultez le statut avant toute autre action.':
              'Tentative précédente à vérifier. Aucun nouvel encaissement automatique.');
          }
        } else setMessage('Le tarif réel et la disponibilité seront vérifiés côté serveur.');
      } catch {if(active)setMessage('Dossier local indisponible. Ne recommencez pas un paiement avant vérification.');}
      finally {if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[storageKey,affectationId]);
  const verify=useCallback(async()=>{
    if(!journal?.intentId||busyRef.current)return;
    busyRef.current=true;setBusy(true);
    try {
      if (!userId) throw new Error('Session non disponible.');
      const r=await post('geniuspay-status',{intent_id:journal.intentId},userId);
      if(r.http!==200||!isObject(r.body))throw new Error(`Statut indisponible (HTTP ${r.http}). Réessayez plus tard.`);
      const d=r.body;
      if(d.intent_id!==journal.intentId||typeof d.paiement_confirme!=='boolean'||typeof d.billet_emis!=='boolean'||
         typeof d.financial_status!=='string'||typeof d.issuance_status!=='string') throw new Error('Réponse serveur incohérente.');
      if(d.billet_emis && (!d.paiement_confirme||d.issuance_status!=='ISSUED'||!validUuid(d.billet_id)))
        throw new Error('Billet non vérifiable.');
      const s:PaymentStatus={financial_status:d.financial_status,issuance_status:d.issuance_status,
        paiement_confirme:d.paiement_confirme,billet_emis:d.billet_emis,billet_id:validUuid(d.billet_id)?d.billet_id:null,
        message:typeof d.message==='string'?d.message:undefined};
      setStatus(s);setMessage(s.billet_emis?'Billet confirmé. Siège en attente d’attribution.':
        s.paiement_confirme?'Paiement enregistré ; billet en cours de vérification.':
        s.financial_status==='REVIEW'||s.issuance_status==='RECONCILE'? 'Paiement en rapprochement : ne payez pas une seconde fois.':'Paiement non confirmé.');
    } catch(e){setMessage(e instanceof Error?e.message:'Statut indisponible.');}
    finally{busyRef.current=false;setBusy(false);}
  },[journal,userId]);
  useFocusEffect(useCallback(()=>{if(journal?.intentId && ENABLED)void verify();},[journal?.intentId,verify]));
  async function prepare():Promise<void>{
    if(busyRef.current||!ENABLED||!storageKey||!userId||!validUuid(affectationId)||journal)return;
    const name=one(p.nom),phone=one(p.phone);
    if(name.length<3||phone.length<8){Alert.alert('Passager','Nom ou téléphone incomplet.');return;}
    busyRef.current=true;setBusy(true);
    let j:Journal={affectationId,requestId:newId(),phase:'attempted'};
    try {
      // Journaliser AVANT tout POST : après un timeout, ne jamais émettre une seconde demande silencieuse.
      await save(j);
      const hold=await post('reservations',{affectation_id:affectationId,request_id:j.requestId},userId);
      if(hold.http!==201||!isObject(hold.body)||!validUuid(hold.body.reservation_id)||
        typeof hold.body.expire_le!=='string'||Date.parse(hold.body.expire_le)<=Date.now())
        throw new Error(`Réservation indisponible (HTTP ${hold.http}).`);
      j={...j,reservationId:hold.body.reservation_id,expiry:hold.body.expire_le,phase:'hold'};
      await save(j);
      const intent=await post('paiement-intent',{
        reservation_id:j.reservationId!,passenger_name:name,passenger_phone:phone,
      },userId);
      if(intent.http!==200||!isObject(intent.body)||!validUuid(intent.body.intent_id)||
         typeof intent.body.amount_xof!=='number'||!Number.isSafeInteger(intent.body.amount_xof)||
         intent.body.amount_xof<200||intent.body.currency!=='XOF')
         throw new Error(`Intention non confirmée (HTTP ${intent.http}).`);
      j={...j,intentId:intent.body.intent_id,amount:intent.body.amount_xof,phase:'intent'};
      await save(j);
      setMessage(`Montant officiel : ${xof(j.amount!)}. Validez pour ouvrir GeniusPay.`);
    } catch(e){setMessage((e instanceof Error?e.message:'Opération incertaine.')+' Ne recommencez pas automatiquement.');}
    finally{busyRef.current=false;setBusy(false);}
  }
  async function initiate():Promise<void>{
    if(busyRef.current||!ENABLED||!userId||!storageKey||!journal?.intentId||journal.phase!=='intent'||!journal.amount)return;
    busyRef.current=true;setBusy(true);
    try {
      await save({...journal,phase:'review'}); // sauvegarde avant le POST non idempotent côté prestataire
      const r=await post('geniuspay-checkout',{intent_id:journal.intentId},userId);
      if(r.http!==200||!isObject(r.body)||r.body.intent_id!==journal.intentId||
        r.body.currency!=='XOF'||r.body.amount_xof!==journal.amount||
        !trustedCheckoutUrl(r.body.checkout_url))throw new Error(`Checkout à vérifier (HTTP ${r.http}).`);
      const j={...journal,checkoutUrl:r.body.checkout_url,phase:'checkout' as const};
      await save(j);
      setMessage('Session GeniusPay créée. Le billet sera confirmé uniquement par le serveur MESSAY.');
      await Linking.openURL(j.checkoutUrl!);
    }catch(e){setMessage((e instanceof Error?e.message:'Checkout incertain.')+' Ne réinitiez pas le paiement.');}
    finally{busyRef.current=false;setBusy(false);}
  }
  return <View style={s.page}><ScrollView contentContainerStyle={s.content}>
    <Pressable onPress={()=>router.back()}><Text style={s.link}>‹ Retour</Text></Pressable>
    <Text style={s.heading}>Paiement interurbain</Text><Text style={s.sub}>GeniusPay — paiement sécurisé</Text>
    <View style={s.card}>
      <Text style={s.label}>Compagnie</Text><Text style={s.value}>{one(p.company)||'À confirmer'}</Text>
      <Text style={s.label}>Trajet</Text><Text style={s.value}>{one(p.depart)||'Départ'} → {one(p.destination)||'Destination'}</Text>
      <Text style={s.label}>Passager</Text><Text style={s.value}>{one(p.nom)||'À confirmer'}</Text>
      <Text style={s.label}>Tarif officiel</Text><Text style={s.amount}>{journal?.amount?xof(journal.amount):'À vérifier par MESSAY'}</Text>
      <Text style={s.label}>Siège</Text><Text style={s.value}>Attribué par la compagnie après paiement confirmé</Text>
      {status?.billet_emis && status.paiement_confirme && status.billet_id ? (
        <View>
          <Text style={s.confirm}>
            Billet confirmé · Siège en attente d’attribution
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voir mon billet"
            style={s.button}
            onPress={() => router.push('/mes-tickets')}
          >
            <Text style={s.buttonText}>
              Voir mon billet
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
    <View style={s.note}><Text style={s.message}>{message}</Text></View>
    {!ENABLED?<Text style={s.warning}>Les paiements GeniusPay LIVE sont actuellement désactivés. Aucun montant ne sera débité depuis cet écran.</Text>:null}
    {loading?<ActivityIndicator/>:null}
    <Pressable style={[s.button,(!ENABLED||!storageKey||busy||loading||!!journal)&&s.disabled]}
      disabled={!ENABLED||!storageKey||busy||loading||!!journal} onPress={()=>void prepare()}>
      <Text style={s.buttonText}>Vérifier et réserver le départ</Text>
    </Pressable>
    {journal?.phase==='intent' && !status?.paiement_confirme ?
      <Pressable style={[s.button,(!ENABLED||!storageKey||busy)&&s.disabled]} disabled={!ENABLED||!storageKey||busy} onPress={()=>void initiate()}><Text style={s.buttonText}>Continuer vers GeniusPay</Text></Pressable>:null}
    {journal?.checkoutUrl&&trustedCheckoutUrl(journal.checkoutUrl)&&ENABLED?
      <Pressable style={s.secondary} disabled={busy||!storageKey} onPress={()=>void Linking.openURL(journal.checkoutUrl!)}><Text style={s.link}>Rouvrir la même session GeniusPay</Text></Pressable>:null}
    {journal?.intentId?<Pressable style={s.secondary} disabled={busy||!ENABLED||!storageKey} onPress={()=>void verify()}><Text style={s.link}>Vérifier le statut côté serveur</Text></Pressable>:null}
    <Text style={s.disclaimer}>Ne considérez jamais une page de retour du prestataire comme preuve de paiement. Seul le backend MESSAY peut confirmer le billet.</Text>
  </ScrollView></View>;
}
const s=StyleSheet.create({
  page:{flex:1,backgroundColor:'#F5F7FB'},content:{padding:22,paddingTop:55,paddingBottom:75},
  heading:{fontSize:26,fontWeight:'900',color:'#172439'},sub:{fontSize:14,color:'#64748B',marginTop:6,marginBottom:24},
  card:{padding:20,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0'},
  label:{fontSize:12,color:'#64748B',marginTop:13,fontWeight:'700'},value:{fontSize:15,color:'#172439',marginTop:4,fontWeight:'700'},
  amount:{fontSize:22,color:'#F97316',fontWeight:'900',marginTop:4},confirm:{marginTop:15,color:'#166534',fontWeight:'700'},
  note:{marginTop:16,padding:15,borderRadius:12,backgroundColor:'#FFF7ED'},message:{color:'#92400E',lineHeight:22},
  warning:{color:'#92400E',marginTop:16,lineHeight:20},button:{marginTop:18,padding:16,backgroundColor:'#F97316',borderRadius:12,alignItems:'center'},
  disabled:{opacity:.45},buttonText:{color:'#fff',fontWeight:'800'},link:{color:'#EA580C',fontWeight:'700'},
  secondary:{padding:14,alignItems:'center',marginTop:8},disclaimer:{fontSize:12,color:'#64748B',marginTop:24,lineHeight:18},
});
