
export interface Unit {
  id: string;
  name: string;
  shortName: string;
}

export interface User {
  phone: string;
  password: string;
  name: string;
  role: 'admin' | 'user';
}

export interface StockEntry {
  quantity: number;
  unitId: string;
  expiryDate?: string;
}

export interface Tab {
  id: string;
  name: string;
  instruction?: string; // Instrução para a IA saber o que categorizar aqui
}

export interface Product {
  id: string;
  tabId: string;
  code?: string;
  name: string;
  stocks: StockEntry[]; 
  lastCounted: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  step: 'login' | 'otp' | 'authenticated';
  phone: string;
  role: 'admin' | 'user';
}
