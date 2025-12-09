'use client';
import React, { useState } from 'react';
import { authService } from '../services/authService';

interface LoginProps {
  onLogin: (email: string, userId: string) => void;
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, isDarkMode, toggleDarkMode }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      if (isRegister) {
        // Cadastro
        if (password !== confirmPassword) {
          setError('As senhas não coincidem');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('A senha deve ter pelo menos 6 caracteres');
          setIsLoading(false);
          return;
        }
        const user = await authService.register(email, password);
        if (user) {
          setMessage('Cadastro realizado com sucesso!');
          onLogin(user.email || '', user.id);
        }
      } else {
        // Login
        const user = await authService.login(email, password);
        if (user) {
          setMessage('Login realizado com sucesso!');
          onLogin(user.email || '', user.id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar requisição');
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
        <div className="bg-orange-500 text-white p-6 rounded-lg mb-6 text-center">
          <h1 className="text-3xl font-bold">Caixinha CMS</h1>
          <p className="text-sm">Gestão de Despesas & Reembolso</p>
        </div>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
        {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu.email@empresa.com" className={`w-full px-4 py-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={`w-full px-4 py-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} required />
          </div>
          {isRegister && (
            <div>
              <label className="block text-sm font-medium mb-2">Confirmar Senha</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={`w-full px-4 py-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} required />
            </div>
          )}
          <button type="submit" disabled={isLoading} className="w-full bg-orange-500 text-white py-2 rounded font-semibold hover:bg-orange-600 disabled:opacity-50">
            {isLoading ? 'Processando...' : isRegister ? 'Cadastrar' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-300 dark:border-gray-700 text-center">
          <button type="button" onClick={() => { setIsRegister(!isRegister); setError(null); setMessage(null); }} className="text-orange-500 hover:underline text-sm">
            {isRegister ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
