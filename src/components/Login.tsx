import React, { useState } from 'react';
import { Bus, AlertCircle, Globe, Lock, User as UserIcon, LogIn, Phone, Mail, Sparkles, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { useLanguage } from '../lib/LanguageContext';
import { cn } from '../lib/utils';
// @ts-ignore
import chineseRedWallBg from '../assets/images/chinese_login_bg_1780195416287.png';
// @ts-ignore
import chinesePavilionBg from '../assets/images/chinese_pavilion_autumn_bg_1780195846473.png';
// @ts-ignore
import nicaraguaSunsetBg from '../assets/images/nica.png';

import { UserRole } from '../types';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const { language, setLanguage, t } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'login' | 'register'>('login');

  // Login states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register states
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const inputUser = username.trim().toLowerCase();
    const rawInput = username.trim();

    // 1. Check direct hardcoded credential shortcuts
    if ((inputUser === 'cris') && password === 'cris123') {
      localStorage.setItem('localAuth', 'superadmin');
      localStorage.setItem('localAuth_name', 'Cris (Super Administrador)');
      localStorage.setItem('localAuth_email', 'cris@nicago.ni');
      localStorage.setItem('localAuth_id', 'superadmin-cris');
      onLogin('superadmin');
      return;
    }

    if (inputUser === 'admin' && password === 'admin123') {
      localStorage.setItem('localAuth', 'admin');
      localStorage.setItem('localAuth_name', 'Administrador General');
      localStorage.setItem('localAuth_email', 'admin@nicago.ni');
      localStorage.setItem('localAuth_id', 'local-admin');
      onLogin('admin');
      return;
    }

    if ((inputUser === 'chofer' || inputUser === 'driver') && (password === 'chofer123' || password === 'driver123')) {
      localStorage.setItem('localAuth', 'driver');
      localStorage.setItem('localAuth_name', 'Don José (Chofer Ruta 101)');
      localStorage.setItem('localAuth_email', 'chofer.jose@nicago.ni');
      localStorage.setItem('localAuth_id', 'local-chofer');
      onLogin('driver');
      return;
    }

    if (inputUser === 'user' && password === 'user123') {
      localStorage.setItem('localAuth', 'passenger');
      localStorage.setItem('localAuth_name', 'Pasajero NicaGo');
      localStorage.setItem('localAuth_id', 'local-user');
      onLogin('passenger');
      return;
    }

    // 2. Query Firestore by username, phoneNumber, or email
    setLoading(true);
    try {
      let snap = await getDocs(query(collection(db, 'users'), where('username', '==', inputUser)));
      if (snap.empty) {
        snap = await getDocs(query(collection(db, 'users'), where('phoneNumber', '==', rawInput)));
      }
      if (snap.empty) {
        snap = await getDocs(query(collection(db, 'users'), where('email', '==', rawInput)));
      }

      if (snap.empty) {
        setError(language === 'es' ? 'Usuario, teléfono o correo no encontrado. Revisa tus datos.' : 'User, phone number or email not found.');
        setLoading(false);
        return;
      }

      const userDoc = snap.docs[0].data();
      const userId = snap.docs[0].id;

      // Validate password if user document specifies one
      if (userDoc.password) {
        if (!password || password.trim() !== userDoc.password) {
          setError(language === 'es' ? 'Contraseña incorrecta. Por favor intenta de nuevo.' : 'Incorrect password. Please try again.');
          setLoading(false);
          return;
        }
      }

      const role: UserRole = (userDoc.role as UserRole) || 'passenger';

      // Store authorization parameters
      localStorage.setItem('localAuth', role);
      localStorage.setItem('localAuth_name', userDoc.name || 'Usuario');
      localStorage.setItem('localAuth_phone', userDoc.phoneNumber || rawInput);
      localStorage.setItem('localAuth_email', userDoc.email || '');
      localStorage.setItem('localAuth_id', userId);

      onLogin(role);
    } catch (err: any) {
      console.error("Error logging in user:", err);
      setError(language === 'es' ? 'Error al ingresar: ' + err.message : 'Error logging in: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const name = regName.trim();
    const phone = regPhone.trim();
    const email = regEmail.trim();
    const pwd = regPassword.trim();

    if (!name || !phone || !pwd) {
      setError(language === 'es' ? 'Por favor completa todos los campos requeridos, incluyendo la contraseña.' : 'Please fill all required fields, including password.');
      return;
    }

    if (pwd.length < 4) {
      setError(language === 'es' ? 'La contraseña debe tener al menos 4 caracteres.' : 'Password must be at least 4 characters long.');
      return;
    }

    setLoading(true);
    try {
      // Validate unique phone number
      const q = query(collection(db, 'users'), where('phoneNumber', '==', phone));
      const snap = await getDocs(q);

      if (!snap.empty) {
        setError(t('login.errorAlreadyRegistered'));
        setLoading(false);
        return;
      }

      // Record passenger document with password
      const newUserDoc = {
        name,
        phoneNumber: phone,
        email: email || '',
        password: pwd,
        role: 'passenger',
        photoUrl: '',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'users'), newUserDoc);

      // Store authorization parameters
      localStorage.setItem('localAuth', 'passenger');
      localStorage.setItem('localAuth_name', name);
      localStorage.setItem('localAuth_phone', phone);
      localStorage.setItem('localAuth_email', email);
      localStorage.setItem('localAuth_id', docRef.id);

      onLogin('passenger');
    } catch (err: any) {
      console.error("Error creating custom user path:", err);
      setError(t('login.errorRegister') + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Error signing in with Google", err);
      setError(t('login.errorGoogle') || 'Error de Google: o bien canceló el inicio de sesión o falta configurar el dominio.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#002f80] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Login Card matching screenshot */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.7 }}
        className="w-full max-w-[410px] bg-white rounded-[2.8rem] shadow-[0_25px_60px_rgba(0,10,50,0.4)] overflow-hidden relative z-10 border border-white/20 p-3 sm:p-4"
      >
        {/* Inner Card Container */}
        <div className="bg-white rounded-[2.4rem] overflow-hidden">
          
          {/* Header Banner with Image & Logo overlay */}
          <div className="relative h-64 w-full overflow-hidden rounded-[2.2rem]">
            {/* Nicaraguan traditional banner image */}
            <img 
              src={nicaraguaSunsetBg} 
              alt="Nicaragua Transport Banner" 
              className="w-full h-full object-cover object-center select-none"
              referrerPolicy="no-referrer"
            />
            {/* Gradient Overlay for subtle contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/20" />

            {/* Top Right Globe Language Button */}
            <div className="absolute top-3.5 right-3.5 z-30">
              <div className="relative">
                <button
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  type="button"
                  className="w-10 h-10 rounded-full bg-[#0d2850] hover:bg-[#123466] border border-sky-400/30 text-sky-300 flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer relative"
                  id="lang-selector-btn"
                >
                  <Globe size={18} className="text-cyan-300" />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-400 rounded-full border border-[#0d2850]" />
                </button>

                <AnimatePresence>
                  {showLangMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowLangMenu(false)} 
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-48 bg-[#0c203c]/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-sky-500/30 p-2 z-20 flex flex-col gap-1 text-white"
                      >
                        <p className="text-[9px] font-black tracking-widest uppercase px-3 py-1 text-sky-300 opacity-80">
                          {language === 'es' ? 'Idioma' : language === 'zh' ? '语言' : 'Language'}
                        </p>
                        <button
                          onClick={() => { setLanguage('es'); setShowLangMenu(false); }}
                          className={cn(
                            "flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-all",
                            language === 'es' ? "bg-sky-500 text-white" : "hover:bg-white/10 text-white/80"
                          )}
                        >
                          <span>🇪🇸 ESPAÑOL</span>
                        </button>
                        <button
                          onClick={() => { setLanguage('en'); setShowLangMenu(false); }}
                          className={cn(
                            "flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-all",
                            language === 'en' ? "bg-sky-500 text-white" : "hover:bg-white/10 text-white/80"
                          )}
                        >
                          <span>🇬🇧 ENGLISH</span>
                        </button>
                        <button
                          onClick={() => { setLanguage('zh'); setShowLangMenu(false); }}
                          className={cn(
                            "flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-all",
                            language === 'zh' ? "bg-sky-500 text-white" : "hover:bg-white/10 text-white/80"
                          )}
                        >
                          <span>🇨🇳 中文</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Title & Badge Overlaid at Bottom Center */}
            <div className="absolute bottom-3 inset-x-3 flex flex-col items-center text-center">
              <div className="flex items-center gap-2.5 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-slate-100">
                <div className="w-9 h-9 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center shrink-0">
                  <Bus size={20} className="text-[#0039a0]" />
                </div>
                <div className="text-left">
                  <h1 className="text-xl font-black text-slate-900 leading-none">
                    Nica <span className="text-[#c8102e]">Go</span>
                  </h1>
                </div>
              </div>
              <p className="text-[9px] font-black tracking-widest text-slate-800 uppercase mt-2 drop-shadow-sm bg-white/80 backdrop-blur-sm px-3 py-0.5 rounded-full border border-white/60">
                {t('login.subtitle') || 'TU GUIA DE TRASPORTE EN NICARAGUA'}
              </p>
            </div>
          </div>

          {/* Form Content Body */}
          <div className="p-5 sm:p-6 space-y-5">
            
            {/* Google Sign In Button (At the top as in the screenshot) */}
            <div>
              <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3.5 px-5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-full shadow-sm text-slate-800 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{loading ? (t('login.signingIn') || 'Iniciando...') : (t('login.googleBtn') || 'Iniciar Sesión con Google')}</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-1">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[10px] font-black tracking-widest uppercase text-slate-400">
                {t('login.orForm') || 'O INGRESA TUS DATOS'}
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Form Fields */}
            <AnimatePresence mode="wait">
              {viewMode === 'login' ? (
                <motion.form 
                  key="login-form"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  onSubmit={handleLoginSubmit} 
                  className="space-y-4"
                >
                  <div className="space-y-3">
                    {/* Username Input Pill */}
                    <div className="relative">
                      <UserIcon size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="text" 
                        placeholder={t('login.usernamePlaceholder') || 'Nombre'}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-12 pr-5 py-3.5 rounded-full bg-slate-50 border border-slate-200/90 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                        required
                      />
                    </div>

                    {/* Password Input Pill */}
                    <div className="relative">
                      <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="password" 
                        placeholder={t('login.passwordPlaceholder') || 'Contraseña'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-5 py-3.5 rounded-full bg-slate-50 border border-slate-200/90 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2.5 p-3.5 bg-red-50 text-red-700 rounded-2xl text-xs font-bold border border-red-100">
                      <AlertCircle size={16} className="shrink-0 text-red-600" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Main Blue Action Button */}
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 text-white rounded-full font-black text-xs uppercase tracking-widest bg-[#0039a0] hover:bg-[#002f85] shadow-lg shadow-blue-900/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <LogIn size={16} />
                    <span>{loading ? (language === 'es' ? 'Iniciando sesión...' : 'Signing in...') : (language === 'es' ? 'INICIAR SESIÓN' : 'SIGN IN')}</span>
                  </button>

                  <div className="pt-1 text-center">
                    <span className="text-slate-400 text-xs font-semibold">
                      {language === 'es' ? '¿No tienes cuenta? ' : "Don't have an account? "}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setViewMode('register'); setError(''); }}
                      className="text-xs font-black uppercase tracking-wider text-[#0039a0] hover:underline transition-colors cursor-pointer"
                    >
                      {language === 'es' ? 'Crear una' : 'Create one'}
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.form 
                  key="register-form"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  onSubmit={handleRegisterSubmit} 
                  className="space-y-4"
                >
                  <div className="space-y-3">
                    <div className="relative">
                      <UserIcon size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="text" 
                        placeholder={language === 'es' ? 'Nombre completo' : 'Full name'}
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full pl-12 pr-5 py-3.5 rounded-full bg-slate-50 border border-slate-200/90 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                        required
                      />
                    </div>

                    <div className="relative">
                      <Phone size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="tel" 
                        placeholder={language === 'es' ? 'Teléfono (Identificador)' : 'Phone number'}
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="w-full pl-12 pr-5 py-3.5 rounded-full bg-slate-50 border border-slate-200/90 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                        required
                      />
                    </div>

                    <div className="relative">
                      <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="password" 
                        placeholder={language === 'es' ? 'Crea tu contraseña (Obligatoria)' : 'Create password (Required)'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full pl-12 pr-5 py-3.5 rounded-full bg-slate-50 border border-slate-200/90 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                        required
                        minLength={4}
                      />
                    </div>

                    <div className="relative">
                      <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input 
                        type="email" 
                        placeholder={language === 'es' ? 'Correo (Opcional)' : 'Email (Optional)'}
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full pl-12 pr-5 py-3.5 rounded-full bg-slate-50 border border-slate-200/90 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2.5 p-3.5 bg-red-50 text-red-700 rounded-2xl text-xs font-bold border border-red-100">
                      <AlertCircle size={16} className="shrink-0 text-red-600" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 text-white rounded-full font-black text-xs uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles size={16} />
                    <span>{loading ? (language === 'es' ? 'Creando...' : 'Creating...') : (language === 'es' ? 'REGISTRARSE Y ENTRAR' : 'REGISTER & ACCESS')}</span>
                  </button>

                  <div className="pt-1 text-center">
                    <span className="text-slate-400 text-xs font-semibold">
                      {language === 'es' ? '¿Ya tienes cuenta? ' : 'Already have an account? '}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setViewMode('login'); setError(''); }}
                      className="text-xs font-black uppercase tracking-wider text-[#0039a0] hover:underline transition-colors cursor-pointer"
                    >
                      {language === 'es' ? 'Iniciar Sesión' : 'Sign In'}
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

          </div>
        </div>
      </motion.div>
    </div>
  );
}
