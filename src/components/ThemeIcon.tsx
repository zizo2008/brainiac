import React from 'react';
import { 
  Home, Rocket, FlaskConical, Gamepad2, 
  Trophy, Star, Award, Zap, Atom, 
  BookOpen, Telescope, Users, Orbit,
  ArrowRight, Plus, Search, CheckCircle2, 
  XCircle, SkipForward, FastForward, Flag, 
  Bookmark, Lightbulb, Sun, UserCircle, 
  Settings, Lock, Mail, Copy, History, 
  Target, Crosshair, Crown, BadgeCheck,
  Play, Medal, ChevronRight, ChevronLeft,
  Save, Download, Trash2, Moon, Send, LogOut,
  X, Camera, MessageSquare, Shield, Image,
  Dna, Microscope, TestTube, Beaker, Thermometer,
  Ghost, Skull, Swords, Joystick, Cpu, Terminal, Bot,
  Globe, Sparkles, Heart, Clock, Loader2, UserPlus, Folder, FileText, Check, User, Calendar, ArrowLeft, Eye, EyeOff, Brain, BrainCircuit, RotateCcw, Minus, TrendingUp
} from 'lucide-react';
import { ThemeName } from '../theme';

interface ThemeIconProps {
  icon: string;
  theme?: ThemeName;
  className?: string;
}

export function ThemeIcon({ icon, theme = 'default', className = '' }: ThemeIconProps) {
  const getIcon = () => {
    switch (theme) {
      case 'space':
        switch (icon) {
          case 'Home': return Rocket;
          case 'Trophy': return Orbit;
          case 'Gamepad2': return Globe;
          case 'Users': return Users;
          case 'BookOpen': return Telescope;
          case 'Lightbulb': return Sun;
          case 'Target': return Crosshair;
          case 'Play': return Rocket;
          case 'Zap': return Sparkles;
          case 'UserCircle': return Orbit;
          case 'History': return Telescope;
          case 'Medal': return Star;
          default: break;
        }
        break;
      case 'pink':
        switch (icon) {
          case 'Trophy': return Heart;
          case 'Medal': return Heart;
          case 'Zap': return Sparkles;
          default: break;
        }
        break;
    }

    // Default mapping
    switch (icon) {
      case 'Home': return Home;
      case 'Trophy': return Trophy;
      case 'Gamepad2': return Gamepad2;
      case 'Users': return Users;
      case 'BookOpen': return BookOpen;
      case 'Lightbulb': return Lightbulb;
      case 'Target': return Target;
      case 'Play': return Play;
      case 'ArrowRight': return ArrowRight;
      case 'Plus': return Plus;
      case 'Search': return Search;
      case 'CheckCircle2': return CheckCircle2;
      case 'XCircle': return XCircle;
      case 'SkipForward': return SkipForward;
      case 'Flag': return Flag;
      case 'Bookmark': return Bookmark;
      case 'UserCircle': return UserCircle;
      case 'Settings': return Settings;
      case 'Lock': return Lock;
      case 'Mail': return Mail;
      case 'Copy': return Copy;
      case 'History': return History;
      case 'Crown': return Crown;
      case 'BadgeCheck': return BadgeCheck;
      case 'Medal': return Medal;
      case 'ChevronRight': return ChevronRight;
      case 'ChevronLeft': return ChevronLeft;
      case 'Save': return Save;
      case 'Download': return Download;
      case 'Trash2': return Trash2;
      case 'Moon': return Moon;
      case 'Sun': return Sun;
      case 'Send': return Send;
      case 'LogOut': return LogOut;
      case 'X': return X;
      case 'Camera': return Camera;
      case 'MessageSquare': return MessageSquare;
      case 'Shield': return Shield;
      case 'Image': return Image;
      case 'Zap': return Zap;
      case 'Atom': return Atom;
      case 'FlaskConical': return FlaskConical;
      case 'Dna': return Dna;
      case 'Sparkles': return Sparkles;
      case 'Clock': return Clock;
      case 'Loader2': return Loader2;
      case 'UserPlus': return UserPlus;
      case 'Folder': return Folder;
      case 'FileText': return FileText;
      case 'Check': return Check;
      case 'User': return User;
      case 'Calendar': return Calendar;
      case 'ArrowLeft': return ArrowLeft;
      case 'Eye': return Eye;
      case 'EyeOff': return EyeOff;
      case 'Brain': return Brain;
      case 'BrainCircuit': return BrainCircuit;
      case 'RotateCcw': return RotateCcw;
      case 'Minus': return Minus;
      case 'TrendingUp': return TrendingUp;
      default: return Home;
    }
  };

  const IconComponent = getIcon();
  return <IconComponent className={className} />;
}
