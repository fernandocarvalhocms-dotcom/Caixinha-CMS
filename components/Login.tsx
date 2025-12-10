
import React, { useState } from 'react';
import { authService } from '../services/authService';
import supabase from '../services/supabaseClient';

interface LoginProps {
  onLogin: (email: string, userId: string) => void;
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
}

type ViewState = 'LOGIN' | 'REGISTER_EMAIL' | 'REGISTER_VERIFY' | 'REGISTER_PASSWORD';

const Login: React.FC<LoginProps> = ({ onLogin, isDarkMode, toggleDarkMode }) => {
  const [view, setView] = useState<ViewState>('LOGIN');
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const clearErrors = () => {
    setError(null);
    setNotification(null);
  };

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
        onLogin(user.email || '', user.id);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message.includes('Email not confirmed')) {
          setError("Seu email ainda não foi confirmado. Verifique sua caixa de entrada (e spam).");
      } else if (err.message.includes('Invalid login credentials')) {
          setError("Email ou senha incorretos.");
      } else {
          setError(err.message || "Falha no login. Verifique suas credenciais.");
      }
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
      // alert(`Código de verificação enviado para ${email} (Simulado: 123456)`);
      setView('REGISTER_VERIFY');
      setNotification("Código (Simulado: 123456) enviado para seu email.");
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

  const handlePasswordSet = async (e: React.FormEvent) => {
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
    
    // Direct registration since face step is removed
    await completeRegistration();
  };

  const completeRegistration = async () => {
    setIsLoading(true);
    setLoadingMessage("Criando conta no banco de dados seguro...");

    try {
      const user = await authService.register(email, password);
      if (user) {
        alert("Cadastro realizado com sucesso! Você já está logado.");
        onLogin(user.email || '', user.id);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === 'CONFIRM_EMAIL_REQUIRED') {
          setNotification("Conta criada com sucesso! Enviamos um link de confirmação para o seu email. Confirme antes de entrar.");
          setView('LOGIN');
          setPassword(''); // Keep email, clear password
      } else {
          setError(err.message || "Erro ao registrar usuário.");
      }
      setIsLoading(false);
    } 
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-black p-4 transition-colors duration-300">
      
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

              <div className="text-center mt-6">
                 <div className="relative mb-4">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300 dark:border-gray-700" /></div>
                    <div className="relative flex justify-center text-sm"><span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">Novo por aqui?</span></div>
                 </div>
                <button type="button" onClick={() => { clearErrors(); setView('REGISTER_EMAIL'); }} className="text-sm font-medium text-orange-600 hover:text-orange-500">Cadastrar-se</button>
              </div>
            </form>
          )}

          {/* VIEW: REGISTER EMAIL */}
          {view === 'REGISTER_EMAIL' && (
            <form onSubmit={startRegistration} className="space-y-6">
               <h3 className="text-center text-lg font-bold text-gray-800 dark:text-white">Criar Conta (1/3)</h3>
               <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 dark:text-white" placeholder="email@empresa.com" />
               <button type="submit" disabled={isLoading} className="w-full py-3 px-4 rounded-md text-white bg-orange-600 hover:bg-orange-700">{isLoading ? 'Enviando...' : 'Enviar Código'}</button>
               <button type="button" onClick={() => setView('LOGIN')} className="w-full text-sm text-gray-500 mt-2">Voltar</button>
            </form>
          )}

          {/* VIEW: REGISTER CODE */}
          {view === 'REGISTER_VERIFY' && (
             <form onSubmit={verifyCode} className="space-y-6">
                <h3 className="text-center text-lg font-bold text-gray-800 dark:text-white">Verificação (2/3)</h3>
                <input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-center text-2xl tracking-widest bg-white dark:bg-gray-800 dark:text-white" placeholder="000000" />
                <button type="submit" className="w-full py-3 px-4 rounded-md text-white bg-orange-600 hover:bg-orange-700">Validar</button>
                <button type="button" onClick={() => setView('REGISTER_EMAIL')} className="w-full text-sm text-gray-500 mt-2">Corrigir Email</button>
             </form>
          )}

          {/* VIEW: REGISTER PASSWORD */}
          {view === 'REGISTER_PASSWORD' && (
             <form onSubmit={handlePasswordSet} className="space-y-6">
               <h3 className="text-center text-lg font-bold text-gray-800 dark:text-white">Senha (3/3)</h3>
               <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 dark:text-white" placeholder="Senha" />
               <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 dark:text-white" placeholder="Confirmar Senha" />
               <button type="submit" disabled={isLoading} className="w-full py-3 px-4 rounded-md text-white bg-orange-600 hover:bg-orange-700">
                  {isLoading ? 'Criando Conta...' : 'Finalizar Cadastro'}
               </button>
             </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;
