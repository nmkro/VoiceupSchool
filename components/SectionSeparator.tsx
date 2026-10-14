import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Mic, Palette, Trash2, Brush, Music2, Loader2, Play, Pause, RotateCcw, Zap, Flame, Heart } from 'lucide-react';

interface SeparatorProps {
  type: 'piano' | 'notes' | 'paint' | 'theater' | 'dance';
}

interface FloatingNote {
  id: number;
  label: string;
  x: number;
  y: number;
}

interface FloatingEffect {
  id: number;
  text: string;
  x: number;
  y: number;
}

interface DanceRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

const noteFrequencies: Record<string, number> = {
  'do': 261.63,
  'do#': 277.18,
  're': 293.66,
  're#': 311.13,
  'mi': 329.63,
  'fa': 349.23,
  'fa#': 369.99,
  'sol': 392.00,
  'sol#': 415.30,
  'la': 440.00,
  'la#': 466.16,
  'si': 493.88
};

// --- AUDIO UTILS ---
const getAudioContext = () => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  return new AudioContextClass();
};

const createReverbBuffer = (ctx: AudioContext) => {
  const duration = 2.5;
  const decay = 2.0;
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = i / length;
    left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
    right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
  }
  return impulse;
};

const SectionSeparator: React.FC<SeparatorProps> = ({ type }) => {
  const [activeNotes, setActiveNotes] = useState<FloatingNote[]>([]);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);
  
  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sampleBufferRef = useRef<AudioBuffer | null>(null);
  const reverbNodeRef = useRef<ConvolverNode | null>(null);
  const [isSampleLoaded, setIsSampleLoaded] = useState(false);
  
  // Interaction Refs
  const isDragging = useRef(false);
  const lastKeyId = useRef<string | null>(null);
  const pianoContainerRef = useRef<HTMLDivElement>(null);

  // Paint Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const hueRef = useRef(0);

  // Choir State
  const [activeSingers, setActiveSingers] = useState<number[]>([]);
  const activeVoicesRef = useRef<Record<number, { source: AudioBufferSourceNode, gain: GainNode } | null>>({});

  // ==========================================
  // --- ACTORIE INTERACTIVE CHARACTER STATE ---
  // ==========================================
  type ActorEmotion = 'happy' | 'drama' | 'surprise' | 'hero' | 'bow';
  const [actorPose, setActorPose] = useState<ActorEmotion>('happy');
  const [actorQuote, setActorQuote] = useState('„Un zâmbet este cheia care deschide orice rol minunat!”');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [spotlightPos, setSpotlightPos] = useState({ x: 280, y: 90 });
  const [floatingTheater, setFloatingTheater] = useState<FloatingEffect[]>([]);

  // ==========================================
  // --- DANS INTERACTIVE CHARACTER STATE ---
  // ==========================================
  type DanceMove = 'idle' | 'left' | 'jump' | 'drop' | 'right' | 'spin';
  const [danceMove, setDanceMove] = useState<DanceMove>('idle');
  const [danceCombo, setDanceCombo] = useState(0);
  const [isAutoRoutine, setIsAutoRoutine] = useState(false);
  const [floatingDance, setFloatingDance] = useState<FloatingEffect[]>([]);
  const danceCanvasRef = useRef<HTMLCanvasElement>(null);
  const danceContainerRef = useRef<HTMLDivElement>(null);
  const danceRipplesRef = useRef<DanceRipple[]>([]);
  const autoRoutineIntervalRef = useRef<number | null>(null);
  const autoRoutineStepRef = useRef(0);

  const voices = [
    { id: 0, label: 'Bas', desc: 'Voce Gravă', color: 'bg-blue-600', mouth: 'w-8 h-3 rounded-full', playbackRate: 0.5, gain: 1.2 },
    { id: 1, label: 'Tenor', desc: 'Voce Medie', color: 'bg-green-500', mouth: 'w-7 h-5 rounded-[1rem]', playbackRate: 0.749, gain: 1.0 },
    { id: 2, label: 'Alto', desc: 'Voce Caldă', color: 'bg-pink-500', mouth: 'w-6 h-6 rounded-full', playbackRate: 1.25, gain: 0.9 },
    { id: 3, label: 'Sopran', desc: 'Voce Înaltă', color: 'bg-yellow-400', mouth: 'w-5 h-7 rounded-[2rem]', playbackRate: 2.0, gain: 0.8 }
  ];

  // Init Audio Context & Choir Sample
  useEffect(() => {
    const loadAudio = async () => {
      try {
        const ctx = getAudioContext();
        audioCtxRef.current = ctx;

        const reverb = ctx.createConvolver();
        reverb.buffer = createReverbBuffer(ctx);
        reverbNodeRef.current = reverb;
        reverb.connect(ctx.destination);

        if (type === 'notes') {
          const response = await fetch('https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/MusyngKite/choir_aahs-mp3/C4.mp3');
          const arrayBuffer = await response.arrayBuffer();
          const decodedAudio = await ctx.decodeAudioData(arrayBuffer);
          sampleBufferRef.current = decodedAudio;
          setIsSampleLoaded(true);
        }
      } catch (error) {
        console.error("Audio init error:", error);
      }
    };

    loadAudio();

    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [type]);

  const initAudioCtx = () => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  // --- PIANO LOGIC ---
  const playPianoNote = (label: string, octaveOffset: number) => {
    try {
      initAudioCtx();
      const ctx = audioCtxRef.current!;
      const now = ctx.currentTime;
      const frequency = noteFrequencies[label] * Math.pow(2, octaveOffset);
      
      const masterGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(frequency * 4, now);
      filter.frequency.exponentialRampToValueAtTime(frequency, now + 0.5);
      
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, now);
      
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.3, now + 0.01); 
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      osc.connect(masterGain);
      masterGain.connect(filter);
      filter.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 1.6);
    } catch (e) {}
  };

  const triggerPianoNote = (label: string, octave: number, clientX: number, clientY: number) => {
    const keyId = `${label}-${octave}`;
    if (lastKeyId.current === keyId) return;
    lastKeyId.current = keyId;
    setPressedKey(keyId);
    if (showHint) setShowHint(false);
    playPianoNote(label, octave);

    const newNote = { id: Math.random() + Date.now(), label, x: clientX, y: clientY };
    setActiveNotes((prev) => [...prev, newNote]);
    setTimeout(() => setActiveNotes((prev) => prev.filter((n) => n.id !== newNote.id)), 1200);
  };

  // --- CHOIR LOGIC ---
  const startSinging = (singerId: number) => {
    try {
      if (!isSampleLoaded || !sampleBufferRef.current || !audioCtxRef.current) return;
      initAudioCtx();
      
      if (activeVoicesRef.current[singerId]) return;

      const voiceData = voices.find(v => v.id === singerId);
      if (!voiceData) return;

      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      const source = ctx.createBufferSource();
      source.buffer = sampleBufferRef.current;
      source.playbackRate.value = voiceData.playbackRate;
      source.loop = true;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(voiceData.gain, now + 0.4);

      source.connect(gainNode);
      
      if (reverbNodeRef.current) {
        const reverbGain = ctx.createGain();
        reverbGain.gain.value = 0.5;
        gainNode.connect(reverbGain);
        reverbGain.connect(reverbNodeRef.current);
        
        const dryGain = ctx.createGain();
        dryGain.gain.value = 0.6;
        gainNode.connect(dryGain);
        dryGain.connect(ctx.destination);
      } else {
        gainNode.connect(ctx.destination);
      }

      source.start(now);
      activeVoicesRef.current[singerId] = { source, gain: gainNode };
      setActiveSingers(prev => [...prev, singerId]);
    } catch (e) { console.error(e); }
  };

  const stopSinging = (singerId: number) => {
    const voiceNode = activeVoicesRef.current[singerId];
    const ctx = audioCtxRef.current;
    if (voiceNode && ctx) {
      const { source, gain } = voiceNode;
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      source.stop(now + 0.35);
    }
    activeVoicesRef.current[singerId] = null;
    setActiveSingers(prev => prev.filter(id => id !== singerId));
  };

  // --- ACTOR VOICE & SOUND DESIGN ---
  const playActorReactionSound = (emotion: ActorEmotion) => {
    try {
      initAudioCtx();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      if (emotion === 'happy') {
        // Cheerful rising laughter / arpeggio
        const pitches = [523.25, 659.25, 783.99, 1046.50];
        pitches.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.2, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.28);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.3);
        });
      } else if (emotion === 'drama') {
        // Dramatic minor cello swelling sigh
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(146.83, now + 0.5);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, now);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.65);
      } else if (emotion === 'surprise') {
        // Fast upward pitch sweep (gasp effect)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.31);
      } else if (emotion === 'hero') {
        // Triumphant brass fanfare
        const notes = [261.63, 329.63, 392.00, 523.25];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0.18, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.65);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.7);
        });
      } else if (emotion === 'bow') {
        // Crowd applause noise buffer
        const duration = 2.0;
        const bufferSize = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          const t = i / ctx.sampleRate;
          const env = Math.min(1, t * 5) * Math.max(0, 1 - Math.pow(t / duration, 1.4));
          const clapPulse = Math.sin(t * 22 * Math.PI) * 0.4 + 0.6;
          data[i] = (Math.random() * 2 - 1) * env * (0.3 + 0.7 * clapPulse);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
      }
    } catch (e) {}
  };

  const commandActor = (emotion: ActorEmotion, quote: string, reactionText: string, e?: React.MouseEvent) => {
    setActorPose(emotion);
    setActorQuote(quote);
    setIsSpeaking(true);
    playActorReactionSound(emotion);
    if (showHint) setShowHint(false);

    const x = e ? e.clientX : window.innerWidth / 2;
    const y = e ? e.clientY : 120;
    const effect = { id: Math.random() + Date.now(), text: reactionText, x, y };
    setFloatingTheater(prev => [...prev, effect]);
    setTimeout(() => setFloatingTheater(prev => prev.filter(item => item.id !== effect.id)), 1200);

    setTimeout(() => setIsSpeaking(false), 2000);
  };

  // --- DANCER SOUND & STEP ENGINE ---
  const playDanceSound = useCallback((moveId: string) => {
    try {
      initAudioCtx();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      if (moveId === 'left') {
        // Tight 808 Kick
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.1);
        gain.gain.setValueAtTime(0.85, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (moveId === 'jump') {
        // Snare / Rimshot
        const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1900, now);
        filter.Q.setValueAtTime(1.8, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
      } else if (moveId === 'drop') {
        // Sub-bass 808 boom
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(95, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.28);
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (moveId === 'right') {
        // Crisp Hi-Hat + Clap
        const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(8000, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
      } else if (moveId === 'spin') {
        // DJ Scratch
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.linearRampToValueAtTime(920, now + 0.09);
        osc.frequency.linearRampToValueAtTime(320, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.26);
      }
    } catch (e) {}
  }, []);

  const commandDancer = useCallback((move: DanceMove, label: string, color: string, e?: React.MouseEvent) => {
    setDanceMove(move);
    playDanceSound(move);
    setDanceCombo(prev => prev + 1);
    if (showHint) setShowHint(false);

    // Ripple effect on dance floor
    if (danceContainerRef.current) {
      const rect = danceContainerRef.current.getBoundingClientRect();
      const x = e ? e.clientX - rect.left : rect.width / 2;
      const y = e ? e.clientY - rect.top : rect.height / 2 + 30;
      danceRipplesRef.current.push({
        x,
        y,
        radius: 12,
        maxRadius: 190,
        color,
        alpha: 0.85
      });
    }

    const xScreen = e ? e.clientX : window.innerWidth / 2;
    const yScreen = e ? e.clientY : 120;
    const effect = { id: Math.random() + Date.now(), text: label, x: xScreen, y: yScreen };
    setFloatingDance(prev => [...prev, effect]);
    setTimeout(() => setFloatingDance(prev => prev.filter(item => item.id !== effect.id)), 900);

    setTimeout(() => setDanceMove('idle'), 500);
  }, [playDanceSound, showHint]);

  // Keyboard controls for dancer
  useEffect(() => {
    if (type !== 'dance') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'ArrowLeft') commandDancer('left', '⬅️ PAS STÂNGA!', '#06b6d4');
        if (e.key === 'ArrowUp') commandDancer('jump', '⬆️ SALT ÎN AER!', '#f59e0b');
        if (e.key === 'ArrowDown') commandDancer('drop', '⬇️ DROP FREEZE!', '#ec4899');
        if (e.key === 'ArrowRight') commandDancer('right', '➡️ WAVE & POP!', '#10b981');
        if (e.key === ' ') commandDancer('spin', '🔄 PIRUETĂ 360°!', '#8b5cf6');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [type, commandDancer]);

  // Dance Floor Canvas Visualizer
  useEffect(() => {
    if (type !== 'dance') return;
    const canvas = danceCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      phase += 0.05;

      // Equalizer bars along the floor
      const count = 32;
      const barW = canvas.width / count;
      const amp = isAutoRoutine ? 28 : 12;

      for (let i = 0; i < count; i++) {
        const h = Math.sin(phase + i * 0.3) * amp + amp;
        const x = i * barW;
        const y = canvas.height - h;
        const grad = ctx.createLinearGradient(0, y, 0, canvas.height);
        grad.addColorStop(0, 'rgba(20, 184, 166, 0.6)');
        grad.addColorStop(1, 'rgba(6, 182, 212, 0.05)');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y, barW - 2, h);
      }

      // Animated Floor Shockwave Ripples
      const ripples = danceRipplesRef.current;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += 7;
        r.alpha *= 0.93;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = Math.max(0, r.alpha);
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        if (r.radius > r.maxRadius || r.alpha < 0.02) {
          ripples.splice(i, 1);
        }
      }

      animId = requestAnimationFrame(render);
    };

    const handleResize = () => {
      if (danceContainerRef.current && canvas) {
        canvas.width = danceContainerRef.current.clientWidth;
        canvas.height = danceContainerRef.current.clientHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [type, isAutoRoutine]);

  // Dance Auto-Routine Loop
  useEffect(() => {
    if (!isAutoRoutine || type !== 'dance') {
      if (autoRoutineIntervalRef.current) clearInterval(autoRoutineIntervalRef.current);
      return;
    }

    const moves: DanceMove[] = ['left', 'jump', 'right', 'drop', 'spin', 'jump'];
    const labels = ['⬅️ STEP!', '⬆️ AIR JUMP!', '➡️ GROOVE!', '⬇️ FREEZE!', '🔄 360° SPIN!', '⚡ POWER!'];
    const colors = ['#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#f59e0b'];

    autoRoutineIntervalRef.current = window.setInterval(() => {
      const idx = autoRoutineStepRef.current % moves.length;
      commandDancer(moves[idx], labels[idx], colors[idx]);
      autoRoutineStepRef.current += 1;
    }, 450);

    return () => {
      if (autoRoutineIntervalRef.current) clearInterval(autoRoutineIntervalRef.current);
    };
  }, [isAutoRoutine, type, commandDancer]);

  // --- PAINT LOGIC ---
  useEffect(() => {
    if (type !== 'paint') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setSize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    setSize();
    window.addEventListener('resize', setSize);
    return () => window.removeEventListener('resize', setSize);
  }, [type]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    isDrawing.current = true;
    setShowHint(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    lastPos.current = { x: clientX - rect.left, y: clientY - rect.top };
    draw(e); 
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !lastPos.current || !canvasRef.current) return;
    if ((e.target as HTMLElement).closest('button')) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const currentX = clientX - rect.left;
    const currentY = clientY - rect.top;
    hueRef.current = (hueRef.current + 2) % 360;
    
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(currentX, currentY);
    ctx.strokeStyle = `hsl(${hueRef.current}, 75%, 60%)`;
    
    const isMobile = window.innerWidth < 768;
    ctx.lineWidth = isMobile ? 8 : 20;
    ctx.lineCap = 'round'; 
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 2;
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.stroke();
    lastPos.current = { x: currentX, y: currentY };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setShowHint(true);
    }
  };

  const handleStart = (fn: () => void) => { isDragging.current = true; fn(); };
  const handleEnd = () => { isDragging.current = false; lastKeyId.current = null; setPressedKey(null); };

  // =========================================================================
  // --- 1. THEATER: INTERACTIVE ACTOR ON STAGE (MIMICRY, GESTURES, VOICE) ---
  // =========================================================================
  if (type === 'theater') {
    const emotionSpotlights = {
      happy: { bg: 'rgba(245, 158, 11, 0.45)', color: 'from-amber-400 to-yellow-500' },
      drama: { bg: 'rgba(99, 102, 241, 0.45)', color: 'from-indigo-600 to-blue-700' },
      surprise: { bg: 'rgba(20, 184, 166, 0.45)', color: 'from-teal-400 to-cyan-500' },
      hero: { bg: 'rgba(239, 68, 68, 0.45)', color: 'from-red-600 to-rose-700' },
      bow: { bg: 'rgba(168, 85, 247, 0.45)', color: 'from-purple-500 to-pink-600' }
    };

    const currentSpot = emotionSpotlights[actorPose];

    return (
      <div 
        className="relative w-full min-h-[300px] sm:min-h-[320px] py-4 my-6 sm:my-8 overflow-hidden select-none border-y-2 border-amber-950/60 shadow-inner flex flex-col justify-between"
        style={{
          background: 'linear-gradient(to bottom, #100a07 0%, #20130d 45%, #140b07 100%)'
        }}
      >
        {/* Floating Reaction Tags */}
        <div className="fixed inset-0 pointer-events-none z-[9999]">
          {floatingTheater.map(item => (
            <div
              key={item.id}
              className="absolute animate-note-pop font-black text-2xl sm:text-4xl text-amber-300 drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] select-none italic tracking-wider"
              style={{ left: item.x, top: item.y }}
            >
              {item.text}
            </div>
          ))}
        </div>

        {/* Dynamic Overhead Followspot centered on Actor */}
        <div 
          className="absolute inset-0 pointer-events-none transition-all duration-500"
          style={{
            background: `radial-gradient(circle 160px at 50% 50%, ${currentSpot.bg} 0%, rgba(0,0,0,0) 70%)`
          }}
        />

        {/* Wooden stage plank perspective lines */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(255,255,255,0.15) 28px, rgba(255,255,255,0.15) 29px)'
          }}
        />

        {/* Side Velvet Curtains */}
        <div className="absolute top-0 bottom-0 left-0 w-8 sm:w-16 bg-gradient-to-r from-red-950 via-rose-900 to-transparent pointer-events-none opacity-80 z-10" />
        <div className="absolute top-0 bottom-0 right-0 w-8 sm:w-16 bg-gradient-to-l from-red-950 via-rose-900 to-transparent pointer-events-none opacity-80 z-10" />

        {/* TOP: Speech Bubble with Active Actor Line */}
        <div className="relative z-20 flex justify-center px-4 pt-1">
          <div className="relative bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-2xl border-2 border-amber-300 max-w-lg text-center transition-transform duration-300">
            <span className="text-[10px] font-black uppercase text-amber-600 block tracking-wider">
              Replica Actorului • Mimică & Gesturi
            </span>
            <p className="text-sm sm:text-base font-bold text-gray-900 leading-snug">
              {actorQuote}
            </p>
            {/* Speech bubble tail */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rotate-45 border-r-2 border-b-2 border-amber-300" />
          </div>
        </div>

        {/* CENTER STAGE: THE LIVING, ANIMATED ACTOR */}
        <div className="relative z-20 flex flex-col items-center justify-center my-1">
          {/* Spotlight floor circle under actor's feet */}
          <div 
            className="absolute -bottom-2 w-44 sm:w-56 h-10 rounded-[50%] blur-sm transition-colors duration-500"
            style={{ background: currentSpot.bg }}
          />

          {/* SVG ACTOR CHARACTER with Reactive Mimicry & Gestures */}
          <div className={`relative transition-transform duration-300 ease-out ${
            actorPose === 'happy' ? 'translate-y-0 scale-105' :
            actorPose === 'drama' ? 'translate-y-1' :
            actorPose === 'surprise' ? '-translate-y-3 scale-110' :
            actorPose === 'hero' ? 'scale-110' :
            'translate-y-2'
          }`}>
            <svg 
              width="130" 
              height="130" 
              viewBox="0 0 130 130" 
              className="drop-shadow-2xl overflow-visible"
            >
              {/* Hero Cape (when in hero mode) */}
              {actorPose === 'hero' && (
                <path 
                  d="M 40 60 Q 20 90 25 120 Q 65 125 105 120 Q 110 90 90 60 Z" 
                  fill="#b91c1c" 
                  className="animate-pulse"
                />
              )}

              {/* Actor Body / Stage Costume */}
              <rect x="42" y="68" width="46" height="42" rx="10" fill="#1c1917" stroke="#fbbf24" strokeWidth="2.5" />
              {/* Gold buttons on vest */}
              <circle cx="65" cy="78" r="2.5" fill="#f59e0b" />
              <circle cx="65" cy="88" r="2.5" fill="#f59e0b" />
              <circle cx="65" cy="98" r="2.5" fill="#f59e0b" />

              {/* Left Arm Gesture */}
              {actorPose === 'happy' && (
                <path d="M 42 75 Q 22 55 18 40" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" />
              )}
              {actorPose === 'drama' && (
                <path d="M 42 78 Q 55 82 62 82" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" />
              )}
              {actorPose === 'surprise' && (
                <path d="M 42 78 Q 30 65 38 48" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" />
              )}
              {actorPose === 'hero' && (
                <path d="M 42 78 Q 28 85 34 95" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" />
              )}
              {actorPose === 'bow' && (
                <path d="M 42 78 Q 32 90 40 102" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" />
              )}

              {/* Right Arm Gesture */}
              {actorPose === 'happy' && (
                <path d="M 88 75 Q 108 55 112 40" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" />
              )}
              {actorPose === 'drama' && (
                <path d="M 88 78 Q 110 65 118 55" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" />
              )}
              {actorPose === 'surprise' && (
                <path d="M 88 78 Q 100 65 92 48" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" />
              )}
              {actorPose === 'hero' && (
                <path d="M 88 78 Q 102 85 96 95" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" />
              )}
              {actorPose === 'bow' && (
                <path d="M 88 78 Q 75 92 65 92" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none" />
              )}

              {/* Legs / Stage Pants */}
              <rect x="47" y="106" width="14" height="20" rx="4" fill="#0f172a" />
              <rect x="69" y="106" width="14" height="20" rx="4" fill="#0f172a" />
              {/* Shoes */}
              <ellipse cx="54" cy="126" rx="9" ry="4" fill="#d97706" />
              <ellipse cx="76" cy="126" rx="9" ry="4" fill="#d97706" />

              {/* Head */}
              <circle cx="65" cy="46" r="26" fill="#fed7aa" stroke="#f59e0b" strokeWidth="2" />
              {/* Theatrical Hair / Beret */}
              <path d="M 40 40 Q 65 18 90 40 Q 82 28 65 28 Q 48 28 40 40 Z" fill="#451a03" />

              {/* --- EYES MORPHING (MIMICRY) --- */}
              {actorPose === 'happy' && (
                <g stroke="#451a03" strokeWidth="3" fill="none" strokeLinecap="round">
                  <path d="M 52 44 Q 57 39 62 44" />
                  <path d="M 68 44 Q 73 39 78 44" />
                  {/* Rosy Cheeks */}
                  <circle cx="49" cy="49" r="4" fill="#fda4af" stroke="none" />
                  <circle cx="81" cy="49" r="4" fill="#fda4af" stroke="none" />
                </g>
              )}
              {actorPose === 'drama' && (
                <g>
                  {/* Sad downturned brows */}
                  <path d="M 52 40 L 61 44" stroke="#451a03" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M 78 40 L 69 44" stroke="#451a03" strokeWidth="2.5" strokeLinecap="round" />
                  {/* Tearful eyes */}
                  <circle cx="56" cy="45" r="3" fill="#1e293b" />
                  <circle cx="74" cy="45" r="3" fill="#1e293b" />
                  {/* Teardrop */}
                  <circle cx="77" cy="53" r="2.5" fill="#38bdf8" className="animate-bounce" />
                </g>
              )}
              {actorPose === 'surprise' && (
                <g>
                  {/* Raised brows */}
                  <path d="M 52 38 Q 57 35 62 38" stroke="#451a03" strokeWidth="2" fill="none" />
                  <path d="M 68 38 Q 73 35 78 38" stroke="#451a03" strokeWidth="2" fill="none" />
                  {/* Wide eyes */}
                  <circle cx="57" cy="44" r="5" fill="white" stroke="#1e293b" strokeWidth="1.5" />
                  <circle cx="57" cy="44" r="2.5" fill="#1e293b" />
                  <circle cx="73" cy="44" r="5" fill="white" stroke="#1e293b" strokeWidth="1.5" />
                  <circle cx="73" cy="44" r="2.5" fill="#1e293b" />
                </g>
              )}
              {actorPose === 'hero' && (
                <g>
                  {/* Fierce angled hero brows */}
                  <path d="M 51 40 L 62 43" stroke="#451a03" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 79 40 L 68 43" stroke="#451a03" strokeWidth="3" strokeLinecap="round" />
                  {/* Determined hero eyes */}
                  <circle cx="57" cy="45" r="3" fill="#0f172a" />
                  <circle cx="73" cy="45" r="3" fill="#0f172a" />
                  {/* Sparkle star in hero eye */}
                  <polygon points="73,43 74,45 76,45 74,46 75,48 73,47 71,48 72,46 70,45 72,45" fill="#fbbf24" />
                </g>
              )}
              {actorPose === 'bow' && (
                <g stroke="#451a03" strokeWidth="2.5" fill="none" strokeLinecap="round">
                  {/* Serene closed eyes */}
                  <path d="M 52 46 Q 57 49 62 46" />
                  <path d="M 68 46 Q 73 49 78 46" />
                </g>
              )}

              {/* --- MOUTH MORPHING (VOICE & EXPRESSION) --- */}
              {actorPose === 'happy' && (
                <path d="M 54 54 Q 65 67 76 54 Z" fill="#dc2626" stroke="#451a03" strokeWidth="1.5" />
              )}
              {actorPose === 'drama' && (
                <ellipse cx="65" cy="57" rx="5" ry="4" fill="#450a0a" stroke="#451a03" strokeWidth="1" />
              )}
              {actorPose === 'surprise' && (
                <ellipse cx="65" cy="57" rx="5" ry="7" fill="#0f172a" stroke="#451a03" strokeWidth="1.5" />
              )}
              {actorPose === 'hero' && (
                <path d="M 55 56 Q 65 62 75 55" stroke="#451a03" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              )}
              {actorPose === 'bow' && (
                <path d="M 56 55 Q 65 60 74 55" stroke="#451a03" strokeWidth="2" fill="none" strokeLinecap="round" />
              )}
            </svg>
          </div>
        </div>

        {/* BOTTOM: DIRECT INTERACTION COMMAND BUTTONS */}
        <div className="relative z-20 w-full px-2 sm:px-6">
          <div className="text-center mb-1.5">
            <span className="text-[11px] font-bold text-amber-200/80">
              Apasă o comandă pentru a schimba mimica, vocea și gesturile actorului:
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5 max-w-3xl mx-auto pb-1">
            <button
              onClick={(e) => commandActor(
                'happy',
                '„Râsul este cel mai scurt drum între doi oameni! Intră în scenă!”',
                '😄 BUCURIE!',
                e
              )}
              className={`py-2 px-1 rounded-xl text-xs font-black border transition-all active:scale-95 flex flex-col items-center justify-center ${
                actorPose === 'happy'
                  ? 'bg-amber-400 text-stone-950 border-white shadow-lg shadow-amber-400/50 scale-105'
                  : 'bg-black/50 text-stone-200 border-white/10 hover:border-amber-400/50 hover:bg-black/70'
              }`}
            >
              <span className="text-base sm:text-lg">😄</span>
              <span className="text-[10px] sm:text-xs">Bucurie</span>
            </button>

            <button
              onClick={(e) => commandActor(
                'drama',
                '„A fi sau a nu fi... aceasta-i întrebarea! Trăiește fiecare replică!”',
                '🎭 DRAMĂ!',
                e
              )}
              className={`py-2 px-1 rounded-xl text-xs font-black border transition-all active:scale-95 flex flex-col items-center justify-center ${
                actorPose === 'drama'
                  ? 'bg-indigo-600 text-white border-white shadow-lg shadow-indigo-600/50 scale-105'
                  : 'bg-black/50 text-stone-200 border-white/10 hover:border-indigo-400/50 hover:bg-black/70'
              }`}
            >
              <span className="text-base sm:text-lg">🎭</span>
              <span className="text-[10px] sm:text-xs">Dramă</span>
            </button>

            <button
              onClick={(e) => commandActor(
                'surprise',
                '„Incredibil! Nu mă așteptam la o asemenea întorsătură de situație pe scenă!”',
                '😲 SURPRIZĂ!',
                e
              )}
              className={`py-2 px-1 rounded-xl text-xs font-black border transition-all active:scale-95 flex flex-col items-center justify-center ${
                actorPose === 'surprise'
                  ? 'bg-teal-500 text-stone-950 border-white shadow-lg shadow-teal-500/50 scale-105'
                  : 'bg-black/50 text-stone-200 border-white/10 hover:border-teal-400/50 hover:bg-black/70'
              }`}
            >
              <span className="text-base sm:text-lg">😲</span>
              <span className="text-[10px] sm:text-xs">Surpriză</span>
            </button>

            <button
              onClick={(e) => commandActor(
                'hero',
                '„Scena este regatul tău! Fii curajos și cucerește reflectoarele!”',
                '🦁 EROU!',
                e
              )}
              className={`py-2 px-1 rounded-xl text-xs font-black border transition-all active:scale-95 flex flex-col items-center justify-center ${
                actorPose === 'hero'
                  ? 'bg-rose-600 text-white border-white shadow-lg shadow-rose-600/50 scale-105'
                  : 'bg-black/50 text-stone-200 border-white/10 hover:border-rose-400/50 hover:bg-black/70'
              }`}
            >
              <span className="text-base sm:text-lg">🦁</span>
              <span className="text-[10px] sm:text-xs">Erou</span>
            </button>

            <button
              onClick={(e) => commandActor(
                'bow',
                '„Vă mulțumesc din suflet, public minunat! Sunteți extraordinari!”',
                '👏 APLAUZE!',
                e
              )}
              className={`py-2 px-1 rounded-xl text-xs font-black border transition-all active:scale-95 flex flex-col items-center justify-center ${
                actorPose === 'bow'
                  ? 'bg-purple-600 text-white border-white shadow-lg shadow-purple-600/50 scale-105'
                  : 'bg-black/50 text-stone-200 border-white/10 hover:border-purple-400/50 hover:bg-black/70'
              }`}
            >
              <span className="text-base sm:text-lg">👑</span>
              <span className="text-[10px] sm:text-xs">Plecăciune</span>
            </button>
          </div>
        </div>

        {/* Footlights */}
        <div className="relative z-20 w-full flex justify-around px-2 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-1.5 h-3 opacity-40 blur-[1px] bg-gradient-to-t from-amber-400 to-transparent" />
              <div className="w-1.5 h-1 rounded-full bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // =========================================================================
  // --- 2. DANS: THE LIVING DANCER CHARACTER (MOVEMENT, RHYTHM, POSES) ---
  // =========================================================================
  if (type === 'dance') {
    return (
      <div 
        ref={danceContainerRef}
        className="relative w-full min-h-[300px] sm:min-h-[320px] py-4 my-6 sm:my-8 overflow-hidden select-none border-y-2 border-teal-900/60 bg-gray-950 flex flex-col justify-between shadow-inner"
      >
        {/* Floating Step Markers */}
        <div className="fixed inset-0 pointer-events-none z-[9999]">
          {floatingDance.map(item => (
            <div
              key={item.id}
              className="absolute animate-note-pop font-black text-2xl sm:text-4xl text-teal-300 drop-shadow-[0_4px_12px_rgba(20,184,166,0.9)] select-none italic tracking-wider"
              style={{ left: item.x, top: item.y }}
            >
              {item.text}
            </div>
          ))}
        </div>

        {/* Canvas Real-Time Sound Visualizer Wave & Floor Ripples */}
        <canvas 
          ref={danceCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* Sprung Dance Studio Floor Grid */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(20,184,166,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(20,184,166,0.2) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />

        {/* TOP BAR: Metronome, Beat Routine & Combo Counter */}
        <div className="relative z-20 flex items-center justify-between px-3 sm:px-8 gap-2">
          {/* Routine Loop Toggle */}
          <button
            onClick={() => setIsAutoRoutine(prev => !prev)}
            className={`px-3.5 py-1.5 rounded-full font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-lg ${
              isAutoRoutine
                ? 'bg-teal-400 text-gray-950 shadow-teal-400/50 animate-pulse'
                : 'bg-white/10 hover:bg-white/20 text-teal-300 border border-teal-500/30'
            }`}
          >
            {isAutoRoutine ? <Pause size={12} /> : <Play size={12} />}
            <span>{isAutoRoutine ? 'Dans Continuu Activ' : '▶ Pornește Dans Continuu'}</span>
          </button>

          {/* Slogan */}
          <div className="hidden sm:flex items-center gap-2 text-teal-300/80 text-xs font-bold">
            <Zap size={14} className="text-teal-400" />
            <span>Controlează mișcările dansatorului în timp real!</span>
          </div>

          {/* Combo Multiplier */}
          <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full border border-teal-500/30 text-xs font-black text-white">
            <Flame size={14} className="text-amber-400 animate-pulse" />
            <span>Combo: <span className="text-teal-300 font-extrabold">{danceCombo}x</span></span>
            <button
              onClick={() => setDanceCombo(0)}
              className="text-gray-400 hover:text-white ml-1 text-[10px]"
              title="Resetează"
            >
              <RotateCcw size={10} />
            </button>
          </div>
        </div>

        {/* CENTER STAGE: THE LIVING, MOVING DANCER */}
        <div className="relative z-20 flex flex-col items-center justify-center my-1">
          {/* Glowing floor ring under dancer's feet */}
          <div className="absolute -bottom-2 w-48 sm:w-60 h-10 rounded-[50%] bg-teal-500/25 border border-teal-400/50 shadow-[0_0_35px_rgba(20,184,166,0.4)] animate-pulse" />

          {/* SVG DANCER CHARACTER with Reactive Dance Poses & Physics */}
          <div className={`relative transition-all duration-200 ease-out ${
            danceMove === 'idle' ? 'translate-y-0' :
            danceMove === 'left' ? '-translate-x-10 -rotate-12' :
            danceMove === 'jump' ? '-translate-y-9 scale-110' :
            danceMove === 'drop' ? 'translate-y-6 scale-y-75' :
            danceMove === 'right' ? 'translate-x-10 rotate-12' :
            'rotate-[360deg] scale-105 duration-500'
          }`}>
            <svg 
              width="130" 
              height="130" 
              viewBox="0 0 130 130" 
              className="drop-shadow-2xl overflow-visible"
            >
              {/* Dancer Torso / Urban Street Hoodie */}
              <rect x="42" y="58" width="46" height="42" rx="10" fill="#0f766e" stroke="#2dd4bf" strokeWidth="2.5" />
              {/* Hoodie Neon Logo */}
              <path d="M 65 68 L 60 78 L 70 78 Z" fill="#facc15" />

              {/* Arms Animation per Move */}
              {danceMove === 'idle' && (
                <g stroke="#2dd4bf" strokeWidth="7" strokeLinecap="round" fill="none">
                  <path d="M 42 66 Q 30 78 35 90" />
                  <path d="M 88 66 Q 100 78 95 90" />
                </g>
              )}
              {danceMove === 'left' && (
                <g stroke="#2dd4bf" strokeWidth="7" strokeLinecap="round" fill="none">
                  <path d="M 42 66 L 15 50" />
                  <path d="M 88 66 Q 80 85 75 92" />
                </g>
              )}
              {danceMove === 'jump' && (
                <g stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" fill="none">
                  <path d="M 42 66 L 20 28" />
                  <path d="M 88 66 L 110 28" />
                </g>
              )}
              {danceMove === 'drop' && (
                <g stroke="#ec4899" strokeWidth="7" strokeLinecap="round" fill="none">
                  <path d="M 42 66 L 25 95" />
                  <path d="M 88 66 Q 105 75 95 60" />
                </g>
              )}
              {danceMove === 'right' && (
                <g stroke="#10b981" strokeWidth="7" strokeLinecap="round" fill="none">
                  <path d="M 42 66 Q 50 85 55 92" />
                  <path d="M 88 66 L 115 50" />
                </g>
              )}
              {danceMove === 'spin' && (
                <g stroke="#a855f7" strokeWidth="7" strokeLinecap="round" fill="none">
                  <path d="M 42 66 L 18 66" />
                  <path d="M 88 66 L 112 66" />
                </g>
              )}

              {/* Legs / Jogger Pants */}
              {danceMove === 'jump' ? (
                <g fill="#1e1b4b">
                  {/* Split kick in mid air */}
                  <rect x="36" y="94" width="14" height="24" rx="4" transform="rotate(-30 43 106)" />
                  <rect x="80" y="94" width="14" height="24" rx="4" transform="rotate(30 87 106)" />
                  {/* High top sneakers */}
                  <ellipse cx="28" cy="118" rx="10" ry="5" fill="#facc15" />
                  <ellipse cx="102" cy="118" rx="10" ry="5" fill="#facc15" />
                </g>
              ) : danceMove === 'drop' ? (
                <g fill="#1e1b4b">
                  {/* Low squat freeze */}
                  <rect x="34" y="94" width="28" height="12" rx="4" />
                  <rect x="68" y="94" width="28" height="12" rx="4" />
                  <ellipse cx="32" cy="106" rx="9" ry="5" fill="#ec4899" />
                  <ellipse cx="98" cy="106" rx="9" ry="5" fill="#ec4899" />
                </g>
              ) : (
                <g fill="#1e1b4b">
                  <rect x="47" y="96" width="14" height="22" rx="4" />
                  <rect x="69" y="96" width="14" height="22" rx="4" />
                  <ellipse cx="54" cy="120" rx="9" ry="5" fill="#14b8a6" />
                  <ellipse cx="76" cy="120" rx="9" ry="5" fill="#14b8a6" />
                </g>
              )}

              {/* Head with Neon Cap & Sunglasses */}
              <circle cx="65" cy="36" r="22" fill="#fed7aa" stroke="#2dd4bf" strokeWidth="2" />
              {/* Backwards Street Cap */}
              <path d="M 43 32 Q 65 14 87 32 Q 95 35 98 33" stroke="#f43f5e" strokeWidth="5" fill="#f43f5e" strokeLinecap="round" />
              {/* Cool Sunglasses with Neon Glare */}
              <rect x="50" y="32" width="30" height="9" rx="4.5" fill="#09090b" stroke="#facc15" strokeWidth="1.5" />
              <line x1="53" y1="36" x2="61" y2="36" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" />
              <line x1="68" y1="36" x2="76" y2="36" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" />

              {/* Big DJ Headphones */}
              <path d="M 43 36 Q 65 10 87 36" stroke="#ec4899" strokeWidth="4" fill="none" />
              <rect x="39" y="30" width="7" height="14" rx="3.5" fill="#ec4899" />
              <rect x="84" y="30" width="7" height="14" rx="3.5" fill="#ec4899" />
            </svg>
          </div>
        </div>

        {/* BOTTOM: DIRECT DANCE ACTION PADS */}
        <div className="relative z-20 w-full px-2 sm:px-6">
          <div className="text-center mb-1.5">
            <span className="text-[11px] font-bold text-teal-200/80">
              Apasă comenzile de jos pentru ca dansatorul să execute mișcarea în timp real:
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5 max-w-3xl mx-auto pb-1">
            <button
              onClick={(e) => commandDancer('left', '⬅️ PAS STÂNGA!', '#06b6d4', e)}
              className={`py-2 px-1 rounded-xl text-xs font-black border transition-all active:scale-95 flex flex-col items-center justify-center ${
                danceMove === 'left'
                  ? 'bg-cyan-400 text-gray-950 border-white shadow-lg shadow-cyan-400/60 scale-105'
                  : 'bg-stone-900/90 text-cyan-300 border-cyan-500/30 hover:border-cyan-400 hover:bg-stone-850'
              }`}
            >
              <span className="text-base sm:text-lg">⬅️</span>
              <span className="text-[10px] sm:text-xs">Pas Stânga</span>
            </button>

            <button
              onClick={(e) => commandDancer('jump', '⬆️ SALT ÎN AER!', '#f59e0b', e)}
              className={`py-2 px-1 rounded-xl text-xs font-black border transition-all active:scale-95 flex flex-col items-center justify-center ${
                danceMove === 'jump'
                  ? 'bg-amber-400 text-gray-950 border-white shadow-lg shadow-amber-400/60 scale-105'
                  : 'bg-stone-900/90 text-amber-300 border-amber-500/30 hover:border-amber-400 hover:bg-stone-850'
              }`}
            >
              <span className="text-base sm:text-lg">⬆️</span>
              <span className="text-[10px] sm:text-xs">Salt & Jump</span>
            </button>

            <button
              onClick={(e) => commandDancer('drop', '⬇️ DROP FREEZE!', '#ec4899', e)}
              className={`py-2 px-1 rounded-xl text-xs font-black border transition-all active:scale-95 flex flex-col items-center justify-center ${
                danceMove === 'drop'
                  ? 'bg-pink-500 text-white border-white shadow-lg shadow-pink-500/60 scale-105'
                  : 'bg-stone-900/90 text-pink-300 border-pink-500/30 hover:border-pink-400 hover:bg-stone-850'
              }`}
            >
              <span className="text-base sm:text-lg">⬇️</span>
              <span className="text-[10px] sm:text-xs">Drop Freeze</span>
            </button>

            <button
              onClick={(e) => commandDancer('right', '➡️ WAVE & POP!', '#10b981', e)}
              className={`py-2 px-1 rounded-xl text-xs font-black border transition-all active:scale-95 flex flex-col items-center justify-center ${
                danceMove === 'right'
                  ? 'bg-emerald-400 text-gray-950 border-white shadow-lg shadow-emerald-400/60 scale-105'
                  : 'bg-stone-900/90 text-emerald-300 border-emerald-500/30 hover:border-emerald-400 hover:bg-stone-850'
              }`}
            >
              <span className="text-base sm:text-lg">➡️</span>
              <span className="text-[10px] sm:text-xs">Pas Dreapta</span>
            </button>

            <button
              onClick={(e) => commandDancer('spin', '🔄 360° SPIN!', '#8b5cf6', e)}
              className={`py-2 px-1 rounded-xl text-xs font-black border transition-all active:scale-95 flex flex-col items-center justify-center ${
                danceMove === 'spin'
                  ? 'bg-purple-500 text-white border-white shadow-lg shadow-purple-500/60 scale-105'
                  : 'bg-stone-900/90 text-purple-300 border-purple-500/30 hover:border-purple-400 hover:bg-stone-850'
              }`}
            >
              <span className="text-base sm:text-lg">🔄</span>
              <span className="text-[10px] sm:text-xs">Rotire 360°</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // --- 3. CHOIR & VOCAL MINI-GAME ---
  // =========================================================================
  if (type === 'notes') { 
    return (
      <div className="relative w-full pt-12 pb-4 flex flex-col items-center justify-center my-4 select-none">
        {showHint && (
          <div className="absolute top-0 animate-bounce flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg border border-purple-100 z-20">
            <Music2 size={14} className="text-purple-500" />
            <span className="text-xs font-bold text-purple-600">Ascultă vocile reale! 🎵</span>
          </div>
        )}
        
        {!isSampleLoaded ? (
          <div className="flex flex-col items-center gap-2 animate-pulse text-purple-400">
            <Loader2 className="animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest">Se încarcă vocile...</span>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10 items-end min-h-[180px]">
            {voices.map((voice) => {
              const isSinging = activeSingers.includes(voice.id);
              return (
                <div 
                  key={voice.id}
                  onMouseEnter={() => startSinging(voice.id)}
                  onMouseLeave={() => stopSinging(voice.id)}
                  onTouchStart={(e) => { e.preventDefault(); startSinging(voice.id); }}
                  onTouchEnd={(e) => { e.preventDefault(); stopSinging(voice.id); }}
                  className={`relative group flex flex-col items-center justify-end transition-all duration-300 ${isSinging ? '-translate-y-4 scale-110' : 'hover:-translate-y-2'}`}
                >
                  <div className={`
                    w-20 h-20 sm:w-24 sm:h-24 rounded-full shadow-xl flex items-center justify-center 
                    transition-all duration-200 border-4 border-white cursor-pointer
                    ${voice.color} ${isSinging ? 'ring-4 ring-offset-2 ring-purple-300 brightness-110' : 'hover:brightness-105'}
                  `}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-3">
                        <div className={`bg-white rounded-full transition-all ${isSinging ? 'w-2 h-2' : 'w-2 h-1'}`}></div>
                        <div className={`bg-white rounded-full transition-all ${isSinging ? 'w-2 h-2' : 'w-2 h-1'}`}></div>
                      </div>
                      <div className={`bg-gray-900 transition-all duration-200 ${isSinging ? `${voice.mouth} border-2 border-white scale-125` : 'w-4 h-1 rounded-full'}`}></div>
                    </div>
                  </div>
                  
                  <div className="w-1.5 h-10 bg-gray-200 mt-[-2px] -z-10 group-hover:bg-gray-300 transition-colors"></div>
                  <div className="w-12 h-1.5 bg-gray-200 rounded-full group-hover:bg-gray-300 transition-colors"></div>

                  {isSinging && (
                    <div className="absolute -top-12 animate-float opacity-80 flex flex-col items-center">
                      <Mic size={28} className={voice.color.replace('bg-', 'text-')} />
                    </div>
                  )}
                  
                  <div className="mt-3 text-center">
                    <span className={`block text-sm font-black uppercase tracking-wider ${isSinging ? 'text-purple-600' : 'text-gray-800'}`}>
                      {voice.label}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {voice.desc}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // --- 4. PAINT & DRAWING MINI-GAME ---
  // =========================================================================
  if (type === 'paint') { 
    return (
      <div className="relative w-full h-48 sm:h-72 my-8 bg-gray-50/50 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ccc 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
        <div className="absolute inset-0 border-y-2 border-dashed border-gray-200 pointer-events-none"></div>

        <button 
          onClick={clearCanvas}
          className="absolute top-4 right-4 z-20 bg-white p-2.5 rounded-xl shadow-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-100 transition-all active:scale-95 flex items-center gap-2 group"
          title="Curăță Pânza"
        >
          <span className="text-xs font-bold uppercase hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity">Șterge Tot</span>
          <Trash2 size={20} />
        </button>

        {showHint && (
          <div className="pointer-events-none absolute flex flex-col items-center gap-2 animate-pulse opacity-60 z-10">
            <Brush size={40} className="text-gray-400 rotate-12" />
            <span className="text-sm font-black text-gray-400 uppercase tracking-widest bg-white/80 px-2 py-1 rounded-md">Desenează liber! 🎨</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={() => { isDrawing.current = false; lastPos.current = null; }}
          onMouseLeave={() => { isDrawing.current = false; lastPos.current = null; }}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={() => { isDrawing.current = false; lastPos.current = null; }}
        />
      </div>
    );
  }

  // =========================================================================
  // --- 5. PIANO KEYBOARD MINI-GAME ---
  // =========================================================================
  const whiteKeys = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];
  const blackKeys = [
    { label: 'do#', left: '14.28%' },
    { label: 're#', left: '28.57%' },
    { label: 'fa#', left: '57.14%' },
    { label: 'sol#', left: '71.42%' },
    { label: 'la#', left: '85.71%' }
  ];

  const handlePianoTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element instanceof HTMLElement) {
      const label = element.getAttribute('data-note');
      const octave = element.getAttribute('data-octave');
      if (label && octave) triggerPianoNote(label, parseInt(octave), touch.clientX, touch.clientY);
    }
  };

  return (
    <div 
      ref={pianoContainerRef}
      className="relative w-full flex flex-col items-center py-10 overflow-visible my-4 z-50 px-2 sm:px-0 touch-none"
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchMove={handlePianoTouchMove}
      onTouchEnd={handleEnd}
    >
      {showHint && (
        <div className="absolute -top-8 animate-bounce flex items-center gap-3 bg-white px-5 py-2.5 rounded-full shadow-[0_10px_25px_rgba(139,92,246,0.2)] border-2 border-purple-100 z-[60] cursor-default pointer-events-none">
          <div className="bg-yellow-400 p-1 rounded-full">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="text-sm font-black text-purple-700 whitespace-nowrap">Glisează pe clape! 🎹</span>
        </div>
      )}

      <div className="fixed inset-0 pointer-events-none z-[9999]">
        {activeNotes.map((note) => (
          <div
            key={note.id}
            className="absolute animate-note-pop text-purple-600 font-black text-4xl drop-shadow-2xl italic uppercase tracking-widest select-none"
            style={{ left: note.x, top: note.y }}
          >
            {note.label}
          </div>
        ))}
      </div>

      <div className="w-full sm:max-w-4xl flex h-28 sm:h-40 relative px-1 sm:px-6 overflow-visible select-none shadow-2xl rounded-b-xl bg-gray-50 border-t-8 border-gray-900">
        {[...Array(2)].map((_, octaveIdx) => (
          <div key={octaveIdx} className="flex-1 relative h-full flex">
            {whiteKeys.map((label) => {
              const keyId = `${label}-${octaveIdx}`;
              const isPressed = pressedKey === keyId;
              return (
                <div
                  key={keyId}
                  data-note={label}
                  data-octave={octaveIdx}
                  onMouseDown={(e) => handleStart(() => triggerPianoNote(label, octaveIdx, e.clientX, e.clientY))}
                  onMouseEnter={(e) => isDragging.current && triggerPianoNote(label, octaveIdx, e.clientX, e.clientY)}
                  onTouchStart={(e) => handleStart(() => triggerPianoNote(label, octaveIdx, e.touches[0].clientX, e.touches[0].clientY))}
                  className={`piano-key-white flex-1 h-full border-r border-gray-200/50 last:border-r-0 cursor-pointer transition-colors duration-75 
                    ${isPressed ? '!bg-purple-400 !scale-[0.98] shadow-inner' : 'bg-white'}`}
                />
              );
            })}
            {blackKeys.map((bk) => {
              const keyId = `${bk.label}-${octaveIdx}`;
              const isPressed = pressedKey === keyId;
              return (
                <div
                  key={keyId}
                  data-note={bk.label}
                  data-octave={octaveIdx}
                  onMouseDown={(e) => handleStart(() => triggerPianoNote(bk.label, octaveIdx, e.clientX, e.clientY))}
                  onMouseEnter={(e) => isDragging.current && triggerPianoNote(bk.label, octaveIdx, e.clientX, e.clientY)}
                  onTouchStart={(e) => handleStart(() => triggerPianoNote(bk.label, octaveIdx, e.touches[0].clientX, e.touches[0].clientY))}
                  className={`piano-key-black absolute w-[10%] h-[62%] z-10 -translate-x-1/2 cursor-pointer shadow-lg transition-transform duration-75
                    ${isPressed ? '!bg-gray-700 !scale-95' : 'bg-gray-900'}`}
                  style={{ left: bk.left }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SectionSeparator;
