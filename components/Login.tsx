import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';

interface LoginProps {
  onLogin: (email: string, userId: string) => void;
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
}

type ViewState = 'LOGIN' | 'REGISTER_EMAIL' | 'REGISTER_VERIFY' | 'REGISTER_PASSWORD';

const Login: React.FC<LoginProps> = ({ onLogin, isDarkMode, toggleDarkMode }) => {
  const [view, setView] = useState<ViewState>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const clearErrors = () => {
    setError(null);
    setNotification(null);
  };

  // LOGIN
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setIsLoading(true);
    setLoadingMessage('Entrando...');

    try {
      const user = await authService.login(email, password);
      if (user) {
        setNotification('Login realizado com sucesso!');
        onLogin(user.email || '', user.id);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  // REGISTER - Email
  const handleRegisterEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setIsLoading(true);
    setLoadingMessage('Enviando código de verificação...');

    try {
      await authService.sendVerificationEmail(email);
      setNotification('Código de verificação enviado para seu email');
      setView('REGISTER_VERIFY');
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar email');
    } finally {
      setIsLoading(false);
    }
  };

  // REGISTER - Verify Code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setIsLoading(true);
    setLoadingMessage('Verificando código...');

    try {
      await authService.verifyEmailCode(email, verificationCode);
      setNotification('Email verificado! Agora crie sua senha');
      setView('REGISTER_PASSWORD');
    } catch (err: any) {
      setError(err.message || 'Código inválido');
    } finally {
      setIsLoading(false);
    }
  };

  // REGISTER - Set Password
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (password !== confirmPassword) {
      setError('As senhas não conferem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Criando conta...');

    try {
      const user = await authService.register(email, password);
      if (user) {
        setNotification('Cadastro realizado com sucesso!');
        onLogin(user.email || '', user.id);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <button
        onClick={toggleDarkMode}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700"
      >
        {isDarkMode ? '🌙' : '☀️'}
      </button>

      <div className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'} rounded-lg shadow-lg p-8 w-full max-w-md`}>
        {/* Header */}
        <div className="bg-orange-500 text-white p-6 rounded-lg mb-6 text-center">
          <h1 className="text-3xl font-bold">Caixinha CMS</h1>
          <p className="text-sm">Gestão de Despesas & Reembolso</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Notification Message */}
        {notification && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {notification}
          </div>
        )}

        {/* LOGIN VIEW */}
        {view === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@empresa.com"
                className={`w-full px-4 py-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-4 py-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-orange-500 text-white py-2 rounded font-semibold hover:bg-orange-600 disabled:opacity-50"
            >
              {isLoading ? loadingMessage : 'Entrar'}
            </button>
          </form>
        )}

        {/* REGISTER EMAIL VIEW */}
        {view === 'REGISTER_EMAIL' && (
          <form onSubmit={handleRegisterEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email Corporativo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@empresa.com"
                className={`w-full px-4 py-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-orange-500 text-white py-2 rounded font-semibold hover:bg-orange-600 disabled:opacity-50"
            >
              {isLoading ? loadingMessage : 'Enviar Código'}
            </button>
          </form>
        )}

        {/* REGISTER VERIFY VIEW */}
        {view === 'REGISTER_VERIFY' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <p className="text-sm text-gray-600">Código enviado para {email}</p>
            <div>
              <label className="block text-sm font-medium mb-2">Código de Verificação</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className={`w-full px-4 py-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-orange-500 text-white py-2 rounded font-semibold hover:bg-orange-600 disabled:opacity-50"
            >
              {isLoading ? loadingMessage : 'Verificar'}
            </button>
          </form>
        )}

        {/* REGISTER PASSWORD VIEW */}
        {view === 'REGISTER_PASSWORD' && (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-4 py-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Confirmar Senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-4 py-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-orange-500 text-white py-2 rounded font-semibold hover:bg-orange-600 disabled:opacity-50"
            >
              {isLoading ? loadingMessage : 'Criar Conta'}
            </button>
          </form>
        )}

        {/* Footer Links */}
        <div className="mt-6 pt-6 border-t border-gray-300 dark:border-gray-700 text-center space-y-2">
          {(view === 'LOGIN' || view === 'REGISTER_EMAIL' || view === 'REGISTER_VERIFY' || view === 'REGISTER_PASSWORD') && (
            <>
              {view !== 'LOGIN' && (
                <button
                  type="button"
                  onClick={() => {
                    setView('LOGIN');
                    clearErrors();
                  }}
                  className="text-orange-500 hover:underline text-sm"
                >
                  ← Voltar ao Login
                </button>
              )}
              {view === 'LOGIN' && (
                <button
                  type="button"
                  onClick={() => {
                    setView('REGISTER_EMAIL');
                    clearErrors();
                  }}
                  className="text-orange-500 hover:underline text-sm"
                >
                  Cadastrar-se
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
