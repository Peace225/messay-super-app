/**
 * MESSAY E3 — Scanner web pour Dashboard Compagnie.
 * IMPORTANT: lecture optique uniquement. AUCUN controle financier, d'identite,
 * de compagnie, de gare ou d'embarquement ne s'effectue sur le navigateur.
 * Le parent DOIT relayer onScan vers une API authentifiee, autorisee par
 * compagnie/gare et auditée. NE PAS afficher « billet valide » depuis ce composant.
 * BarcodeDetector n'est pas disponible dans tous les navigateurs : saisie manuelle
 * du contenu QR en secours. La camera requiert HTTPS ou localhost.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { normaliserQrMessayBrut } from './messayQrScanFormat';

type Barcode = { rawValue?: string };
type Detector = { detect: (source: HTMLVideoElement) => Promise<Barcode[]> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

type Props = Readonly<{
  /** Doit effectuer le controle sur le serveur. Ne jamais marquer UTILISE directement depuis l'UI. */
  onScan: (qrPayload: string) => Promise<void> | void;
  disabled?: boolean;
}>;

export default function MessayQrScanner({ onScan, disabled = false }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const animation = useRef<number | null>(null);
  const running = useRef(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const [manual, setManual] = useState('');
  const [status, setStatus] = useState('Présentez un QR MESSAY ou saisissez son contenu.');
  const [cameraOn, setCameraOn] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const stopCamera = useCallback(() => {
    running.current = false;
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    if (mounted.current) setCameraOn(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stopCamera(); };
  }, [stopCamera]);

  const submitScan = useCallback(async (value: string) => {
    if (disabled || locked.current) return;
    let normalized: string;
    try { normalized = normaliserQrMessayBrut(value); }
    catch { setStatus('Format QR MESSAY BUS V1 invalide. Aucun billet validé.'); return; }
    locked.current = true;
    stopCamera();
    if (mounted.current) {
      setVerifying(true);
      setStatus('QR lu. Contrôle serveur requis : aucune validation locale.');
    }
    try {
      await onScan(normalized);
      if (mounted.current) setStatus('Lecture transmise au contrôle serveur. Consultez son résultat.');
    } catch {
      if (mounted.current) setStatus('Contrôle serveur indisponible ou refusé. Aucun embarquement validé.');
    } finally {
      locked.current = false;
      if (mounted.current) setVerifying(false);
    }
  }, [disabled, onScan, stopCamera]);

  const startCamera = useCallback(async () => {
    if (disabled || locked.current || running.current) return;
    const detectorCtor = (window as Window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!detectorCtor || !navigator.mediaDevices?.getUserMedia) {
      setStatus('Scanner caméra indisponible dans ce navigateur. Utilisez la saisie manuelle.');
      return;
    }
    running.current = true;
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }, audio: false,
      });
      if (!running.current || !mounted.current) {
        media.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current = media;
      const element = video.current;
      if (!element) throw new Error('Video absente');
      element.srcObject = media;
      setCameraOn(true);
      await element.play();
      if (!running.current || !mounted.current) return;
      const detector = new detectorCtor({ formats: ['qr_code'] });
      setStatus('Caméra active. Présentez le QR devant l’objectif.');
      const detect = async () => {
        if (!running.current || !mounted.current) return;
        try {
          const codes = await detector.detect(element);
          const value = codes.find(code => typeof code.rawValue === 'string')?.rawValue;
          if (value) {
            await submitScan(value);
            if (!running.current) return;
          }
        } catch {
          // Erreur ponctuelle de décodage : ne jamais valider par défaut.
        }
        if (running.current && mounted.current) animation.current = requestAnimationFrame(() => { void detect(); });
      };
      animation.current = requestAnimationFrame(() => { void detect(); });
    } catch {
      stopCamera();
      if (mounted.current) setStatus('Accès caméra refusé ou indisponible. Utilisez la saisie manuelle.');
    }
  }, [disabled, stopCamera, submitScan]);

  return (
    <section style={{ padding: 18, border: '1px solid #e5e7eb', borderRadius: 16, maxWidth: 540 }} aria-label="Lecture QR MESSAY">
      <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Scanner le billet MESSAY</h2>
      <p style={{ color: '#475467', fontSize: 13 }}>Lecture du QR uniquement. La validité et l’embarquement sont décidés par le serveur.</p>
      <video ref={video} muted playsInline autoPlay aria-label="Caméra de lecture QR" style={{ display: cameraOn ? 'block' : 'none', width: '100%', maxHeight: 300, borderRadius: 12, background: '#111' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" disabled={disabled || verifying || cameraOn} onClick={() => { void startCamera(); }}>Ouvrir la caméra</button>
        <button type="button" disabled={!cameraOn} onClick={stopCamera}>Arrêter la caméra</button>
      </div>
      <label htmlFor="messay-qr-manuel" style={{ display: 'block', marginTop: 15, marginBottom: 6 }}>Saisie manuelle du contenu QR</label>
      <input id="messay-qr-manuel" type="text" value={manual} maxLength={120} autoComplete="off" spellCheck={false} onChange={event => setManual(event.target.value)} placeholder="MESSAY:BUS:V1:xxxxxxxx-..." style={{ width: '100%', padding: 10, boxSizing: 'border-box' }} />
      <button style={{ marginTop: 8 }} type="button" disabled={disabled || verifying} onClick={() => { void submitScan(manual); }}>Transmettre pour vérification</button>
      <p role="status" aria-live="polite" style={{ marginTop: 12, color: '#475467', fontSize: 13 }}>{status}</p>
    </section>
  );
}
