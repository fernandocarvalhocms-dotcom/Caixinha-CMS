
import { v4 as uuidv4 } from 'uuid';

const USERS_KEY = 'caixinha_users_db';

export interface User {
  email: string;
  password: string; // In a real app, this would be hashed
  faceData?: string; // Base64 reference photo
  name?: string;
}

export const authService = {
  // Simulate checking if user exists
  userExists: (email: string): boolean => {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    return users.some((u: User) => u.email === email);
  },

  // Simulate registering a user with optional face data
  register: (email: string, password: string, faceData?: string) => {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    if (users.some((u: User) => u.email === email)) {
      throw new Error('Usuário já cadastrado.');
    }
    users.push({ email, password, faceData });
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return true;
  },

  // Simulate login
  login: (email: string, password: string): boolean => {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const user = users.find((u: User) => u.email === email && u.password === password);
    return !!user;
  },

  // Get user's reference face data
  getFaceData: (email: string): string | undefined => {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const user = users.find((u: User) => u.email === email);
    return user?.faceData;
  },

  // Simulate sending a verification code
  sendVerificationCode: async (email: string): Promise<string> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // In a real app, this calls an API. Here we return a fixed code for demo.
        resolve('123456'); 
      }, 1500);
    });
  }
};