import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { LogOut, LogIn, User as UserIcon, Shield, Heart, History, AlertCircle, ChevronRight, MessageSquare, Camera, CheckCircle, Save, Eye, X, ArrowLeft } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Favorite, HistoryItem, Report } from '../types';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/LanguageContext';

const createGuardabarrancoSVG = () => `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bgG" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
  </defs>
  <style>
    @keyframes flap { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-10deg); } }
    @keyframes tail { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
    @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
    .bird { animation: float 2.5s ease-in-out infinite; }
    .wing { animation: flap 1.2s ease-in-out infinite; transform-origin: 40px 45px; }
    .tail { animation: tail 2s ease-in-out infinite; transform-origin: 50px 65px; }
  </style>
  <circle cx="50" cy="50" r="48" fill="url(#bgG)"/>
  <g class="bird">
    <g class="tail">
      <line x1="50" y1="65" x2="40" y2="92" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
      <line x1="50" y1="65" x2="60" y2="92" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
      <circle cx="40" cy="92" r="4" fill="#0d9488"/>
      <circle cx="60" cy="92" r="4" fill="#0d9488"/>
    </g>
    <ellipse cx="50" cy="52" rx="15" ry="19" fill="#15803d"/>
    <ellipse cx="50" cy="55" rx="10" ry="14" fill="#d97706"/>
    <circle cx="50" cy="32" r="13" fill="#0f766e"/>
    <path d="M 40 26 Q 50 20 60 26" stroke="#38bdf8" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M 40 31 L 60 31" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
    <circle cx="54" cy="31" r="3" fill="#ffffff"/>
    <circle cx="54.8" cy="31" r="1.5" fill="#0f172a"/>
    <polygon points="58,29 74,34 58,37" fill="#1e293b"/>
    <path class="wing" d="M 42 42 Q 28 55 42 66 Q 48 55 42 42 Z" fill="#0284c7"/>
  </g>
</svg>
`)}`;

const createJaguarSVG = () => `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bgJ" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d97706"/>
      <stop offset="100%" stop-color="#78350f"/>
    </linearGradient>
  </defs>
  <style>
    @keyframes blink { 0%, 90%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
    @keyframes ear { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(5deg); } }
    @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
    .jaguar { animation: breathe 3s ease-in-out infinite; transform-origin: center; }
    .eye { animation: blink 4s infinite; transform-origin: center; }
    .earR { animation: ear 2.5s infinite; transform-origin: 65px 25px; }
  </style>
  <circle cx="50" cy="50" r="48" fill="url(#bgJ)"/>
  <g class="jaguar">
    <circle cx="32" cy="28" r="11" fill="#f59e0b"/>
    <circle cx="32" cy="28" r="6" fill="#451a03"/>
    <circle class="earR" cx="68" cy="28" r="11" fill="#f59e0b"/>
    <circle class="earR" cx="68" cy="28" r="6" fill="#451a03"/>
    <circle cx="50" cy="52" r="28" fill="#f59e0b"/>
    <circle cx="35" cy="40" r="3" fill="#451a03"/>
    <circle cx="65" cy="40" r="3" fill="#451a03"/>
    <circle cx="50" cy="33" r="2.5" fill="#451a03"/>
    <circle cx="30" cy="58" r="3.5" fill="#451a03"/>
    <circle cx="70" cy="58" r="3.5" fill="#451a03"/>
    <ellipse cx="50" cy="62" rx="14" ry="11" fill="#fef3c7"/>
    <polygon points="46,56 54,56 50,62" fill="#451a03"/>
    <path d="M 50 62 L 50 67 M 50 67 Q 44 71 40 67 M 50 67 Q 56 71 60 67" stroke="#451a03" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <g class="eye">
      <ellipse cx="38" cy="48" rx="5" ry="6" fill="#fef08a"/>
      <ellipse cx="38" cy="48" rx="2" ry="5" fill="#0f172a"/>
      <circle cx="37" cy="46" r="1.5" fill="#ffffff"/>
      <ellipse cx="62" cy="48" rx="5" ry="6" fill="#fef08a"/>
      <ellipse cx="62" cy="48" rx="2" ry="5" fill="#0f172a"/>
      <circle cx="61" cy="46" r="1.5" fill="#ffffff"/>
    </g>
  </g>
</svg>
`)}`;

const createMonoCongoSVG = () => `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bgM" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#15803d"/>
      <stop offset="100%" stop-color="#064e3b"/>
    </linearGradient>
  </defs>
  <style>
    @keyframes sway { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
    @keyframes headBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
    @keyframes blink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
    .mono { animation: headBob 2s ease-in-out infinite; }
    .tail { animation: sway 2.5s ease-in-out infinite; transform-origin: 80px 70px; }
    .eye { animation: blink 3.5s infinite; transform-origin: center; }
  </style>
  <circle cx="50" cy="50" r="48" fill="url(#bgM)"/>
  <path class="tail" d="M 60 70 Q 80 75 80 50 Q 80 30 65 35" stroke="#3f2314" stroke-width="6" fill="none" stroke-linecap="round"/>
  <g class="mono">
    <circle cx="26" cy="48" r="9" fill="#3f2314"/>
    <circle cx="26" cy="48" r="5" fill="#a16207"/>
    <circle cx="74" cy="48" r="9" fill="#3f2314"/>
    <circle cx="74" cy="48" r="5" fill="#a16207"/>
    <ellipse cx="50" cy="68" rx="22" ry="18" fill="#3f2314"/>
    <circle cx="50" cy="48" r="24" fill="#3f2314"/>
    <ellipse cx="50" cy="52" rx="16" ry="14" fill="#a16207"/>
    <ellipse cx="50" cy="58" rx="10" ry="7" fill="#fef3c7"/>
    <ellipse cx="50" cy="55" rx="3" ry="2" fill="#3f2314"/>
    <path d="M 44 61 Q 50 65 56 61" stroke="#3f2314" stroke-width="2" fill="none" stroke-linecap="round"/>
    <g class="eye">
      <circle cx="41" cy="46" r="4.5" fill="#ffffff"/>
      <circle cx="41" cy="46" r="2.5" fill="#1e293b"/>
      <circle cx="42" cy="45" r="1" fill="#ffffff"/>
      <circle cx="59" cy="46" r="4.5" fill="#ffffff"/>
      <circle cx="59" cy="46" r="2.5" fill="#1e293b"/>
      <circle cx="60" cy="45" r="1" fill="#ffffff"/>
    </g>
  </g>
</svg>
`)}`;

const createTortugaSVG = () => `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bgT" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <style>
    @keyframes paddle { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(12deg); } }
    @keyframes bubble { 0% { transform: translateY(0) scale(0.8); opacity: 0; } 50% { opacity: 0.8; } 100% { transform: translateY(-30px) scale(1.2); opacity: 0; } }
    @keyframes swim { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    .turtle { animation: swim 3s ease-in-out infinite; }
    .fL { animation: paddle 1.8s ease-in-out infinite; transform-origin: 30px 40px; }
    .fR { animation: paddle 1.8s ease-in-out infinite reverse; transform-origin: 70px 40px; }
    .b1 { animation: bubble 3s infinite 0s; }
    .b2 { animation: bubble 3s infinite 1.5s; }
  </style>
  <circle cx="50" cy="50" r="48" fill="url(#bgT)"/>
  <circle class="b1" cx="25" cy="70" r="3" fill="#ffffff" opacity="0.6"/>
  <circle class="b2" cx="75" cy="80" r="4" fill="#ffffff" opacity="0.6"/>
  <g class="turtle">
    <path class="fL" d="M 30 40 Q 10 35 12 55 Q 25 55 35 48 Z" fill="#15803d"/>
    <path class="fR" d="M 70 40 Q 90 35 88 55 Q 75 55 65 48 Z" fill="#15803d"/>
    <ellipse cx="38" cy="72" rx="6" ry="10" fill="#166534" transform="rotate(-20 38 72)"/>
    <ellipse cx="62" cy="72" rx="6" ry="10" fill="#166534" transform="rotate(20 62 72)"/>
    <ellipse cx="50" cy="24" rx="10" ry="12" fill="#22c55e"/>
    <circle cx="45" cy="20" r="2" fill="#0f172a"/>
    <circle cx="55" cy="20" r="2" fill="#0f172a"/>
    <ellipse cx="50" cy="52" rx="24" ry="26" fill="#166534"/>
    <polygon points="50,34 58,42 58,54 50,62 42,54 42,42" fill="#15803d" stroke="#fef08a" stroke-width="1.5"/>
    <polygon points="50,62 58,70 42,70" fill="#15803d" stroke="#fef08a" stroke-width="1.5"/>
  </g>
</svg>
`)}`;

const createChocoyoSVG = () => `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bgC" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#16a34a"/>
      <stop offset="100%" stop-color="#15803d"/>
    </linearGradient>
  </defs>
  <style>
    @keyframes headTilt { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-8deg); } }
    @keyframes blink { 0%, 90%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
    .chocoyo { animation: headTilt 2.2s ease-in-out infinite; transform-origin: 50px 60px; }
    .eye { animation: blink 3s infinite; transform-origin: center; }
  </style>
  <circle cx="50" cy="50" r="48" fill="url(#bgC)"/>
  <g class="chocoyo">
    <polygon points="46,65 54,65 50,95" fill="#0d9488"/>
    <ellipse cx="50" cy="56" rx="16" ry="20" fill="#22c55e"/>
    <ellipse cx="50" cy="58" rx="10" ry="14" fill="#facc15"/>
    <circle cx="50" cy="34" r="15" fill="#22c55e"/>
    <circle cx="40" cy="38" r="4" fill="#dc2626"/>
    <path d="M 54 28 Q 72 34 56 42 Z" fill="#ea580c"/>
    <g class="eye">
      <circle cx="48" cy="32" r="4.5" fill="#ffffff"/>
      <circle cx="48" cy="32" r="2.5" fill="#0f172a"/>
      <circle cx="49" cy="31" r="1" fill="#ffffff"/>
    </g>
    <path d="M 38 46 Q 24 60 38 72 Q 44 60 38 46 Z" fill="#16a34a"/>
  </g>
</svg>
`)}`;

const createRanaOjosRojosSVG = () => `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bgR" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#15803d"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <style>
    @keyframes frogEyeBlink { 0%, 88%, 100% { transform: scaleY(1); } 94% { transform: scaleY(0.1); } }
    @keyframes croak { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
    .frog { animation: croak 2s ease-in-out infinite; transform-origin: center; }
    .redEye { animation: frogEyeBlink 3.2s infinite; transform-origin: center; }
  </style>
  <circle cx="50" cy="50" r="48" fill="url(#bgR)"/>
  <g class="frog">
    <path d="M 22 65 Q 10 50 25 45 Q 30 58 25 72 Z" fill="#22c55e"/>
    <path d="M 78 65 Q 90 50 75 45 Q 70 58 75 72 Z" fill="#22c55e"/>
    <circle cx="16" cy="45" r="3" fill="#ea580c"/>
    <circle cx="84" cy="45" r="3" fill="#ea580c"/>
    <ellipse cx="50" cy="56" rx="20" ry="18" fill="#22c55e"/>
    <path d="M 32 52 Q 35 60 32 68" stroke="#38bdf8" stroke-width="4" fill="none"/>
    <path d="M 68 52 Q 65 60 68 68" stroke="#38bdf8" stroke-width="4" fill="none"/>
    <ellipse cx="50" cy="62" rx="11" ry="8" fill="#fef08a"/>
    <ellipse cx="50" cy="42" rx="18" ry="12" fill="#22c55e"/>
    <g class="redEye">
      <circle cx="36" cy="30" r="10" fill="#dc2626"/>
      <ellipse cx="36" cy="30" rx="2" ry="7" fill="#0f172a"/>
      <circle cx="34" cy="27" r="1.5" fill="#ffffff"/>
      <circle cx="64" cy="30" r="10" fill="#dc2626"/>
      <ellipse cx="64" cy="30" rx="2" ry="7" fill="#0f172a"/>
      <circle cx="62" cy="27" r="1.5" fill="#ffffff"/>
    </g>
  </g>
</svg>
`)}`;

const createDantoTapirSVG = () => `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bgD" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <style>
    @keyframes snout { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(8deg); } }
    @keyframes earWiggle { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-6deg); } }
    .snout { animation: snout 2s ease-in-out infinite; transform-origin: 50px 58px; }
    .ear { animation: earWiggle 2.5s infinite; transform-origin: 32px 30px; }
  </style>
  <circle cx="50" cy="50" r="48" fill="url(#bgD)"/>
  <ellipse cx="50" cy="62" rx="26" ry="20" fill="#475569"/>
  <ellipse cx="50" cy="44" rx="20" ry="18" fill="#475569"/>
  <ellipse class="ear" cx="32" cy="28" rx="6" ry="10" fill="#334155" stroke="#f1f5f9" stroke-width="1.5"/>
  <ellipse cx="68" cy="28" rx="6" ry="10" fill="#334155" stroke="#f1f5f9" stroke-width="1.5"/>
  <g class="snout">
    <path d="M 42 52 C 42 68 58 68 58 52 Z" fill="#334155"/>
    <ellipse cx="50" cy="64" rx="5" ry="3.5" fill="#f43f5e"/>
  </g>
  <circle cx="40" cy="42" r="3" fill="#0f172a"/>
  <circle cx="41" cy="41" r="1" fill="#ffffff"/>
  <circle cx="60" cy="42" r="3" fill="#0f172a"/>
  <circle cx="61" cy="41" r="1" fill="#ffffff"/>
</svg>
`)}`;

const createTiburonToroSVG = () => `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bgS" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0c4a6e"/>
    </linearGradient>
  </defs>
  <style>
    @keyframes sharkWag { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
    @keyframes floatBubbles { 0% { transform: translateY(0); opacity: 0; } 50% { opacity: 0.8; } 100% { transform: translateY(-35px); opacity: 0; } }
    .shark { animation: sharkWag 2.4s ease-in-out infinite; transform-origin: 30px 50px; }
    .b1 { animation: floatBubbles 2.8s infinite 0s; }
    .b2 { animation: floatBubbles 2.8s infinite 1.4s; }
  </style>
  <circle cx="50" cy="50" r="48" fill="url(#bgS)"/>
  <circle class="b1" cx="75" cy="60" r="3" fill="#ffffff" opacity="0.7"/>
  <circle class="b2" cx="82" cy="75" r="4" fill="#ffffff" opacity="0.7"/>
  <g class="shark">
    <polygon points="18,50 6,32 12,50 6,68" fill="#334155"/>
    <path d="M 16 50 Q 50 32 80 50 Q 50 68 16 50 Z" fill="#475569"/>
    <path d="M 25 50 Q 50 64 72 50 Q 50 55 25 50 Z" fill="#f8fafc"/>
    <polygon points="45,38 52,18 62,38" fill="#334155"/>
    <polygon points="50,56 42,72 58,58" fill="#334155"/>
    <circle cx="70" cy="46" r="2.5" fill="#0f172a"/>
    <circle cx="70.8" cy="45.5" r="0.8" fill="#ffffff"/>
    <line x1="58" y1="46" x2="58" y2="52" stroke="#334155" stroke-width="1.5"/>
    <line x1="61" y1="46" x2="61" y2="52" stroke="#334155" stroke-width="1.5"/>
  </g>
</svg>
`)}`;

const NICARAGUA_FAUNA_AVATARS = [
  {
    id: 'guardabarranco',
    name: 'Guardabarranco',
    tag: 'Ave Nacional Nica',
    url: createGuardabarrancoSVG()
  },
  {
    id: 'jaguarete',
    name: 'Jaguar / Jaguarete',
    tag: 'Bosawás & Indio Maíz',
    url: createJaguarSVG()
  },
  {
    id: 'monito-congo',
    name: 'Mono Congo',
    tag: 'Reserva Mombacho',
    url: createMonoCongoSVG()
  },
  {
    id: 'tortuga-paslama',
    name: 'Tortuga Paslama',
    tag: 'Refugio La Flor',
    url: createTortugaSVG()
  },
  {
    id: 'chocoyo-verde',
    name: 'Chocoyo Zapoyol',
    tag: 'El Chocoyero',
    url: createChocoyoSVG()
  },
  {
    id: 'danto-tapir',
    name: 'Danto / Tapir',
    tag: 'Selva Indio Maíz',
    url: createDantoTapirSVG()
  },
  {
    id: 'rana-ojos-rojos',
    name: 'Rana Ojos Rojos',
    tag: 'Selva Negra & Matagalpa',
    url: createRanaOjosRojosSVG()
  },
  {
    id: 'tiburon-lago',
    name: 'Tiburón Toro',
    tag: 'Lago Cocibolca',
    url: createTiburonToroSVG()
  }
];

interface UserProfileProps {
  onLogout?: () => void;
}

export default function UserProfile({ onLogout }: UserProfileProps) {
  const { language, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'favorites' | 'history' | 'reports' | null>(null);
  const [showSubTabMobile, setShowSubTabMobile] = useState(false);
  const [isViewingAvatar, setIsViewingAvatar] = useState(false);
  const [isWaving, setIsWaving] = useState(false);
  const [showGreetingBubble, setShowGreetingBubble] = useState(false);

  useEffect(() => {
    setIsWaving(true);
    setShowGreetingBubble(true);
    const waveTimeout = setTimeout(() => setIsWaving(false), 2000);
    const bubbleTimeout = setTimeout(() => setShowGreetingBubble(false), 6000);
    return () => {
      clearTimeout(waveTimeout);
      clearTimeout(bubbleTimeout);
    };
  }, []);

  const triggerGreeting = () => {
    setIsWaving(true);
    setShowGreetingBubble(true);
    setTimeout(() => setIsWaving(false), 2000);
  };

  const getReportStatusDetails = (status: string) => {
    if (status === 'resolved') {
      return {
        text: language === 'es' ? 'Contestado (Resuelto)' : language === 'zh' ? '已回复 (已解决)' : 'Answered (Resolved)',
        className: 'bg-emerald-50 text-emerald-600 border border-emerald-150',
        textColor: 'text-emerald-700',
        bgClass: 'bg-emerald-500/10'
      };
    } else if (status === 'read') {
      return {
        text: language === 'es' ? 'Leído (En Revisión)' : language === 'zh' ? '已阅 (审核中)' : 'Read (Under Review)',
        className: 'bg-sky-50 text-sky-600 border border-sky-150',
        textColor: 'text-sky-600',
        bgClass: 'bg-sky-500/10'
      };
    } else {
      return {
        text: language === 'es' ? 'No Atendido (Nuevo)' : language === 'zh' ? '未处理 (新提交)' : 'Not Attended (New)',
        className: 'bg-rose-50 text-rose-600 border border-rose-150',
        textColor: 'text-rose-600',
        bgClass: 'bg-rose-500/10'
      };
    }
  };

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 180;
        const MAX_HEIGHT = 180;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
          setEditPhoto(compressedBase64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (user && user.uid !== loadedUserId) {
      setEditName(user.displayName || '');
      setEditEmail(user.email || '');
      setEditPhone(user.phoneNumber || '');
      setEditPhoto(user.photoURL || '');
      setLoadedUserId(user.uid);
    }
  }, [user, loadedUserId]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      // 1. Optimistic update of localStorage if local test account
      if (user.uid.startsWith('local-')) {
        localStorage.setItem('localAuth_name', editName);
        localStorage.setItem('localAuth_email', editEmail);
        localStorage.setItem('localAuth_phone', editPhone);
        localStorage.setItem('localAuth_photo', editPhoto);
      }

      // 2. Perform optimistic state update so that changes show instantly in UI
      setUser({
        ...user,
        displayName: editName,
        email: editEmail,
        phoneNumber: editPhone,
        photoURL: editPhoto
      } as any);

      // 3. Initiate non-blocking Firestore update (local Firestore cache registers and resolves snapshots immediately, matches asynchronous saving)
      const userRef = doc(db, 'users', user.uid);
      const userDocPayload = {
        id: user.uid,
        name: editName,
        email: editEmail,
        photoUrl: editPhoto,
        phoneNumber: editPhone,
        role: user.uid.includes('admin') ? 'admin' : 'passenger',
        ...(user.uid.startsWith('local-') ? { createdAt: new Date().toISOString() } : {})
      };

      setDoc(userRef, userDocPayload, { merge: true }).catch(err => {
        console.error("Async background error updating Firestore user doc:", err);
      });

      // 4. Elegant tactile delay to feel premium before confirmation
      await new Promise(resolve => setTimeout(resolve, 250));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving profile:", err);
    } finally {
      setSaving(false);
    }
  };

  const [userChatText, setUserChatText] = useState<{ [reportId: string]: string }>({});
  const [selectedUserReportId, setSelectedUserReportId] = useState<string | null>(null);

  const sendUserReportMessage = async (reportId: string) => {
    const text = userChatText[reportId];
    if (!text || !text.trim() || !user) return;

    const currentReport = reports.find(r => r.id === reportId);
    if (!currentReport) return;

    const newMessage = {
      id: 'msg-' + Date.now(),
      senderId: user.uid,
      senderName: user.displayName || 'Pasajero',
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    const existingMessages = currentReport.messages || [];
    const updatedMessages = [...existingMessages, newMessage];

    await updateDoc(doc(db, 'reports', reportId), {
      messages: updatedMessages,
      status: 'pending' // Regresa a pendiente para alertar al administrador
    });

    setUserChatText({ ...userChatText, [reportId]: '' });
  };

  useEffect(() => {
    let unsubUserDoc = () => {};

    const unsubscribe = auth.onAuthStateChanged((u) => {
      unsubUserDoc();
      if (u) {
        setUser({
          uid: u.uid,
          displayName: u.displayName || u.email?.split('@')[0] || 'Pasajero',
          email: u.email || '',
          phoneNumber: u.phoneNumber || '',
          photoURL: u.photoURL || ''
        } as any);

        unsubUserDoc = onSnapshot(doc(db, 'users', u.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUser({
              uid: u.uid,
              displayName: data.name || u.displayName || 'Pasajero',
              email: data.email || u.email || '',
              phoneNumber: data.phoneNumber || u.phoneNumber || '',
              photoURL: data.photoUrl || u.photoURL || ''
            } as any);
          }
        });

        setDoc(doc(db, 'users', u.uid), {
          id: u.uid,
          name: u.displayName || u.email?.split('@')[0] || 'Pasajero',
          email: u.email || '',
          photoUrl: u.photoURL || '',
          phoneNumber: u.phoneNumber || '',
          role: 'passenger',
          createdAt: new Date().toISOString()
        }, { merge: true }).catch(err => console.error("Error creating/updating user document:", err));
      } else {
        const localRole = localStorage.getItem('localAuth');
        if (localRole) {
          const storedName = localStorage.getItem('localAuth_name') || (localRole === 'admin' ? 'Administrador Local (Pruebas)' : 'Pasajero Inteligente (Pruebas)');
          const storedPhone = localStorage.getItem('localAuth_phone') || '';
          const storedEmail = localStorage.getItem('localAuth_email') || (localRole === 'admin' ? 'admin@nicago.com' : 'viajero@nicago.com');
          const storedPhoto = localStorage.getItem('localAuth_photo') || '';
          const storedId = localStorage.getItem('localAuth_id') || ('local-' + localRole);
          
          setUser({
            uid: storedId,
            displayName: storedName,
            email: storedEmail,
            phoneNumber: storedPhone,
            photoURL: storedPhoto
          } as any);

          unsubUserDoc = onSnapshot(doc(db, 'users', storedId), (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setUser({
                uid: storedId,
                displayName: data.name || storedName,
                email: data.email || storedEmail,
                phoneNumber: data.phoneNumber || storedPhone,
                photoURL: data.photoUrl || storedPhoto
              } as any);
            }
          });
        } else {
          setUser(null);
        }
      }
    });
    return () => {
      unsubscribe();
      unsubUserDoc();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const qFavs = query(collection(db, 'favorites'), where('userId', '==', user.uid));
    const unsubFavs = onSnapshot(qFavs, (snap) => {
      setFavorites(snap.docs.map(d => ({ id: d.id, ...d.data() } as Favorite)));
    }, (error) => console.error("Error favorites UserProfile:", error));

    const qHist = query(collection(db, 'history'), where('userId', '==', user.uid));
    const unsubHist = onSnapshot(qHist, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as HistoryItem));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHistory(items);
    }, (error) => console.error("Error history UserProfile:", error));

    const qReports = query(collection(db, 'reports'), where('userId', '==', user.uid));
    const unsubReports = onSnapshot(qReports, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Report));
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReports(items);
    }, (error) => console.error("Error reports UserProfile:", error));

    return () => {
      unsubFavs();
      unsubHist();
      unsubReports();
    };
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('localAuth');
      await signOut(auth);
      if (onLogout) {
        onLogout();
      }
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-zinc-200/80 shadow-xl p-8 text-center py-16 relative">
        {/* Quick Logout button to return directly to Role Selector */}
        <button 
          onClick={handleLogout}
          className="absolute top-6 right-6 flex items-center gap-1.5 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer border border-rose-105 shadow-sm z-30 active:scale-95"
          title={language === 'es' ? 'Regresar a Inicio / Selector' : language === 'zh' ? '返回首页/角色选择' : 'Return to Home / Selector'}
        >
          <LogOut size={13} className="shrink-0" />
          <span className="text-[10px] font-bold tracking-wider">
            {language === 'es' ? 'SALIR' : language === 'zh' ? '注销' : 'LOG OUT'}
          </span>
        </button>
        <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-zinc-300 shadow-inner">
          <UserIcon size={40} />
        </div>
        <h3 className="text-xl font-bold text-zinc-900 mb-2">
          {language === 'es' ? 'Bienvenido a NicaGo' : language === 'zh' ? '欢迎来到 NicaGo' : 'Welcome to NicaGo'}
        </h3>
        <p className="text-sm text-zinc-500 leading-relaxed max-w-sm mx-auto mb-8">
          {language === 'es' 
            ? 'Inicia sesión para guardar tus rutas favoritas, ver tu historial de viajes y manejar tus reportes de incidentes.' 
            : language === 'zh' 
            ? '请先登录以下载您喜爱的线路，查看出行纪录，以及管理上报异常事件。' 
            : 'Sign in to save your favorite routes, view travel history, and handle incident reports.'}
        </p>
        <button 
          onClick={handleLogin}
          className="w-full max-w-xs mx-auto flex items-center justify-center gap-3 px-6 py-4 bg-nic-blue text-white rounded-2xl text-sm font-bold hover:bg-blue-800 transition-all shadow-xl shadow-blue-900/10 active:scale-[0.98] cursor-pointer"
        >
          <LogIn size={18} />
          {t('login.googleBtn') || 'Iniciar con Google'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-zinc-200/80 shadow-xl overflow-hidden">
      <input 
        type="file" 
        id="avatar-upload-file" 
        accept="image/*" 
        onChange={handleFileChange} 
        className="hidden" 
      />
      <div className="grid grid-cols-1 md:grid-cols-12 animate-fadeIn">
        {/* Left column: User info summary */}
        <div className={cn(
          "md:col-span-4 bg-zinc-50/50 p-8 border-b md:border-b-0 md:border-r border-zinc-200/65 flex flex-col justify-between relative",
          showSubTabMobile ? "hidden md:flex" : "flex"
        )}>
          <div>
            <div className="flex flex-col items-center text-center">
              <div className="relative group pt-10 mb-1">
                {/* Animated Speech Greeting Bubble (Duolingo style) */}
                <AnimatePresence>
                  {showGreetingBubble && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5, y: 10, x: '-50%' }}
                      animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
                      exit={{ opacity: 0, scale: 0.6, y: 8, transition: { duration: 0.2 } }}
                      onClick={() => setShowGreetingBubble(false)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full bg-white text-zinc-900 text-[11px] font-extrabold px-3.5 py-1.5 rounded-2xl shadow-lg border border-zinc-200 flex items-center gap-1.5 cursor-pointer select-none active:scale-95 transition-all z-30"
                    >
                      <span>
                        {language === 'es' ? '¡Hola' : language === 'zh' ? '你好' : 'Hello'}, {user.displayName?.split(' ')[0] || 'Pasajero'}!
                      </span>
                      <motion.span
                        className="inline-block origin-[70%_70%]"
                        animate={{ rotate: [0, 18, -10, 18, -10, 18, 0] }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          repeatDelay: 1.4,
                          ease: "easeInOut"
                        }}
                      >
                        👋
                      </motion.span>
                      {/* Speech Bubble Arrow pointing down to avatar */}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45 border-r border-b border-zinc-200" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  animate={isWaving ? {
                    scaleX: [1, 1.16, 0.82, 1.12, 0.94, 1.03, 1],
                    scaleY: [1, 0.82, 1.18, 0.88, 1.06, 0.97, 1],
                    y: [0, 6, -14, 3, -1, 0, 0],
                    rotate: [0, -12, 12, -12, 12, -6, 6, 0]
                  } : {
                    scaleY: [1, 1.03, 1],
                    y: [0, -2, 0]
                  }}
                  transition={isWaving ? {
                    duration: 1.25,
                    ease: "easeInOut"
                  } : {
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  onClick={triggerGreeting}
                  className="cursor-pointer"
                >
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsViewingAvatar(true);
                    }}
                    className="w-20 h-20 rounded-3xl bg-nic-blue/5 flex items-center justify-center overflow-hidden border border-zinc-200 hover:border-nic-blue transition-all cursor-pointer relative shadow-inner block animate-fadeIn"
                    title={language === 'es' ? 'Ver avatar / saludar' : 'View avatar / wave'}
                  >
                    {editPhoto || user.photoURL ? (
                      <img src={editPhoto || user.photoURL} alt={editName || user.displayName || ''} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={32} className="text-nic-blue" />
                    )}
                    {/* Subtle Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity duration-200">
                      <Eye size={18} className="text-white scale-90 group-hover:scale-100 transition-transform duration-200" />
                      <span className="text-[7px] font-black uppercase tracking-wider mt-1 text-white/90">
                        {language === 'es' ? 'Ver' : 'View'}
                      </span>
                    </div>
                  </button>
                </motion.div>
              </div>
              
              <h3 className="font-extrabold text-zinc-900 text-lg mt-4 leading-tight">{user.displayName || 'Usuario'}</h3>
              <p className="text-xs font-semibold text-zinc-400 mt-1 truncate max-w-full">{user.email}</p>
              
              <div className="mt-4 px-3 py-1 bg-zinc-100 rounded-full text-[9px] font-black text-zinc-500 uppercase tracking-wider">
                {user.email === 'admin@nicago.com' ? 'Administrador' : 'Pasajero'}
              </div>
            </div>

            {/* Profile Menu Sub-tabs */}
            <div className="mt-8 space-y-1.5">
              {[
                { id: 'profile', label: 'Mi Perfil', icon: UserIcon },
                { id: 'favorites', label: 'Favoritos', icon: Heart, count: favorites.length },
                { id: 'history', label: 'Historial', icon: History, count: history.length },
                { id: 'reports', label: 'Reportes', icon: AlertCircle, count: reports.length }
              ].map((subTab) => {
                const Icon = subTab.icon;
                return (
                  <button
                    key={subTab.id}
                    onClick={() => {
                      setActiveSubTab(subTab.id as any);
                      setShowSubTabMobile(true);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-3.5 text-xs font-bold rounded-2xl transition-all cursor-pointer border",
                      activeSubTab === subTab.id
                        ? "bg-blue-50/70 text-nic-blue border-blue-200/80 shadow-2xs font-extrabold"
                        : "bg-white text-zinc-600 border-zinc-200/80 hover:bg-zinc-50 hover:text-zinc-900"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={16} className={activeSubTab === subTab.id ? "text-nic-blue" : "text-zinc-400"} />
                      <span>{subTab.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeSubTab === subTab.id && (
                        <span className="w-2 h-2 rounded-full bg-nic-blue" />
                      )}
                      {subTab.count !== undefined && subTab.count > 0 && (
                        <span className={cn(
                          "text-[9px] py-0.5 px-2 rounded-full font-bold",
                          activeSubTab === subTab.id ? "bg-blue-100 text-nic-blue" : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                        )}>
                          {subTab.count}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-200/60">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              <LogOut size={14} />
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Right column: Tab detail panel with contents */}
        <div className={cn(
          "md:col-span-8 p-8 flex flex-col justify-between min-h-[460px]",
          showSubTabMobile ? "block" : "hidden md:block"
        )}>
          <div className="flex-1">
            {showSubTabMobile && (
              <button
                onClick={() => {
                  setShowSubTabMobile(false);
                  setActiveSubTab(null);
                }}
                className="flex md:hidden items-center gap-2 mb-6 text-zinc-800 hover:text-zinc-950 font-extrabold text-xs uppercase tracking-wider bg-zinc-100 px-4 py-2.5 rounded-xl border border-zinc-200 shadow-sm cursor-pointer transition-all active:scale-95"
              >
                <ArrowLeft size={14} />
                Volver al menú de perfil
              </button>
            )}

            {activeSubTab !== null && (
              <button
                onClick={() => {
                  setActiveSubTab(null);
                  setShowSubTabMobile(false);
                }}
                className="hidden md:flex items-center gap-1.5 mb-5 text-[10px] font-bold text-zinc-500 hover:text-nic-blue transition-colors cursor-pointer"
              >
                <ArrowLeft size={12} />
                <span>Volver al resumen general</span>
              </button>
            )}

            {activeSubTab === null && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h4 className="text-base font-extrabold text-zinc-900 tracking-tight">
                    {language === 'es' ? 'Gestión de Cuenta y Preferencias' : language === 'zh' ? '账户管理和偏好设置' : 'Account Management & Preferences'}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    {language === 'es' 
                      ? 'Haz clic en cualquiera de las siguientes opciones para consultar o actualizar tus datos.' 
                      : language === 'zh'
                      ? '点击下方任意选项以查看或更新您的信息。'
                      : 'Click on any option below to view or update your details.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  {/* Option 1: Mi Perfil */}
                  <button
                    onClick={() => {
                      setActiveSubTab('profile');
                      setShowSubTabMobile(true);
                    }}
                    className="p-5 rounded-2xl border border-zinc-200/90 bg-white hover:bg-zinc-50/80 hover:border-nic-blue/40 transition-all text-left group shadow-2xs flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-nic-blue flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                        <UserIcon size={20} />
                      </div>
                      <h5 className="text-xs font-black text-zinc-900 group-hover:text-nic-blue transition-colors">
                        Mi Perfil
                      </h5>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                        Editar avatar animado, nombre completo, teléfono y correo electrónico.
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold text-nic-blue mt-4 flex items-center gap-1">
                      Ver mi perfil &rarr;
                    </span>
                  </button>

                  {/* Option 2: Favoritos */}
                  <button
                    onClick={() => {
                      setActiveSubTab('favorites');
                      setShowSubTabMobile(true);
                    }}
                    className="p-5 rounded-2xl border border-zinc-200/90 bg-white hover:bg-zinc-50/80 hover:border-nic-blue/40 transition-all text-left group shadow-2xs flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-nic-red flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                        <Heart size={20} />
                      </div>
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-black text-zinc-900 group-hover:text-nic-blue transition-colors">
                          Favoritos
                        </h5>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200/60">
                          {favorites.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                        Accede a tus líneas de bus guardadas y paradas preferidas.
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold text-nic-blue mt-4 flex items-center gap-1">
                      Ver favoritos &rarr;
                    </span>
                  </button>

                  {/* Option 3: Historial */}
                  <button
                    onClick={() => {
                      setActiveSubTab('history');
                      setShowSubTabMobile(true);
                    }}
                    className="p-5 rounded-2xl border border-zinc-200/90 bg-white hover:bg-zinc-50/80 hover:border-nic-blue/40 transition-all text-left group shadow-2xs flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                        <History size={20} />
                      </div>
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-black text-zinc-900 group-hover:text-nic-blue transition-colors">
                          Historial
                        </h5>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200/60">
                          {history.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                        Revisa tus búsquedas de rutas y recorridos recientes.
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold text-nic-blue mt-4 flex items-center gap-1">
                      Ver historial &rarr;
                    </span>
                  </button>

                  {/* Option 4: Reportes */}
                  <button
                    onClick={() => {
                      setActiveSubTab('reports');
                      setShowSubTabMobile(true);
                    }}
                    className="p-5 rounded-2xl border border-zinc-200/90 bg-white hover:bg-zinc-50/80 hover:border-nic-blue/40 transition-all text-left group shadow-2xs flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                        <AlertCircle size={20} />
                      </div>
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-black text-zinc-900 group-hover:text-nic-blue transition-colors">
                          Reportes
                        </h5>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200/60">
                          {reports.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                        Consulta el estado de tus reportes de incidencias y chatea.
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold text-nic-blue mt-4 flex items-center gap-1">
                      Ver reportes &rarr;
                    </span>
                  </button>
                </div>
              </div>
            )}
            {activeSubTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-base font-extrabold text-zinc-900 tracking-tight">
                    {language === 'es' ? 'Personalizar Perfil' : language === 'zh' ? '个性化个人资料' : 'Customize Profile'}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    {language === 'es' 
                      ? 'Configura tu identidad de pasajero en la red de transporte de Managua.' 
                      : language === 'zh' 
                      ? '在马那瓜交通网络中配置您的乘客身份。' 
                      : 'Configure your passenger identity in Managua\'s transport network.'}
                  </p>
                </div>

                {/* Avatar Presets Selection */}
                <div className="space-y-3 p-4 bg-zinc-50/80 rounded-2xl border border-zinc-200/80 text-left">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                        🇳🇮 Avatares Animados de Fauna Nicaragüense
                      </span>
                      <p className="text-[10px] text-zinc-500 font-medium">
                        Animaciones vectoriales de alta velocidad compatibles con el plan gratis de Firebase
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider rounded-full border border-emerald-200/60 shadow-xs flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      ✨ 100% Animados
                    </span>
                  </div>

                  {/* Grid of Nicaraguan Animals */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {NICARAGUA_FAUNA_AVATARS.map((animal) => {
                      const isSelected = editPhoto === animal.url;
                      return (
                        <motion.button
                          key={animal.id}
                          type="button"
                          onClick={() => setEditPhoto(animal.url)}
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          className={cn(
                            "p-2 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer text-left relative overflow-hidden bg-white shadow-xs group",
                            isSelected
                              ? "border-nic-blue ring-2 ring-nic-blue/20 bg-blue-50/40 shadow-xs"
                              : "border-zinc-200/90 hover:border-zinc-300 hover:bg-zinc-50/80"
                          )}
                        >
                          <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-zinc-900/5 relative p-0.5 border border-zinc-200/80 shadow-xs">
                            <img src={animal.url} alt={animal.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                            {isSelected && (
                              <div className="absolute inset-0 bg-nic-blue/15 backdrop-blur-[0.5px] flex items-center justify-center">
                                <CheckCircle size={16} className="text-white fill-nic-blue shadow-xs" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <p className="text-[11px] font-extrabold text-zinc-950 truncate leading-snug">{animal.name}</p>
                            </div>
                            <p className="text-[9px] font-bold text-zinc-500 truncate mt-0.5 flex items-center gap-1">
                              <span>{animal.tag}</span>
                            </p>
                            <span className="inline-block mt-0.5 text-[8px] font-black uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                              Animado
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Upload custom gallery photo button */}
                  <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <label 
                        htmlFor="avatar-upload-file"
                        className="px-4 py-2.5 bg-white hover:bg-zinc-100 border border-zinc-300 hover:border-zinc-600 rounded-xl text-xs font-bold text-zinc-800 transition-all cursor-pointer flex items-center gap-2 shadow-xs active:scale-95"
                      >
                        <Camera size={15} className="text-zinc-700" />
                        <span>Subir Foto Personal</span>
                      </label>

                      {editPhoto && !NICARAGUA_FAUNA_AVATARS.some(a => a.url === editPhoto) && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 border border-zinc-250 rounded-xl">
                          <img src={editPhoto} alt="Personal" className="w-6 h-6 rounded-lg object-cover" />
                          <span className="text-[10px] font-bold text-zinc-800">Foto Personal Seleccionada</span>
                        </div>
                      )}
                    </div>

                    <p className="text-[9px] text-zinc-400 font-mono text-right hidden sm:block">
                      Guardado directo en Firestore (100% Gratis)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      {language === 'es' ? 'Nombre Completo' : language === 'zh' ? '真实姓名' : 'Full Name'}
                    </label>
                    <input 
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={language === 'es' ? 'Ej: Sofía Baltodano' : language === 'zh' ? '例如: 张伟' : 'e.g., Sofia Baltodano'}
                      className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-zinc-900/5 focus:border-zinc-800 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      {language === 'es' ? 'Número de Teléfono' : language === 'zh' ? '电话号码' : 'Phone Number'}
                    </label>
                    <input 
                      type="tel" 
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Ej: +505 8888-8888"
                      className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-zinc-900/5 focus:border-zinc-800 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5 text-left sm:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      {language === 'es' ? 'Correo Electrónico' : language === 'zh' ? '电子邮箱' : 'Email Address'}
                    </label>
                    <input 
                      type="email" 
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder={language === 'es' ? 'Ej: correo@nicago.com' : language === 'zh' ? '例如: email@nicago.com' : 'e.g., email@nicago.com'}
                      className="w-full px-5 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-zinc-900/5 focus:border-zinc-800 transition-all"
                    />
                  </div>


                </div>

                <div className="pt-4 border-t border-zinc-100 flex items-center justify-between gap-4">
                  <div>
                    {saveSuccess && (
                      <span className="text-[11px] font-bold text-emerald-650 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full flex items-center gap-1.5 animate-fadeIn">
                        <CheckCircle size={12} className="text-emerald-500 fill-emerald-50" /> 
                        {language === 'es' ? '¡Perfil guardado con éxito!' : language === 'zh' ? '个人资料保存成功！' : 'Profile saved successfully!'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="px-6 py-3.5 bg-nic-blue text-white rounded-2xl text-[11px] font-black uppercase tracking-wider hover:bg-blue-600 active:scale-95 transition-all shadow-md shadow-blue-500/10 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    {language === 'es' ? 'Guardar Cambios' : language === 'zh' ? '保存修改' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {activeSubTab === 'favorites' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-extrabold text-zinc-900 tracking-tight">Rutas Favoritas</h4>
                  <p className="text-xs text-zinc-400 mt-1">Las líneas de transporte interurbano que agregas para tener un monitoreo prioritario.</p>
                </div>
                
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {favorites.map(fav => (
                    <div 
                      key={fav.id} 
                      className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:border-nic-blue/20 hover:bg-white hover:shadow-md transition-all group animate-slideIn"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-rose-50 text-nic-red rounded-xl flex items-center justify-center shadow-sm">
                          <Heart size={18} className="fill-nic-red" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">Ruta seleccionada / Guardada</p>
                          <p className="text-[10px] text-zinc-400 leading-tight">ID de transporte: {fav.routeId}</p>
                          <p className="text-[9px] text-zinc-400 font-medium">Marcada el {new Date(fav.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-zinc-300 group-hover:text-nic-blue group-hover:translate-x-0.5 transition-all" />
                    </div>
                  ))}
                  {favorites.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-zinc-300">
                        <Heart size={28} />
                      </div>
                      <p className="text-xs font-bold text-zinc-400">No tienes favoritos aún</p>
                      <p className="text-[11px] text-zinc-400 mt-1">Explora líneas y agrégalas marcando el corazón.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSubTab === 'history' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-extrabold text-zinc-900 tracking-tight">Historial de Viajes Buscados</h4>
                  <p className="text-xs text-zinc-400 mt-1">Registro de tus búsquedas de rutas para agilizar tu navegación cotidiana.</p>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {history.map(item => (
                    <div 
                      key={item.id} 
                      className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 animate-slideIn"
                    >
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-100">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-zinc-400 shadow-sm border border-zinc-100">
                            <History size={12} />
                          </div>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Búsqueda Registrada</span>
                        </div>
                        <span className="text-[9px] font-bold text-zinc-400">{new Date(item.createdAt).toLocaleDateString()} a las {new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="text-[8px] font-black uppercase text-nic-blue">Origen</span>
                          <p className="text-xs font-semibold text-zinc-800 truncate leading-tight mt-0.5">{item.origin}</p>
                        </div>
                        <ChevronRight size={14} className="text-zinc-300 shrink-0 mt-3" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[8px] font-black uppercase text-zinc-400">Destino</span>
                          <p className="text-xs font-semibold text-zinc-800 truncate leading-tight mt-0.5">{item.destination}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-zinc-300">
                        <History size={28} />
                      </div>
                      <p className="text-xs font-bold text-zinc-400">Sin historial de búsqueda</p>
                      <p className="text-[11px] text-zinc-400 mt-1">Tus coordenadas de salida y llegada se guardarán de forma organizada.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSubTab === 'reports' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-extrabold text-zinc-900 tracking-tight">Mis Reportes e Incidentes Chat</h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    {selectedUserReportId ? "Toca volver para ver todos tus reportes. Chat en directo con asesores." : "Estado de tus reportes de paradas, unidades o personal, presiona para chatear."}
                  </p>
                </div>

                {selectedUserReportId ? (() => {
                  const activeRep = reports.find(r => r.id === selectedUserReportId);
                  if (!activeRep) {
                    setSelectedUserReportId(null);
                    return null;
                  }
                  return (
                    <div className="space-y-4 border border-zinc-100 rounded-2xl p-4 bg-zinc-50/50">
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                        <button 
                          onClick={() => setSelectedUserReportId(null)}
                          className="flex items-center gap-1.5 py-1 px-2.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          &larr; Volver
                        </button>
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                          getReportStatusDetails(activeRep.status || 'pending').className
                        )}>
                          {getReportStatusDetails(activeRep.status || 'pending').text}
                        </span>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-zinc-150">
                        <p className="text-[10px] uppercase font-bold text-zinc-400">Detalles del Incidente:</p>
                        <p className="text-xs font-semibold text-zinc-750 mt-1">"{activeRep.description}"</p>
                        <p className="text-[9px] text-zinc-400 font-mono mt-1.5">
                          Enviado el {new Date(activeRep.createdAt).toLocaleString()}
                        </p>
                      </div>

                      {/* Chat Messages */}
                      <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 py-1 flex flex-col">
                        {/* Always treat report.adminResponse as a historic message if there are no structured messages */}
                        {(!activeRep.messages || activeRep.messages.length === 0) && activeRep.adminResponse && (
                          <div className="flex gap-2 max-w-[85%] self-start text-left">
                            <div className="w-6 h-6 rounded-full bg-nic-blue/15 text-nic-blue flex items-center justify-center shrink-0 text-[10px] font-bold">AD</div>
                            <div className="bg-white px-3.5 py-2.5 rounded-2xl border border-zinc-100 shadow-sm">
                              <p className="text-[9px] font-black uppercase text-nic-blue leading-none">Administrador</p>
                              <p className="text-[11px] font-medium text-zinc-700 mt-1">"{activeRep.adminResponse}"</p>
                            </div>
                          </div>
                        )}

                        {activeRep.messages?.map((msg) => {
                          const isAdmin = msg.senderId === 'admin';
                          return (
                            <div key={msg.id} className={cn(
                              "flex gap-2 max-w-[85%] text-left",
                              isAdmin ? "self-start" : "ml-auto flex-row-reverse"
                            )}>
                              <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-black",
                                isAdmin ? "bg-nic-blue/15 text-nic-blue" : "bg-zinc-250 text-zinc-700"
                              )}>
                                {isAdmin ? 'AD' : 'YO'}
                              </div>
                              <div className={cn(
                                "px-3.5 py-2.5 rounded-2xl shadow-sm border",
                                isAdmin 
                                  ? "bg-white border-zinc-100" 
                                  : "bg-emerald-50 border-emerald-100"
                              )}>
                                <p className={cn(
                                  "text-[9px] font-black uppercase leading-none",
                                  isAdmin ? "text-nic-blue" : "text-emerald-700"
                                )}>
                                  {isAdmin ? 'Administrador' : 'Yo'}
                                </p>
                                <p className="text-[11.5px] font-medium text-zinc-750 mt-1">{msg.text}</p>
                                <p className="text-[7.5px] text-zinc-400 font-mono mt-1 text-right">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          );
                        })}

                        {(!activeRep.messages || activeRep.messages.length === 0) && !activeRep.adminResponse && (
                          <div className="text-center py-6 text-zinc-400 text-[11px] font-medium italic">
                            No hay respuestas aún. Te avisaremos cuando un administrador responda.
                          </div>
                        )}
                      </div>

                      {/* Msg Input Area */}
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          sendUserReportMessage(activeRep.id);
                        }}
                        className="flex gap-2 pt-2 border-t border-zinc-100"
                      >
                        <input 
                          type="text" 
                          placeholder="Escribe un mensaje de seguimiento..."
                          value={userChatText[activeRep.id] || ''}
                          onChange={(e) => setUserChatText({ ...userChatText, [activeRep.id]: e.target.value })}
                          className="flex-1 px-3.5 py-2 bg-white border border-zinc-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-nic-blue/20 focus:border-nic-blue transition-all"
                        />
                        <button 
                          type="submit"
                          className="px-3.5 py-2 bg-nic-blue text-white rounded-xl text-[10px] font-bold uppercase hover:bg-blue-700 transition-all cursor-pointer"
                        >
                          Enviar
                        </button>
                      </form>
                    </div>
                  );
                })() : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {reports.map((report) => (
                      <div 
                        key={report.id} 
                        onClick={() => setSelectedUserReportId(report.id)}
                        className="p-4 bg-zinc-50 hover:bg-zinc-100/70 hover:border-nic-blue/20 rounded-2xl border border-zinc-100 transition-all cursor-pointer group animate-slideIn"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider",
                            getReportStatusDetails(report.status || 'pending').className
                          )}>
                            {getReportStatusDetails(report.status || 'pending').text}
                          </span>
                          <span className="text-[9px] font-bold text-zinc-400">{new Date(report.createdAt).toLocaleDateString()}</span>
                        </div>
                        
                        <p className="text-xs font-bold text-zinc-800 leading-snug line-clamp-2 mb-1 group-hover:text-nic-blue transition-colors">
                          {report.description}
                        </p>
                        
                        <div className="mt-2.5 pt-2 border-t border-zinc-100/70 flex items-center justify-between text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                          <span>Ver Chat &amp; Respuestas</span>
                          <span className="text-nic-blue group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                            Chatear &rarr;
                          </span>
                        </div>
                      </div>
                    ))}
                    {reports.length === 0 && (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-zinc-300">
                          <AlertCircle size={28} />
                        </div>
                        <p className="text-xs font-bold text-zinc-400">No has realizado reportes</p>
                        <p className="text-[11px] text-zinc-400 mt-1">Usa la sección reportes para enviarnos novedades puntuales de seguridad.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isViewingAvatar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsViewingAvatar(false)}
            className="fixed inset-0 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999]"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-sm md:max-w-md w-full relative border border-zinc-200/80 shadow-2xl flex flex-col items-center text-center select-none"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsViewingAvatar(false)}
                className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-all cursor-pointer border border-zinc-200/50"
              >
                <X size={18} />
              </button>

              <div className="w-64 h-64 md:w-80 md:h-80 rounded-3xl overflow-hidden border-2 border-zinc-100 shadow-md bg-zinc-50 flex items-center justify-center mb-5">
                {editPhoto || user.photoURL ? (
                  <img
                    src={editPhoto || user.photoURL}
                    alt={editName || user.displayName || ''}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover select-none pointer-events-none"
                  />
                ) : (
                  <UserIcon size={96} className="text-zinc-300" />
                )}
              </div>

              <h4 className="text-base font-extrabold text-zinc-900 tracking-tight leading-snug">
                {editName || user.displayName || 'Usuario'}
              </h4>
              <p className="text-xs text-zinc-400 mt-1 mb-2">
                {user.email || 'Pasajero de NicaGo'}
              </p>
              <div className="px-3 py-1 bg-zinc-100 rounded-full text-[9px] font-black text-nic-blue uppercase tracking-wider mb-2">
                {user.email === 'admin@nicago.com' ? 'Administrador' : 'Pasajero'}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
