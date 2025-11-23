
import React, { useState } from 'react';
import { authService } from '../services/authService';

interface LoginProps {
  onLogin: (email: string) => void;
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
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const clearErrors = () => {
    setError(null);
    setNotification(null);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    
    if (!email || !password) {
      setError("Preencha todos os campos.");
      return;
    }

    if (authService.login(email, password)) {
      onLogin(email);
    } else {
      setError("Email ou senha incorretos. Se não tem conta, cadastre-se.");
    }
  };

  const startRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (!email.includes('@')) {
      setError("Digite um email válido.");
      return;
    }

    if (authService.userExists(email)) {
      setError("Este email já possui cadastro. Faça login.");
      return;
    }

    setIsLoading(true);
    try {
      await authService.sendVerificationCode(email);
      // Simulate email sent
      alert(`SIMULAÇÃO: O código de verificação enviado para ${email} é: 123456`);
      setView('REGISTER_VERIFY');
      setNotification("Código enviado para seu email.");
    } catch (err) {
      setError("Erro ao enviar código.");
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

  const completeRegistration = (e: React.FormEvent) => {
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

    try {
      authService.register(email, password);
      alert("Cadastro realizado com sucesso!");
      // Auto login
      onLogin(email);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleBiometricLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      // For biometric demo, we assume a default demo user or require previous login
      // Since we added DB logic, we'll disable this for now or mock a specific user
      alert("Para segurança, faça login com senha na primeira vez neste dispositivo.");
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-black p-4 transition-colors duration-300">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-800 transition-colors duration-300">
        <div className="bg-orange-600 p-8 text-center relative">
          <h1 className="text-3xl font-bold text-white tracking-tight">Caixinha CMS</h1>
          <p className="text-orange-100 mt-2">Gestão de Despesas & Reembolso</p>
          {toggleDarkMode && (
            <button 
              onClick={toggleDarkMode}
              className="absolute top-4 right-4 text-orange-200 hover:text-white"
            >
              {isDarkMode ? '☀' : '☾'}
            </button>
          )}
        </div>

        <div className="p-8">
          {/* Error / Notification Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}
          {notification && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm rounded border border-green-100 dark:border-green-800">
              {notification}
            </div>
          )}

          {/* VIEW: LOGIN */}
          {view === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Corporativo</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-800 dark:text-white"
                  placeholder="seu.nome@empresa.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-800 dark:text-white"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
              >
                Entrar
              </button>

              <div className="text-center mt-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">Não tem acesso? </span>
                <button type="button" onClick={() => { clearErrors(); setView('REGISTER_EMAIL'); }} className="text-sm font-medium text-orange-600 hover:text-orange-500">
                  Cadastrar-se
                </button>
              </div>
            </form>
          )}

          {/* VIEW: REGISTER STEP 1 - EMAIL */}
          {view === 'REGISTER_EMAIL' && (
            <form onSubmit={startRegistration} className="space-y-6">
               <div className="text-center mb-4">
                 <h3 className="text-lg font-bold text-gray-800 dark:text-white">Criar Conta</h3>
                 <p className="text-xs text-gray-500">Passo 1: Validação de Email</p>
               </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Seu Email Corporativo</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white dark:bg-gray-800 dark:text-white"
                  placeholder="email@empresa.com"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none"
              >
                {isLoading ? 'Enviando...' : 'Enviar Código de Verificação'}
              </button>
              <button type="button" onClick={() => setView('LOGIN')} className="w-full text-sm text-gray-500 mt-2">Voltar para Login</button>
            </form>
          )}

          {/* VIEW: REGISTER STEP 2 - CODE */}
          {view === 'REGISTER_VERIFY' && (
             <form onSubmit={verifyCode} className="space-y-6">
                <div className="text-center mb-4">
                 <h3 className="text-lg font-bold text-gray-800 dark:text-white">Verificação</h3>
                 <p className="text-xs text-gray-500">Passo 2: Digite o código enviado para {email}</p>
               </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Código (Simulação: 123456)</label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-orange-500 bg-white dark:bg-gray-800 dark:text-white"
                  placeholder="000000"
                />
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none"
              >
                Validar Código
              </button>
              <button type="button" onClick={() => setView('REGISTER_EMAIL')} className="w-full text-sm text-gray-500 mt-2">Alterar Email</button>
             </form>
          )}

          {/* VIEW: REGISTER STEP 3 - PASSWORD */}
          {view === 'REGISTER_PASSWORD' && (
             <form onSubmit={completeRegistration} className="space-y-6">
               <div className="text-center mb-4">
                 <h3 className="text-lg font-bold text-gray-800 dark:text-white">Definir Senha</h3>
                 <p className="text-xs text-gray-500">Passo 3: Proteja sua conta</p>
               </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 bg-white dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirmar Senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 bg-white dark:bg-gray-800 dark:text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none"
              >
                Finalizar Cadastro
              </button>
             </form>
          )}

          {/* Biometric Fallback (Only on Login) */}
          {view === 'LOGIN' && (
            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">Acesso Rápido</span>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-3">
                <button
                  onClick={handleBiometricLogin}
                  disabled={isLoading}
                  className="w-full inline-flex justify-center items-center py-3 px-4 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.2-2.858.59-4.18M5.55 17.55l-1 -1.1" />
                  </svg>
                  Biometria
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
