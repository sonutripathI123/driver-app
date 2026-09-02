import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User;
  token: string | null;
  currentRole: UserRole;
  switchRole: (role: UserRole) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const defaultAdminUser: User = {
  id: 'admin-seed-01',
  email: 'book@opalchauffeurs.com.au',
  full_name: 'Harps Randhawa (Director)',
  role: 'ADMIN',
  phone: '+61 432 000 718',
  is_active: true,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(() => {
    try {
      const saved = localStorage.getItem('chauffeur_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email && parsed.email.includes('opalchauffeurs.com.au')) {
          return {
            ...parsed,
            full_name: 'Harps Randhawa (Director)',
            email: 'book@opalchauffeurs.com.au'
          };
        }
      }
    } catch (e) {}
    localStorage.setItem('chauffeur_user', JSON.stringify(defaultAdminUser));
    return defaultAdminUser;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('chauffeur_access_token') || 'mock-admin-token';
  });

  const [currentRole, setCurrentRole] = useState<UserRole>(user.role);

  useEffect(() => {
    setCurrentRole(user.role);
  }, [user]);

  const switchRole = (role: UserRole) => {
    const roleNames: Record<UserRole, string> = {
      ADMIN: 'Harps Randhawa (Director)',
      OPERATIONS_MANAGER: 'Marcus Sterling (Ops Lead)',
      DISPATCHER: 'Olivia Vance (Lead Dispatcher)',
      ACCOUNTANT: 'Gregory Finch (CFO & Tax)',
      DRIVER: 'Sonu Tripathi (Lead VIP Chauffeur)',
      CUSTOMER: 'Rio Tinto Mining (Corporate VIP)',
    };

    const updated: User = {
      ...user,
      role,
      full_name: roleNames[role],
      email: `${role.toLowerCase()}@opalchauffeurs.com.au`,
    };

    setUser(updated);
    localStorage.setItem('chauffeur_user', JSON.stringify(updated));
  };

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('chauffeur_access_token', newToken);
    localStorage.setItem('chauffeur_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(defaultAdminUser);
    localStorage.removeItem('chauffeur_access_token');
    localStorage.removeItem('chauffeur_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, currentRole, switchRole, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
