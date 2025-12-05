
import React, { useState, useRef, useEffect } from 'react';
import { authService } from '../services/authService';
import { verifyFaceIdentity } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

interface LoginProps {
  onLogin: (email: string, userId: string) => void;
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
}

type ViewState = 'LOGIN' | 'REGISTER_EMAIL' | 'REGISTER_VERIFY' | 'REGISTER_PASSWORD' | 'REGISTER_FACE';

const Login: React.FC<LoginProps> = ({ onLogin, isDarkMode, toggleDarkMode }) => {
  const [view, setView] = useState<ViewState>('LOGIN');
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [faceData, setFaceData] = useState<string | null>(null);
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Camera State
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'REGISTER' | 'LOGIN'>('LOGIN');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const clearErrors = () => {
    setError(null);
    setNotification(null);
  };

  // --- Camera Logic ---
  const startCamera = async (mode: 'REGISTER' | 'LOGIN') => {
    clearErrors();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      streamRef.current = stream;
      setCameraMode(mode);
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch (err) {
      setError("Erro ao acessar câmera. Verifique permissões.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg');
        const cleanBase64 = base64.split(',')[1];
        
        stopCamera();

        if (cameraMode === 'REGISTER') {
          setFaceData(cleanBase64);
          setNotification("Rosto registrado! Prossiga para finalizar.");
        } else {
          // LOGIN MODE
          handleBiometricVerification(cleanBase64);
        }
      }
    }
  };

  const handleBiometricVerification = async (currentFace: string) => {
    // Biometria requer cache local ou usuário já logado.
    // Como estamos na tela de login, tentamos pegar do cache local pelo email (simulado)
    // Em um cenário real Supabase, login facial requer Edge Functions ou tabela pública.
    
    // HACK: Tentar buscar ID de um "banco local" de emails conhecidos se existir,
    // ou simplesmente avisar que precisa logar com senha a primeira vez.
    
    // Por hora, vamos mostrar erro se não tiver cache.
    setError("Para usar biometria com segurança, faça login com senha a primeira vez neste dispositivo.");
  };
  // --------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setIsLoading(true);
    
    if (!email || !password) {
      setError("Preencha todos os campos.");
      setIsLoading(false);
      return;
    }

    try {
      const user = await authService.login(email, password);
      if (user) {
        // Cachear biometria para futuro
        await authService.cacheFaceData(user.id);
        onLogin(user.email || '', user.id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Falha no login. Verifique suas credenciais.");
    } finally {
      setIsLoading(false);
    }
  };

  const startRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (!email.includes('@')) {
      setError("Digite um email válido.");
      return;
    }

    setIsLoading(true);
    try {
      await authService.sendVerificationCode(email);
      alert(`Código de verificação enviado para ${email} (Simulado: 123456)`);
      setView('REGISTER_VERIFY');
      setNotification("Código enviado para seu email.");
    } catch (err: any) {
      setError(err.message || "Erro ao enviar código.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    if (verificationCode === '123456') {
      setView('REGISTER_PASSWORD');
    } else {
      setError("Código inválido. Tente novamente.");
    }
  };

  const handlePasswordSet = (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    // Proceed to Face ID setup
    setView('REGISTER_FACE');
  };

  const completeRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setIsLoading(true);
    setLoadingMessage("Criando conta no banco de dados seguro...");

    try {
      const user = await authService.register(email, password, faceData || undefined);
      if (user) {
        alert("Cadastro realizado com sucesso! Você já está logado.");
        onLogin(user.email || '', user.id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao registrar usuário.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-black p-4 transition-colors duration-300">
      
      {/* CAMERA OVERLAY */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
             <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" />
             {/* Face overlay guide */}
             <div className="absolute w-64 h-80 border-2 border-orange-500 rounded-full opacity-50 pointer-events-none"></div>
             <p className="absolute top-10 text-white font-bold bg-black/50 px-4 py-1 rounded">Posicione seu rosto</p>
          </div>
          <div className="bg-gray-900 p-6 flex items-center justify-between pb-safe safe-area-bottom">
             <button onClick={stopCamera} className="text-white text-sm px-4 py-2 rounded bg-gray-800 hover:bg-gray-700">Cancelar</button>
             <button onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-orange-500 shadow-lg active:scale-95 transition-transform"></button>
             <div className="w-16"></div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-800 transition-colors duration-300">
        <div className="bg-orange-600 p-8 text-center relative">
          <h1 className="text-3xl font-bold text-white tracking-tight">Caixinha CMS</h1>
          <p className="text-orange-100 mt-2">Gestão de Despesas & Reembolso</p>
          {toggleDarkMode && (
            <button onClick={toggleDarkMode} className="absolute top-4 right-4 text-orange-200 hover:text-white">
              {isDarkMode ? '☀' : '☾'}
            </button>
          )}
        </div>

        <div className="p-8">
          {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded border border-red-100 dark:border-red-800">{error}</div>}
          {notification && <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm rounded border border-green-100 dark:border-green-800">{notification}</div>}

          {/* VIEW: LOGIN */}
          {view === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Corporativo</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 dark:text-white" placeholder="seu.nome@empresa.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Senha</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 dark:text-white" placeholder="••••••••" />
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-3 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 transition-colors">
                {isLoading ? 'Entrando...' : 'Entrar'}
              </button>

              <div className="mt-6">
                 <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300 dark:border-gray-700" /></div>
                    <div className="relative flex justify-center text-sm"><span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">Ou use reconhecimento facial</span></div>
                 </div>
                 <button type="button" onClick={() => startCamera('LOGIN')} disabled={isLoading} className="mt-4 w-full flex justify-center items-center py-3 px-4 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.2-2.858.59-4.18M5.55 17.55l-1 -1.1" /></svg>
                    Acessar com Biometria
                 </button>
              </div>

              <div className="text-center mt-4">
                <button type="button" onClick={() => { clearErrors(); setView('REGISTER_EMAIL'); }} className="text-sm font-medium text-orange-600 hover:text-orange-500">Cadastrar-se</button>
              </div>
            </form>
          )}

          {/* VIEW: REGISTER EMAIL */}
          {view === 'REGISTER_EMAIL' && (
            <form onSubmit={startRegistration} className="space-y-6">
               <h3 className="text-center text-lg font-bold text-gray-800 dark:text-white">Criar Conta (1/4)</h3>
               <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 dark:text-white" placeholder="email@empresa.com" />
               <button type="submit" disabled={isLoading} className="w-full py-3 px-4 rounded-md text-white bg-orange-600 hover:bg-orange-700">{isLoading ? 'Enviando...' : 'Enviar Código'}</button>
               <button type="button" onClick={() => setView('LOGIN')} className="w-full text-sm text-gray-500 mt-2">Voltar</button>
            </form>
          )}

          {/* VIEW: REGISTER CODE */}
          {view === 'REGISTER_VERIFY' && (
             <form onSubmit={verifyCode} className="space-y-6">
                <h3 className="text-center text-lg font-bold text-gray-800 dark:text-white">Verificação (2/4)</h3>
                <input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-center text-2xl tracking-widest bg-white dark:bg-gray-800 dark:text-white" placeholder="000000" />
                <button type="submit" className="w-full py-3 px-4 rounded-md text-white bg-orange-600 hover:bg-orange-700">Validar</button>
                <button type="button" onClick={() => setView('REGISTER_EMAIL')} className="w-full text-sm text-gray-500 mt-2">Corrigir Email</button>
             </form>
          )}

          {/* VIEW: REGISTER PASSWORD */}
          {view === 'REGISTER_PASSWORD' && (
             <form onSubmit={handlePasswordSet} className="space-y-6">
               <h3 className="text-center text-lg font-bold text-gray-800 dark:text-white">Senha (3/4)</h3>
               <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 dark:text-white" placeholder="Senha" />
               <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 dark:text-white" placeholder="Confirmar Senha" />
               <button type="submit" className="w-full py-3 px-4 rounded-md text-white bg-orange-600 hover:bg-orange-700">Próximo</button>
             </form>
          )}

          {/* VIEW: REGISTER FACE */}
          {view === 'REGISTER_FACE' && (
            <div className="space-y-6 text-center">
               <h3 className="text-lg font-bold text-gray-800 dark:text-white">Biometria (4/4)</h3>
               <p className="text-sm text-gray-500 dark:text-gray-400">Cadastre seu rosto para facilitar o login futuro.</p>
               
               {faceData ? (
                 <div className="relative w-32 h-32 mx-auto">
                    <img src={`data:image/jpeg;base64,${faceData}`} className="w-full h-full rounded-full object-cover border-4 border-green-500" alt="Face" />
                    <div className="absolute bottom-0 right-0 bg-green-500 text-white p-1 rounded-full"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                 </div>
               ) : (
                 <div className="w-32 h-32 mx-auto bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                 </div>
               )}

               {!faceData ? (
                  <button onClick={() => startCamera('REGISTER')} className="w-full py-3 px-4 border border-orange-600 text-orange-600 rounded-md hover:bg-orange-50 dark:hover:bg-gray-800">
                    Abrir Câmera e Cadastrar Rosto
                  </button>
               ) : (
                 <button onClick={() => setFaceData(null)} className="text-sm text-red-500 underline">Tirar outra foto</button>
               )}
               
               <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                  <button onClick={completeRegistration} disabled={isLoading} className="w-full py-3 px-4 rounded-md text-white bg-green-600 hover:bg-green-700 shadow-lg flex justify-center items-center">
                    {isLoading ? (
                      <span>Registrando...</span>
                    ) : (
                      faceData ? 'Finalizar com Biometria' : 'Pular e Finalizar'
                    )}
                  </button>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;
