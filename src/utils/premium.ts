import { UserProfile, Level } from '../types';

export function isGlobalPremium(user?: UserProfile | null): boolean {
  if (!user) return false;
  if (user.role === 'teacher' || user.role === 'admin') return true;
  if (user.isPremium) return true; // Legacy support
  return !!user.premiumPlan;
}

export function hasPremiumForLevel(user?: UserProfile | null, level?: Level | string): boolean {
  if (!user) return false;
  if (user.role === 'teacher' || user.role === 'admin') return true;
  if (user.isPremium || user.premiumPlan === 'brainiac_one') return true;
  
  if (user.premiumPlan === 'al_pack' && level === 'a_level') return true;
  if (user.premiumPlan === 'ol_pack' && level === 'extended') return true;
  if (user.premiumPlan === 'core_pack' && level === 'core') return true;
  
  return false;
}
