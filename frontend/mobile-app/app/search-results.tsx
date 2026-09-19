import { supabase } from '../src/services/supabase';
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const normalize = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const COMPANY_ASSETS: Record<string, any> = {
  'UTB CI': { logo: require('../assets/logos/utb.png') },
  'Transports AVS': { logo: require('../assets/logos/avs.png') },
  'CA-TRANS': { logo: require('../assets/logos/trans.png') },
  'STAF Transport': { logo: require('../assets/logos/staf.png') },
  'SBTA': { logo: require('../assets/logos/sbta.png') },
  'SITTI': { logo: require('../assets/logos/sitti.png') },
  'CTE Transport Express': { logo: require('../assets/logos/cte.png') },
  'MD Transport': { logo: require('../assets/logos/mdt.png') },
};
const FALLBACK_LOGO = require('../assets/images/bus.jpg');

const getLogo = (name: string) => {
  if (!name) return FALLBACK_LOGO;
  if (COMPANY_ASSETS[name]?.logo) return COMPANY_ASSETS[name].logo;
  const n = normalize(name);
  const f = Object.keys(COMPANY_ASSETS).find(k => normalize(k) === n || n.includes(normalize(k)) || normalize(k).includes(n));
  return f ? COMPANY_ASSETS[f].logo : FALLBACK_LOGO;
};

export default function SearchResultsScreen() {
  const { depart, destination, date, company, color, id } = useLocalSearchParams();
  const companyColor = (color as string) || '#10B981';
  const companyName = (company as string) || '';
  const selectedCompanyId = String(id || '');
  const router = useRouter();

  const [results, setResults] = useState<any[]>([]);
  const [garesDepartList, setGaresDepartList] = useState<any[]>([]);
  const [garesArriveeList, setGaresArriveeList] = useState<any[]>([]);
  const [selectedGareDepart, setSelectedGareDepart] = useState('all');
  const [selectedGareArrivee, setSelectedGareArrivee] = useState('all');
  const [showDepartDropdown, setShowDepartDropdown] = useState(false);
  const [showArriveeDropdown, setShowArriveeDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [doesServe, setDoesServe] = useState(true);
  const [alternatives, setAlternatives] = useState<any[]>([]);
  const [nearbyGares, setNearbyGares] = useState<any[]>([]);

  const calc = (h: string, d: string) => {
    try {
      const [hh, mm] = h.split(':').map(Number);
      const dh = parseInt(String(d || '0').split('h')[0] || '0');
      let nh = hh + dh; if (nh >= 24) nh -= 24;
      return String(nh).padStart(2, '0') + ':' + String(mm || 0).padStart(2, '0');
    } catch { return '--:--'; }
  };

  useEffect(() => {
    (async () => {
      const depStr = String(depart || '').trim();
      const destStr = String(destination || '').trim();
      if (!depStr || !destStr) { setLoading(false); return; }
      setLoading(true);
      try {
        // ===== 1. GARES DEPART DE LA COMPAGNIE CHOISIE =====
        const { data: garesDepart } = await supabase
          .from('gares').select('*')
          .eq('company_id', selectedCompanyId)
          .ilike('ville', '%' + depStr + '%')
          .limit(50);

        const gareDepartIds = (garesDepart || []).map((g: any) => g.id);

        // ===== 2. DESTINATIONS DE CETTE COMPAGNIE (avec gare_depart_id ET gare_arrivee_id) =====
        let dests: any[] = [];
        if (gareDepartIds.length > 0) {
          // Cas nouveau modèle avec gare_depart_id
          const { data } = await supabase
            .from('destinations')
            .select('id,ville,prix,duree,quota,billets_vendus,company_id,gare_depart_id,gare_arrivee_id,companies(name,color),horaires(id,heure_depart),gare_depart:gares!destinations_gare_depart_id_fkey(id,nom,ville,adresse),gare_arrivee:gares!destinations_gare_arrivee_id_fkey(id,nom,ville,adresse)')
            .eq('company_id', selectedCompanyId)
            .in('gare_depart_id', gareDepartIds)
            .limit(200);

          // Filtre destination côté JS pour gérer ilike + gare_arrivee
          const destNorm = normalize(destStr);
          dests = (data || []).filter((d: any) => {
            const v1 = normalize(d.ville || '');
            const v2 = normalize(d.gare_arrivee?.ville || '');
            return v1.includes(destNorm) || destNorm.includes(v1) || v2.includes(destNorm) || destNorm.includes(v2);
          });

          // FALLBACK ancien modèle: si gare_depart_id NULL, cherche juste par ville destination
          if (dests.length === 0) {
            const { data: destsOld } = await supabase
              .from('destinations')
              .select('id,ville,prix,duree,quota,companies(name,color),horaires(id,heure_depart)')
              .eq('company_id', selectedCompanyId)
              .ilike('ville', '%' + destStr + '%')
              .limit(50);
            if (destsOld && destsOld.length > 0 && garesDepart && garesDepart.length > 0) {
              // On associe artificiellement chaque destination à chaque gare départ
              dests = destsOld.map((d: any) => ({
                ...d,
                gare_depart: garesDepart[0],
                gare_depart_id: garesDepart[0].id,
                gare_arrivee: null,
              }));
            }
          }
        }

        const serve = dests.length > 0;
        setDoesServe(serve);

        if (serve) {
          // Listes uniques
          const mapDep = new Map();
          (garesDepart || []).forEach((g: any) => { if (!mapDep.has(normalize(g.nom))) mapDep.set(normalize(g.nom), g); });
          setGaresDepartList(Array.from(mapDep.values()));

          const mapArr = new Map();
          dests.forEach((d: any) => {
            const ga = d.gare_arrivee;
            if (ga && !mapArr.has(normalize(ga.nom))) mapArr.set(normalize(ga.nom), ga);
            else if (!ga && d.ville) {
              const key = normalize(d.ville);
              if (!mapArr.has(key)) mapArr.set(key, { id: 'ville-' + key, nom: 'Gare ' + d.ville, ville: d.ville, adresse: d.ville });
            }
          });
          setGaresArriveeList(Array.from(mapArr.values()));

          const out: any[] = [];
          dests.forEach((d: any) => {
            const horaires = d.horaires && d.horaires.length ? d.horaires : [{ id: 'def', heure_depart: '07:00' }];
            horaires.forEach((ho: any) => {
              out.push({
                uid: d.id + '-' + d.gare_depart_id + '-' + (d.gare_arrivee_id || d.ville) + '-' + ho.id,
                depart: depStr,
                destination: d.gare_arrivee?.ville || d.ville,
                heure: String(ho.heure_depart).slice(0, 5),
                duree: d.duree || '4h',
                prix: d.prix,
                quota: d.quota,
                gare_depart: d.gare_depart,
                gare_arrivee: d.gare_arrivee || { nom: 'Gare ' + d.ville, ville: d.ville },
                company: d.companies?.name || companyName,
                companyId: selectedCompanyId,
                color: d.companies?.color || companyColor,
                destination_id: d.id,
              });
            });
          });
          setResults(out);
          setAlternatives([]); setNearbyGares([]);
        } else {
          // ===== NE DESSERT PAS : 2 SECTIONS =====
          // 1. Ce que la compagnie dessert aussi
          const { data: otherGares } = await supabase.from('gares').select('ville,nom').eq('company_id', selectedCompanyId).order('ville').limit(50);
          const seen = new Set(); const uniq: any[] = [];
          (otherGares || []).forEach((g: any) => { const v = normalize(g.ville); if (!seen.has(v) && v !== normalize(depStr) && v !== normalize(destStr)) { seen.add(v); uniq.push({ ville: g.ville, gare_name: g.nom }); } });
          setNearbyGares(uniq.slice(0, 10));

          // 2. QUI FAIT Abidjan -> Daloa ? (ROBUSTE, même sans gare_depart_id)
          // Étape A: toutes les gares qui sont à Abidjan
          const { data: allGaresDep } = await supabase.from('gares').select('id,company_id,nom,ville').ilike('ville', '%' + depStr + '%').limit(200);
          const allGaresDepIds = (allGaresDep || []).map((g: any) => g.id);
          const companyIdsWithDep = Array.from(new Set((allGaresDep || []).map((g: any) => g.company_id)));

          // Étape B: toutes les destinations vers Daloa (nouveau + ancien modèle)
          const { data: destsVersDaloa } = await supabase
            .from('destinations')
            .select('id,ville,prix,company_id,companies(name,color),gare_depart_id,gare_arrivee_id,gare_depart:gares!destinations_gare_depart_id_fkey(nom,ville),gare_arrivee:gares!destinations_gare_arrivee_id_fkey(nom,ville)')
            .ilike('ville', '%' + destStr + '%')
            .limit(200);

          // Étape C: gares qui sont à Daloa (pour ceux qui ont gare_arrivee_id)
          const { data: allGaresArr } = await supabase.from('gares').select('id,company_id,nom,ville').ilike('ville', '%' + destStr + '%').limit(200);
          const allGaresArrIds = (allGaresArr || []).map((g: any) => g.id);

          const { data: destsByGareArr } = await supabase
            .from('destinations')
            .select('id,ville,prix,company_id,companies(name,color),gare_depart_id,gare_arrivee_id,gare_depart:gares!destinations_gare_depart_id_fkey(nom,ville),gare_arrivee:gares!destinations_gare_arrivee_id_fkey(nom,ville)')
            .in('gare_arrivee_id', allGaresArrIds.length ? allGaresArrIds : ['00000000-0000-0000-0000-000000000000'])
            .limit(200);

          // Fusion
          let allCandidates = [...(destsVersDaloa || []), ...(destsByGareArr || [])];

          // Garde seulement ceux dont la gare de départ est à Abidjan OU dont la compagnie a une gare à Abidjan (fallback ancien modèle)
          const filteredCandidates = allCandidates.filter((d: any) => {
            if (d.gare_depart_id) {
              // Nouveau modèle: doit être une gare de départ à Abidjan
              return allGaresDepIds.includes(d.gare_depart_id);
            } else {
              // Ancien modèle: la compagnie doit avoir une gare à Abidjan
              return companyIdsWithDep.includes(d.company_id);
            }
          });

          const altMap = new Map();
          filteredCandidates.forEach((d: any) => {
            if (d.company_id === selectedCompanyId) return;
            if (!altMap.has(d.company_id)) {
              const garesDepForComp = (allGaresDep || []).filter((g: any) => g.company_id === d.company_id).map((g: any) => g.nom).slice(0, 2);
              const depLabel = d.gare_depart?.nom || (garesDepForComp[0] || depStr);
              const arrLabel = d.gare_arrivee?.nom || ('Gare ' + (d.gare_arrivee?.ville || d.ville));
              altMap.set(d.company_id, {
                company: d.companies?.name,
                companyId: d.company_id,
                color: d.companies?.color || '#0B4DA1',
                minPrice: d.prix,
                gareDepart: depLabel,
                gareArrivee: arrLabel,
                villeDepart: d.gare_depart?.ville || depStr,
                villeArrivee: d.gare_arrivee?.ville || d.ville,
              });
            }
          });

          // Si toujours 0, fallback large: toutes compagnies qui ont une destination vers destStr (même sans gare départ à Abidjan, on affiche quand même)
          if (altMap.size === 0 && destsVersDaloa && destsVersDaloa.length > 0) {
            destsVersDaloa.forEach((d: any) => {
              if (d.company_id === selectedCompanyId) return;
              if (!altMap.has(d.company_id)) {
                altMap.set(d.company_id, {
                  company: d.companies?.name,
                  companyId: d.company_id,
                  color: d.companies?.color || '#0B4DA1',
                  minPrice: d.prix,
                  gareDepart: d.gare_depart?.nom || depStr,
                  gareArrivee: d.gare_arrivee?.nom || d.ville,
                  villeDepart: depStr,
                  villeArrivee: d.ville,
                });
              }
            });
          }

          setAlternatives(Array.from(altMap.values()));
          setResults([]); setGaresDepartList([]); setGaresArriveeList([]);
        }
      } catch (e) { console.log(e); } finally { setLoading(false); }
    })();
  }, [depart, destination, id]);

  // Filtrage auto gare arrivée quand on choisit gare départ
  const filteredByDepart = useMemo(() => {
    if (selectedGareDepart === 'all') return results;
    return results.filter(r => r.gare_depart?.nom === selectedGareDepart);
  }, [results, selectedGareDepart]);

  const garesArriveeFiltered = useMemo(() => {
    if (selectedGareDepart === 'all') return garesArriveeList;
    const destsFromSelected = results.filter(r => r.gare_depart?.nom === selectedGareDepart).map(r => r.gare_arrivee?.nom);
    const uniq = Array.from(new Set(destsFromSelected));
    return garesArriveeList.filter(g => uniq.includes(g.nom));
  }, [garesArriveeList, results, selectedGareDepart]);

  const filtered = useMemo(() => {
    let f = filteredByDepart;
    if (selectedGareArrivee !== 'all') f = f.filter(r => r.gare_arrivee?.nom === selectedGareArrivee);
    return f;
  }, [filteredByDepart, selectedGareArrivee]);

  const onChoose = (it: any) => {
    router.push({ pathname: '/passenger-info', params: {
      depart: it.depart, destination: it.destination, date: String(date),
      heure: it.heure, duree: it.duree, prix: String(it.prix),
      company: it.company, color: it.color, companyId: it.companyId,
      gare_depart: it.gare_depart?.nom || '', gare_depart_id: it.gare_depart?.id || '',
      gare_arrivee: it.gare_arrivee?.nom || '', gare_arrivee_id: it.gare_arrivee?.id || '',
      destinationId: it.destination_id, seats: '1', total: String(it.prix),
    } } as any);
  };
  const onChooseAlt = (alt: any) => {
    router.push({ pathname: '/search-results', params: { depart: String(alt.villeDepart || depart), destination: String(alt.villeArrivee || destination), date: String(date), company: String(alt.company), color: String(alt.color), id: String(alt.companyId) } } as any);
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={companyColor} /></View>;

  const nearestDepart = garesDepartList.length > 0 ? garesDepartList[0] : null;

  return (
    <View style={s.c}>
      <StatusBar barStyle="light-content" backgroundColor={companyColor} />
      <LinearGradient colors={[companyColor, companyColor]} style={s.h}>
        <SafeAreaView edges={['top']}>
          <View style={s.hb}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color="#FFF" /></TouchableOpacity>
            <View style={s.hbCenter}><Text style={s.ht}>{depart} → {destination}</Text><Text style={s.sub}>{doesServe ? filtered.length + ' bus ' + companyName : '0 pour ' + companyName}</Text></View>
            <View style={{ width: 24 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {doesServe && (
          <View style={s.gareChooser}>
            {/* GARE DEPART */}
            <View style={s.gareHead}><Ionicons name="location" size={18} color={companyColor} /><Text style={s.gareHeadT}>Choisis ta gare de départ</Text><View style={s.countBadge}><Text style={s.countBadgeT}>{garesDepartList.length}</Text></View></View>
            <TouchableOpacity style={s.dropdownBtn} onPress={() => { setShowDepartDropdown(!showDepartDropdown); setShowArriveeDropdown(false); }} activeOpacity={0.8}>
              <View style={s.dropdownBtnLeft}><MaterialCommunityIcons name="bus-stop" size={18} color={companyColor} /><Text style={s.dropdownBtnText}>{selectedGareDepart === 'all' ? 'Toutes les gares (' + garesDepartList.length + ')' : selectedGareDepart}</Text>{selectedGareDepart !== 'all' && nearestDepart && normalize(selectedGareDepart) === normalize(nearestDepart.nom) && <View style={s.nearestBadge}><Text style={s.nearestBadgeT}>Proche</Text></View>}</View>
              <Ionicons name={showDepartDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
            </TouchableOpacity>
            {showDepartDropdown && (
              <View style={s.dropdownList}>
                <TouchableOpacity style={[s.dropdownItem, selectedGareDepart === 'all' && s.dropdownItemActive]} onPress={() => { setSelectedGareDepart('all'); setSelectedGareArrivee('all'); setShowDepartDropdown(false); }}><Text style={[s.dropdownItemText, selectedGareDepart === 'all' && s.dropdownItemTextActive]}>Toutes les gares de {depart}</Text><Text style={s.dropdownItemSub}>{garesDepartList.length} disponibles</Text></TouchableOpacity>
                {garesDepartList.map((g: any, i: number) => {
                  const isSelected = selectedGareDepart === g.nom;
                  const isNearest = nearestDepart && normalize(g.nom) === normalize(nearestDepart.nom);
                  return (
                    <TouchableOpacity key={g.id + '-' + i} style={[s.dropdownItem, isSelected && s.dropdownItemActive]} onPress={() => { setSelectedGareDepart(g.nom); setSelectedGareArrivee('all'); setShowDepartDropdown(false); }}>
                      <View style={s.dropdownItemLeft}><Text style={[s.dropdownItemText, isSelected && s.dropdownItemTextActive]}>{g.nom} {isNearest ? '⭐' : ''}</Text><Text style={s.dropdownItemSub} numberOfLines={1}>{g.adresse || g.ville}{isNearest ? ' • La plus proche' : ''}</Text></View>
                      {isSelected && <Ionicons name="checkmark-circle" size={18} color={companyColor} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* GARE ARRIVEE - s'affiche auto après choix départ */}
            <View style={[s.gareHead, { marginTop: 16 }]}><Ionicons name="flag" size={18} color={companyColor} /><Text style={s.gareHeadT}>Gare d'arrivée</Text><View style={s.countBadge}><Text style={s.countBadgeT}>{selectedGareDepart === 'all' ? garesArriveeList.length : garesArriveeFiltered.length}</Text></View></View>
            <TouchableOpacity style={s.dropdownBtn} onPress={() => { setShowArriveeDropdown(!showArriveeDropdown); setShowDepartDropdown(false); }} activeOpacity={0.8}>
              <View style={s.dropdownBtnLeft}><MaterialCommunityIcons name="map-marker" size={18} color={companyColor} /><Text style={s.dropdownBtnText}>{selectedGareArrivee === 'all' ? (selectedGareDepart === 'all' ? 'Toutes (' + garesArriveeList.length + ')' : 'Toutes arrivées depuis ' + selectedGareDepart) : selectedGareArrivee}</Text></View>
              <Ionicons name={showArriveeDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
            </TouchableOpacity>
            {showArriveeDropdown && (
              <View style={s.dropdownList}>
                <TouchableOpacity style={[s.dropdownItem, selectedGareArrivee === 'all' && s.dropdownItemActive]} onPress={() => { setSelectedGareArrivee('all'); setShowArriveeDropdown(false); }}><Text style={[s.dropdownItemText, selectedGareArrivee === 'all' && s.dropdownItemTextActive]}>Toutes les gares d'arrivée</Text><Text style={s.dropdownItemSub}>{selectedGareDepart === 'all' ? garesArriveeList.length : garesArriveeFiltered.length} disponibles</Text></TouchableOpacity>
                {(selectedGareDepart === 'all' ? garesArriveeList : garesArriveeFiltered).map((g: any, i: number) => {
                  const isSelected = selectedGareArrivee === g.nom;
                  return (
                    <TouchableOpacity key={g.id + '-' + i} style={[s.dropdownItem, isSelected && s.dropdownItemActive]} onPress={() => { setSelectedGareArrivee(g.nom); setShowArriveeDropdown(false); }}>
                      <View style={s.dropdownItemLeft}><Text style={[s.dropdownItemText, isSelected && s.dropdownItemTextActive]}>{g.nom}</Text><Text style={s.dropdownItemSub} numberOfLines={1}>{g.adresse || g.ville}</Text></View>
                      {isSelected && <Ionicons name="checkmark-circle" size={18} color={companyColor} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {!showDepartDropdown && !showArriveeDropdown && nearestDepart && <Text style={s.nearestHint}>⭐ {nearestDepart.nom} est la plus proche à {depart}{selectedGareDepart !== 'all' ? ' • ' + (garesArriveeFiltered[0]?.nom || '') + ' à ' + destination : ''}</Text>}
          </View>
        )}

        {/* CAS 0 BILLET */}
        {!doesServe && (
          <View style={s.premiumAlert}>
            <View style={s.rowCenter}><View style={[s.logoRing, { borderColor: companyColor + '40' }]}><Image source={getLogo(companyName)} style={{ width: 38, height: 38 }} resizeMode="contain" /></View><View style={{ flex: 1, marginLeft: 12 }}><View style={s.rowCenterSmall}><Text style={s.alertName}>{companyName}</Text><View style={s.badgeOff}><Text style={s.badgeOffT}>Ne dessert pas</Text></View></View><Text style={s.alertDesc}>Ne fait pas {depart} → {destination} depuis ses gares</Text></View></View>
            {nearbyGares.length > 0 && (
              <>
                <Text style={[s.innerTitle, { marginTop: 14 }]}>{companyName} dessert aussi :</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8 }}>
                  {nearbyGares.map((g: any, i: number) => (<View key={g.ville + '-' + i} style={s.nearCard}><Text style={s.nearVille}>{g.ville}</Text><Text style={s.nearGare}>{g.gare_name}</Text></View>))}
                </ScrollView>
              </>
            )}
          </View>
        )}

        {!doesServe && (
          <View style={s.suggestWrap}>
            <Text style={s.sTitle}>Compagnies qui font {depart} → {destination}</Text>
            <Text style={s.sSubtitle}>Avec gare de départ → gare d'arrivée précise • Clique pour voir billets</Text>
            {alternatives.length === 0 ? <View style={s.emptyBox}><Text style={s.emptyText}>Aucune compagnie ne fait cette ligne pour l'instant. Vérifie que d'autres compagnies ont une gare à {depart} et une destination vers {destination}.</Text></View> : alternatives.map((alt: any) => (
              <TouchableOpacity key={alt.companyId} style={s.altCardFull} onPress={() => onChooseAlt(alt)} activeOpacity={0.8}>
                <View style={s.rowCenter}><View style={s.altLogoWrap}><Image source={getLogo(alt.company)} style={{ width: 32, height: 32 }} resizeMode="contain" /></View><View style={{ flex: 1, marginLeft: 10 }}><Text style={s.altName}>{alt.company}</Text><Text style={s.altGare}>{alt.gareDepart} → {alt.gareArrivee}</Text><Text style={s.altSub}>{alt.villeDepart} → {alt.villeArrivee}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={[s.altPrice, { color: alt.color }]}>Dès {alt.minPrice}F</Text><View style={[s.altBtn, { backgroundColor: alt.color }]}><Text style={s.altBtnT}>Voir billets</Text><Ionicons name="arrow-forward" size={12} color="#FFF" /></View></View></View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {doesServe && <Text style={s.sectionTop}>{filtered.length} billets • {selectedGareDepart === 'all' ? 'Toutes gares' : selectedGareDepart} → {selectedGareArrivee === 'all' ? destination : selectedGareArrivee}</Text>}
        <View style={{ paddingHorizontal: 16 }}>
          {filtered.map((it) => (
            <View key={it.uid} style={s.card}>
              <View style={s.cardTop}><View style={s.cardTopLeft}><View style={s.logoWrap}><Image source={getLogo(it.company)} style={s.logo} resizeMode="contain" /></View><View style={{ flex: 1 }}><Text style={s.coName}>{it.company}</Text><Text style={s.gareSub}>De {it.gare_depart?.nom} → {it.gare_arrivee?.nom}</Text></View></View><View style={s.timePill}><Text style={s.timePillT}>{it.heure}</Text></View></View>
              <View style={s.timeRow}><View><Text style={s.heure}>{it.heure}</Text><Text style={s.city}>{it.gare_depart?.nom}</Text><Text style={s.citySmall}>{it.gare_depart?.ville}</Text></View><View style={s.lineWrap}><View style={s.dot} /><View style={s.line} /><View style={[s.busIcon, { backgroundColor: it.color }]}><MaterialCommunityIcons name="bus" size={12} color="#FFF" /></View><View style={s.line} /><View style={s.dot} /></View><View style={{ alignItems: 'flex-end' }}><Text style={s.heure}>{calc(it.heure, it.duree)}</Text><Text style={s.city}>{it.gare_arrivee?.nom}</Text><Text style={s.citySmall}>{it.gare_arrivee?.ville}</Text></View></View>
              <View style={s.bottom}><Text style={[s.prix, { color: it.color }]}>{it.prix}F</Text><TouchableOpacity style={[s.btn, { backgroundColor: it.color }]} onPress={() => onChoose(it)}><Text style={s.btnT}>Réserver</Text><Ionicons name="arrow-forward" size={14} color="#FFF" /></TouchableOpacity></View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#F7F8FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  h: { paddingBottom: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  hb: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  hbCenter: { alignItems: 'center' },
  ht: { color: '#FFF', fontWeight: '900', fontSize: 16 },
  sub: { color: '#FFF', opacity: 0.9, fontSize: 11, marginTop: 2 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  rowCenterSmall: { flexDirection: 'row', alignItems: 'center' },
  premiumAlert: { margin: 16, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFF' },
  logoRing: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF', borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  alertName: { fontWeight: '900', fontSize: 14, marginRight: 6 },
  badgeOff: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeOffT: { fontSize: 9, fontWeight: '800', color: '#DC2626' },
  alertDesc: { fontSize: 12, color: '#7F1D1D', marginTop: 2 },
  innerTitle: { fontWeight: '800', fontSize: 12 },
  nearCard: { width: 120, backgroundColor: '#FFF', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#F3F4F6', marginRight: 10 },
  nearVille: { fontWeight: '800', fontSize: 12 },
  nearGare: { fontSize: 10, color: '#6B7280', marginTop: 2 },
  gareChooser: { backgroundColor: '#FFF', margin: 16, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F3F4F6', elevation: 3 },
  gareHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  gareHeadT: { fontWeight: '900', fontSize: 13, flex: 1, marginLeft: 8 },
  countBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countBadgeT: { fontSize: 10, fontWeight: '900' },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12, height: 48, backgroundColor: '#F9FAFB' },
  dropdownBtnLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dropdownBtnText: { fontWeight: '700', fontSize: 13, marginLeft: 8, flex: 1 },
  nearestBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 6 },
  nearestBadgeT: { fontSize: 9, fontWeight: '800', color: '#D97706' },
  dropdownList: { marginTop: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#FFF', overflow: 'hidden', elevation: 5 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownItemActive: { backgroundColor: '#EEF2FF' },
  dropdownItemLeft: { flex: 1 },
  dropdownItemText: { fontWeight: '700', fontSize: 13 },
  dropdownItemTextActive: { color: '#4338CA' },
  dropdownItemSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  nearestHint: { fontSize: 10, color: '#6B7280', marginTop: 8, fontWeight: '600' },
  suggestWrap: { marginTop: 8, paddingHorizontal: 16 },
  sTitle: { fontWeight: '900', fontSize: 14 },
  sSubtitle: { fontSize: 11, color: '#6B7280', marginTop: 2, marginBottom: 12 },
  emptyBox: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', alignItems: 'center' },
  emptyText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  altCardFull: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, padding: 14, marginBottom: 10, elevation: 2 },
  altLogoWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  altName: { fontWeight: '800', fontSize: 14 },
  altGare: { fontSize: 11, color: '#374151', marginTop: 1, fontWeight: '700' },
  altSub: { fontSize: 10, color: '#9CA3AF' },
  altPrice: { fontWeight: '900', fontSize: 14 },
  altBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 4 },
  altBtnT: { color: '#FFF', fontWeight: '800', fontSize: 10, marginRight: 4 },
  sectionTop: { fontWeight: '900', fontSize: 13, paddingHorizontal: 16, marginTop: 14, marginBottom: 10, color: '#6B7280' },
  card: { backgroundColor: '#FFF', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6', elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  logoWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  logo: { width: 30, height: 30 },
  coName: { fontWeight: '800', fontSize: 12 },
  gareSub: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  timePill: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  timePillT: { fontWeight: '800', fontSize: 11 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heure: { fontSize: 17, fontWeight: '900' },
  city: { fontSize: 11, color: '#374151', fontWeight: '700' },
  citySmall: { fontSize: 9, color: '#9CA3AF' },
  lineWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#E5E7EB' },
  line: { flex: 1, height: 1.5, backgroundColor: '#F3F4F6' },
  busIcon: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  prix: { fontSize: 17, fontWeight: '900' },
  btn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  btnT: { color: '#FFF', fontWeight: '800', fontSize: 13, marginRight: 6 },
});
