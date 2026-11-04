import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Flashlight, X } from 'lucide-react';

const tanks = [
  { id: '11kg', name: '11kg Standard', description: 'Standard household gas cylinder' },
  { id: '2_7kg', name: '2.7kg Camping', description: 'Small portable camping tank' },
  { id: '50kg', name: '50kg Commercial', description: 'Industrial grade large cylinder' },
];

export default function ARViewer({ onBack }) {
  const [selected, setSelected] = useState(tanks[0]);
  const [cameraOpen, setCameraOpen] = useState(false);
  return <div className="customer-portal">
    <header className="customer-header"><button onClick={onBack}><ArrowLeft size={20} /> Back</button><span>AR visual guide</span></header>
    {cameraOpen ? <CameraGuide tank={selected} onClose={() => setCameraOpen(false)} /> : <main className="customer-main">
      <section className="customer-card">
        <span className="customer-eyebrow">SELECT YOUR TANK</span>
        <h1>Your cylinder, in view</h1>
        <p>Choose a reference to overlay on your live camera preview.</p>
        <div className="ar-tank-options" role="radiogroup" aria-label="Tank model">
          {tanks.map(tank => <button key={tank.id} role="radio" aria-checked={selected.id === tank.id} className={`ar-tank-option ${selected.id === tank.id ? 'selected' : ''}`} onClick={() => setSelected(tank)}>
            <img src={`/customer-ar/tank_${tank.id}.svg`} alt="" /><span><strong>{tank.name}</strong><small>{tank.description}</small></span>
          </button>)}
        </div>
        <p className="ar-info">Visual reference only. This guide does not measure remaining gas or detect leaks or cylinder safety.</p>
        <button className="customer-primary" onClick={() => setCameraOpen(true)}><Camera size={20} /> Start camera guide</button>
      </section>
    </main>}
  </div>;
}

function CameraGuide({ tank, onClose }) {
  const video = useRef(null);
  const stream = useRef(null);
  const [status, setStatus] = useState('starting');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [torch, setTorch] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [overlay, setOverlay] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let ownedStream = null;
    setStatus('starting'); setError(''); setTorch(false); setTorchSupported(false);
    const stop = () => {
      ownedStream?.getTracks().forEach(track => track.stop());
      if (stream.current === ownedStream) stream.current = null;
    };
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Open the app over HTTPS or use the installed Android app to access the camera.');
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (cancelled) { media.getTracks().forEach(track => track.stop()); return; }
        ownedStream = media;
        if (document.hidden) { stop(); setStatus('paused'); return; }
        stream.current = media;
        video.current.srcObject = media;
        await video.current.play();
        if (cancelled) return;
        setTorchSupported(Boolean(media.getVideoTracks()[0]?.getCapabilities?.().torch));
        setStatus('ready');
      } catch (err) {
        stop();
        if (!cancelled) { setStatus('error'); setError(err.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your device settings, then retry.' : err.name === 'NotFoundError' ? 'No camera was found on this device.' : err.message || 'The camera could not start.'); }
      }
    };
    start();
    const hide = () => { if (document.hidden) { stop(); setStatus('paused'); setTorch(false); } };
    const pageHide = () => { stop(); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', pageHide);
    return () => { cancelled = true; stop(); document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', pageHide); };
  }, [attempt]);

  const toggleTorch = async () => {
    try {
      await stream.current?.getVideoTracks()[0]?.applyConstraints({ advanced: [{ torch: !torch }] });
      setTorch(value => !value);
    } catch { setError('The flashlight could not be changed on this camera.'); }
  };

  return <main className="ar-camera">
    <video ref={video} autoPlay playsInline muted aria-label="Live camera preview" />
    <div className="ar-camera-top"><strong>{tank.name}</strong><button onClick={onClose} aria-label="Close camera"><X size={24} /></button></div>
    {status === 'ready' && <div className="ar-reference-frame" aria-label={`${tank.name} alignment reference`}>
      {overlay && <img src={`/customer-ar/tank_${tank.id}.svg`} alt={`${tank.name} reference overlay`} />}
    </div>}
    <div className="ar-camera-controls">
      <p role="status">{status === 'starting' ? 'Starting camera…' : status === 'paused' ? 'Camera paused while the app was in the background.' : status === 'ready' ? 'Line up the cylinder with the reference frame.' : 'Camera unavailable'}</p>
      {error && <p role="alert">{error}</p>}
      {(status === 'error' || status === 'paused') && <button onClick={() => setAttempt(value => value + 1)}>Retry camera</button>}
      {status === 'ready' && <div className="ar-control-row"><button onClick={() => setOverlay(value => !value)}>{overlay ? 'Hide reference' : 'Show reference'}</button>{torchSupported && <button onClick={toggleTorch} aria-pressed={torch}><Flashlight size={18} /> Flashlight</button>}</div>}
      <small>Visual reference only · No gas-level or safety analysis</small>
    </div>
  </main>;
}
