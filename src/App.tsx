/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase";
import { 
  ArrowRight, 
  CheckCircle2, 
  ChevronRight, 
  HardHat, 
  LineChart, 
  MessageSquare, 
  Target, 
  Zap,
  Calendar,
  MessageCircle,
  X,
  Menu,
  ChevronDown,
  Star,
  ShieldCheck
} from "lucide-react";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const BookingModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: ''
  });

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (formData.name.trim().length < 2) {
      newErrors.name = "Please enter your full name";
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    const phoneRegex = /^\+?[\d\s-()]{10,}$/;
    if (!phoneRegex.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number (min 10 digits)";
    }
    
    if (formData.company.trim().length < 2) {
      newErrors.company = "Please enter your company name";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      // Save to Firestore
      const path = 'appointments';
      try {
        await addDoc(collection(db, path), {
          ...formData,
          createdAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }

      const webhookUrl = (import.meta as any).env.VITE_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }
      setStep(2);
    } catch (error) {
      console.error('Error submitting form:', error);
      setStep(2);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-white/10 p-6 rounded-2xl w-full max-w-md relative max-h-[90vh] overflow-y-auto focus:outline-none"
        tabIndex={-1}
        autoFocus
      >
        <button 
          onClick={() => { onClose(); setTimeout(() => setStep(1), 300); }} 
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-orange-500"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>
        
        {step === 1 ? (
          <>
            <h2 id="modal-title" className="text-2xl font-bold mb-2">Let's get to know you</h2>
            <p className="text-zinc-400 mb-6">Please fill out these details before booking your session.</p>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-zinc-400 mb-1">Full Name</label>
                <input 
                  id="name"
                  type="text" 
                  autoComplete="name"
                  required
                  value={formData.name}
                  onChange={e => {
                    setFormData({...formData, name: e.target.value});
                    if (errors.name) setErrors({...errors, name: ''});
                  }}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  className={`w-full bg-zinc-800 border ${errors.name ? 'border-red-500' : 'border-white/10'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all`}
                  placeholder="John Doe"
                />
                {errors.name && <p id="name-error" className="text-red-500 text-xs mt-1" role="alert">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-1">Email Address</label>
                <input 
                  id="email"
                  type="email" 
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={e => {
                    setFormData({...formData, email: e.target.value});
                    if (errors.email) setErrors({...errors, email: ''});
                  }}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className={`w-full bg-zinc-800 border ${errors.email ? 'border-red-500' : 'border-white/10'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all`}
                  placeholder="john@company.com"
                />
                {errors.email && <p id="email-error" className="text-red-500 text-xs mt-1" role="alert">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-zinc-400 mb-1">Phone Number</label>
                <input 
                  id="phone"
                  type="tel" 
                  autoComplete="tel"
                  required
                  value={formData.phone}
                  onChange={e => {
                    setFormData({...formData, phone: e.target.value});
                    if (errors.phone) setErrors({...errors, phone: ''});
                  }}
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "phone-error" : undefined}
                  className={`w-full bg-zinc-800 border ${errors.phone ? 'border-red-500' : 'border-white/10'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all`}
                  placeholder="+1 (555) 000-0000"
                />
                {errors.phone && <p id="phone-error" className="text-red-500 text-xs mt-1" role="alert">{errors.phone}</p>}
              </div>
              <div>
                <label htmlFor="company" className="block text-sm font-medium text-zinc-400 mb-1">Company Name</label>
                <input 
                  id="company"
                  type="text" 
                  autoComplete="organization"
                  required
                  value={formData.company}
                  onChange={e => {
                    setFormData({...formData, company: e.target.value});
                    if (errors.company) setErrors({...errors, company: ''});
                  }}
                  aria-invalid={!!errors.company}
                  aria-describedby={errors.company ? "company-error" : undefined}
                  className={`w-full bg-zinc-800 border ${errors.company ? 'border-red-500' : 'border-white/10'} rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all`}
                  placeholder="BuildScale Construction"
                />
                {errors.company && <p id="company-error" className="text-red-500 text-xs mt-1" role="alert">{errors.company}</p>}
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg mt-2 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-orange-500"
              >
                {isSubmitting ? 'Processing...' : 'Continue to Booking'} <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 id="modal-title" className="text-2xl font-bold mb-2">Request Received!</h2>
            <p className="text-zinc-400 mb-8">We've saved your details. To finalize your strategy session, please choose one of the following next steps:</p>
            
            <div className="flex flex-col gap-4 mb-8" role="list">
              <a 
                href="https://calendar.google.com/calendar/u/0/r?hl=en" 
                target="_blank" 
                rel="noopener noreferrer"
                role="listitem"
                className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 hover:border-orange-500/50 transition-all group focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 text-orange-500 transition-colors">
                  <Calendar className="w-6 h-6" aria-hidden="true" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-white">Schedule Video Call</div>
                  <div className="text-sm text-zinc-400">Finalize via Google Meet</div>
                </div>
              </a>

              <a 
                href="https://wa.me/+16825591608?text=Hi%20Abhiram,%20I'm%20interested%20in%20booking%20a%20strategy%20session%20for%20my%20construction%20business." 
                target="_blank" 
                rel="noopener noreferrer"
                role="listitem"
                className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 hover:border-green-500/50 transition-all group focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 text-green-500 transition-colors">
                  <MessageCircle className="w-6 h-6" aria-hidden="true" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-white">Message on WhatsApp</div>
                  <div className="text-sm text-zinc-400">Chat directly with the founder</div>
                </div>
              </a>
            </div>

            <button 
              onClick={() => { onClose(); setTimeout(() => setStep(1), 300); }}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              Close and Return to Site
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const Navbar = ({ onBookCall }: { onBookCall: () => void }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { name: "Services", href: "#services" },
    { name: "Results", href: "#results" },
    { name: "Process", href: "#process" },
    { name: "FAQ", href: "#faq" },
  ];

  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-lg p-1" aria-label="BuildScale Home">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <HardHat className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">BuildScale</span>
        </a>
        
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
          {navLinks.map((link) => (
            <a key={link.name} href={link.href} className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-md px-2 py-1">
              {link.name}
            </a>
          ))}
          <button 
            onClick={onBookCall} 
            className="bg-white text-zinc-950 px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-zinc-200 transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
          >
            Book a Call <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden text-zinc-400 hover:text-white transition-colors p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Nav Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/10 bg-zinc-950 overflow-hidden"
          >
            <div className="flex flex-col p-6 gap-6">
              {navLinks.map((link) => (
                <a 
                  key={link.name} 
                  href={link.href} 
                  onClick={() => setIsMenuOpen(false)}
                  className="text-lg font-medium text-zinc-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-md px-2 py-1"
                >
                  {link.name}
                </a>
              ))}
              <button 
                onClick={() => {
                  setIsMenuOpen(false);
                  onBookCall();
                }} 
                className="w-full bg-white text-zinc-950 px-5 py-4 rounded-xl text-base font-semibold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
              >
                Book a Call <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

const TypingHeading = ({ onComplete, skipTyping }: { onComplete: () => void; skipTyping: boolean }) => {
  const text = "Turn your construction business into a lead-generating machine with Meta Ads.";
  const [displayText, setDisplayText] = useState(skipTyping ? text : "");
  
  useEffect(() => {
    if (skipTyping) {
      const timeout = setTimeout(onComplete, 10000);
      return () => clearTimeout(timeout);
    }

    let i = 0;
    const interval = setInterval(() => {
      setDisplayText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        setTimeout(onComplete, 10000);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [onComplete, skipTyping]);

  return (
    <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1] mb-6 min-h-[3.3em] md:min-h-[2.2em]" aria-label={text}>
      <span aria-hidden="true">
        {displayText.split("Meta Ads").map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 && <span className="text-gradient-orange">Meta Ads</span>}
          </span>
        ))}
        {!skipTyping && <span className="inline-block w-1 h-12 md:h-16 bg-orange-500 ml-1 animate-pulse align-middle" />}
      </span>
    </h1>
  );
};

const Hero = ({ onBookCall }: { onBookCall: () => void }) => {
  const [key, setKey] = useState(0);

  return (
    <section key={key} className="relative pt-40 pb-20 overflow-hidden">
      {/* Background Glow */}
      <motion.div 
        initial={{ opacity: 0.3, scale: 0.8 }}
        animate={{ 
          opacity: [0.3, 0.5, 0.3],
          scale: [0.8, 1.1, 0.8],
          x: [0, 20, 0],
          y: [0, -20, 0]
        }}
        transition={{ 
          duration: 10, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/20 rounded-full blur-[120px] pointer-events-none" 
      />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-sm font-medium mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            Accepting 2 new partners this month
          </motion.div>
          
          <TypingHeading skipTyping={key === 0} onComplete={() => setKey(prev => prev + 1)} />
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl"
          >
            Stop relying on word-of-mouth and shared lead platforms. We use targeted Meta Ads to deliver exclusive, high-ticket jobs directly to your calendar.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBookCall} 
              className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(249,115,22,0.3)]"
            >
              Get Your Free Growth Plan <ArrowRight className="w-5 h-5" />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto glass-panel hover:bg-white/10 px-8 py-4 rounded-full text-lg font-medium transition-all"
            >
              View Our Results
            </motion.button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Features = () => {
  const features = [
    {
      icon: <Target className="w-6 h-6 text-orange-400" />,
      title: "Hyper-Targeted Meta Ads",
      description: "We don't just boost posts. We build direct-response campaigns targeting homeowners actively looking for your specific services."
    },
    {
      icon: <Zap className="w-6 h-6 text-orange-400" />,
      title: "Exclusive Leads Only",
      description: "No more racing 5 other contractors to call a lead. Every lead we generate is 100% exclusive to your company."
    },
    {
      icon: <MessageSquare className="w-6 h-6 text-orange-400" />,
      title: "Automated Follow-ups",
      description: "We implement SMS and email sequences to nurture leads within 5 minutes, drastically increasing your booking rate."
    }
  ];

  return (
    <section id="services" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">The Agency OS for Contractors</h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">Everything you need to scale your construction business, packaged into one proven system.</p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5, borderColor: "rgba(249, 115, 22, 0.3)" }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="glass-panel p-8 rounded-3xl cursor-default"
            >
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6 transition-colors group-hover:bg-orange-500/20"
              >
                {feature.icon}
              </motion.div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-zinc-400 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const BentoGrid = () => (
  <section id="results" className="py-24" aria-labelledby="results-heading">
    <div className="max-w-7xl mx-auto px-6">
      <h2 id="results-heading" className="sr-only">Our Results and Performance</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-[240px]">
        {/* Large Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.02 }}
          viewport={{ once: true, margin: "-100px" }}
          className="md:col-span-2 md:row-span-2 glass-panel rounded-3xl p-8 relative overflow-hidden group cursor-default"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 h-full flex flex-col">
            <h3 className="text-2xl font-bold mb-2">Stop Guessing. Start Scaling.</h3>
            <p className="text-zinc-400 mb-8 max-w-md">We track every penny spent and every dollar earned. Full transparency into your pipeline.</p>
            <div className="mt-auto bg-zinc-950/50 border border-white/10 rounded-2xl p-6 flex items-end gap-4">
              <div className="flex-1">
                <div className="text-sm text-zinc-400 mb-1">Cost Per Lead</div>
                <div className="text-3xl font-bold text-white">$42.50</div>
              </div>
              <div className="flex-1">
                <div className="text-sm text-zinc-400 mb-1">Return on Ad Spend</div>
                <div className="text-3xl font-bold text-orange-400">8.4x</div>
              </div>
              <LineChart className="w-12 h-12 text-zinc-400 mb-1" aria-hidden="true" />
            </div>
          </div>
        </motion.div>

        {/* Small Card 1 */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.02 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ delay: 0.1 }}
          className="md:col-span-2 md:row-span-2 glass-panel rounded-3xl p-8 flex flex-col justify-center cursor-default"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h4 className="font-bold text-2xl">Pre-Qualified Leads</h4>
              <p className="text-zinc-400">We filter out the tire-kickers.</p>
            </div>
          </div>
          <div className="space-y-4">
            {['Homeowner verified', 'Budget > $10k', 'Ready within 30 days', 'Exclusive to you'].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-lg text-zinc-300">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                {item}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

const WhyMetaAds = () => (
  <section className="py-24 bg-zinc-900/30 border-y border-white/5" aria-labelledby="why-meta-heading">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
        >
          <h2 id="why-meta-heading" className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Why Facebook Ads for Construction?</h2>
          <p className="text-xl text-zinc-400 leading-relaxed mb-6">
            In simple terms: <strong className="text-white">You stop waiting and start hunting.</strong>
          </p>
          <p className="text-zinc-400 leading-relaxed">
            Most contractors rely on word-of-mouth or buy shared leads from HomeAdvisor. That means you're waiting for the phone to ring, or fighting 5 other guys for the same job. Meta (Facebook & Instagram) ads put your stunning past projects directly in front of local homeowners <em>before</em> they even search.
          </p>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-6"
        >
          <motion.div 
            whileHover={{ y: -5, borderColor: "rgba(249, 115, 22, 0.3)" }}
            className="glass-panel p-6 rounded-2xl transition-colors cursor-default"
          >
            <h3 className="text-lg font-bold text-white mb-2">1. 100% Exclusive Leads</h3>
            <p className="text-zinc-400">We don't sell the same lead to your competitors. When a homeowner clicks your ad, they only want to talk to YOU.</p>
          </motion.div>
          <motion.div 
            whileHover={{ y: -5, borderColor: "rgba(249, 115, 22, 0.3)" }}
            className="glass-panel p-6 rounded-2xl transition-colors cursor-default"
          >
            <h3 className="text-lg font-bold text-white mb-2">2. Visual Proof Sells</h3>
            <p className="text-zinc-400">Construction is visual. A picture of a stunning kitchen remodel or a new roof sells much better than plain text on Google.</p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  </section>
);

const Process = () => {
  const steps = [
    { num: "01", title: "The Blueprint", desc: "We analyze your best past projects and create irresistible offers targeted at high-income local zip codes." },
    { num: "02", title: "The Build", desc: "We launch visually stunning Facebook & Instagram ads showcasing your work to homeowners most likely to buy." },
    { num: "03", title: "The Handover", desc: "Leads flow in. Our automated system texts them instantly, qualifying them before they hit your calendar." }
  ];

  return (
    <section id="process" className="py-24" aria-labelledby="process-heading">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <h2 id="process-heading" className="text-3xl md:text-5xl font-bold tracking-tight mb-4">How We Work on Meta Ads</h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">A simple, transparent 3-step process to turn local homeowners into booked estimates.</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8" role="list">
          {steps.map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -5, borderColor: "rgba(249, 115, 22, 0.3)" }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: i * 0.1 }}
              className="relative glass-panel p-8 rounded-3xl overflow-hidden group cursor-default"
              role="listitem"
            >
              <motion.div 
                whileHover={{ scale: 1.1, x: 5 }}
                className="text-7xl font-bold text-zinc-800/50 mb-6 font-display group-hover:text-orange-500/20 transition-colors"
                aria-hidden="true"
              >
                {step.num}
              </motion.div>
              <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
              <p className="text-zinc-400">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};


const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: "How long does it take to see results?",
      a: "Typically, we see leads starting to flow within 48-72 hours of launching your campaigns. However, the first 30 days are crucial for 'seasoning' the Meta pixel and optimizing your specific local targeting for the best possible ROI."
    },
    {
      q: "How are these leads different from HomeAdvisor or Angie's List?",
      a: "HomeAdvisor and Angie's List sell the same lead to 5-10 different contractors simultaneously, leading to a race to the bottom on price. Our leads are 100% exclusive to you—generated through your own brand's ads. When they click, they only want to talk to YOU."
    },
    {
      q: "Do I need a massive ad budget to start?",
      a: "Not at all. We recommend starting with a modest daily budget ($30-$50) to test which offers and images resonate most with your local market. Once we find the 'winning' combination, we scale the budget based on your capacity to handle new jobs."
    },
    {
      q: "What if I don't have professional photos of my work?",
      a: "High-quality photos are great, but 'authentic' smartphone photos often perform better on Meta because they look like real posts from a local business. We provide guidance on how to take the best 'before and after' shots that stop the scroll."
    },
    {
      q: "Do you handle the actual ad creation and copywriting?",
      a: "Yes, we handle everything. From the technical setup and pixel tracking to the creative design, professional copywriting, and automated lead-nurturing sequences. You just focus on closing the estimates."
    }
  ];

  return (
    <section id="faq" className="py-24 bg-zinc-900/20">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Frequently Asked Questions</h2>
          <p className="text-zinc-400">Everything you need to know about scaling with Meta Ads.</p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel rounded-2xl overflow-hidden border border-white/5"
            >
              <button 
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-inset"
                aria-expanded={openIndex === i}
                aria-controls={`faq-answer-${i}`}
              >
                <span className="text-lg font-semibold pr-8">{faq.q}</span>
                <motion.div
                  animate={{ rotate: openIndex === i ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  aria-hidden="true"
                >
                  <ChevronDown className="w-5 h-5 text-orange-500" />
                </motion.div>
              </button>
              
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    id={`faq-answer-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    role="region"
                    aria-labelledby={`faq-question-${i}`}
                  >
                    <div className="px-6 pb-6 text-zinc-400 leading-relaxed border-t border-white/5 pt-4">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Quote = () => (
  <section className="py-32 relative overflow-hidden flex items-center justify-center bg-zinc-950">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.05)_0%,transparent_70%)]" />
    <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-100px" }}
      >
        <h2 className="text-3xl md:text-5xl font-display font-medium leading-tight mb-8 text-zinc-300">
          "Don't be afraid to give up the good to go for the <span className="text-white font-bold italic">great</span>."
        </h2>
        <p className="text-lg text-orange-500 font-semibold tracking-widest uppercase">— John D. Rockefeller</p>
      </motion.div>
    </div>
  </section>
);

const CTA = ({ onBookCall }: { onBookCall: () => void }) => (
  <section className="py-24 relative overflow-hidden">
    <div className="absolute inset-0 bg-orange-500/10" />
    <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Ready to dominate your local market?</h2>
        <p className="text-xl text-zinc-300 mb-10">Stop losing jobs to competitors with inferior work but better marketing. Let's build your pipeline.</p>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBookCall} 
          className="bg-white text-zinc-950 hover:bg-zinc-200 px-8 py-4 rounded-full text-lg font-bold transition-all flex items-center justify-center gap-2 mx-auto shadow-xl"
        >
          Book Your Strategy Session <ChevronRight className="w-5 h-5" />
        </motion.button>
        <p className="mt-4 text-sm text-zinc-400">No commitment. Just a clear roadmap to scale.</p>
      </motion.div>
    </div>
  </section>
);

const Footer = () => (
  <motion.footer 
    initial={{ opacity: 0 }}
    whileInView={{ opacity: 1 }}
    viewport={{ once: true }}
    transition={{ duration: 0.8 }}
    className="border-t border-white/10 py-12 bg-zinc-950"
    aria-label="Site Footer"
  >
    <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex items-center gap-2">
        <HardHat className="w-6 h-6 text-orange-500" aria-hidden="true" />
        <span className="font-display font-bold text-xl">BuildScale</span>
      </div>
      <div className="text-sm text-zinc-500 text-center">
        © {new Date().getFullYear()} BuildScale Agency. Founded by Abhiram Sai. All rights reserved.
      </div>
      <div className="flex gap-6 text-sm text-zinc-400">
        <a href="#contact" className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950 rounded px-1 -mx-1">Contact Us</a>
        <a href="#" className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950 rounded px-1 -mx-1">Privacy Policy</a>
        <a href="#" className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-950 rounded px-1 -mx-1">Terms of Service</a>
      </div>
    </div>
  </motion.footer>
);

const Testimonials = () => {
  const testimonials = [
    {
      name: "Gary Vance",
      role: "Vance & Sons Roofing (Denver, CO)",
      content: "I was skeptical about 'Meta Ads' at first, but BuildScale proved me wrong. We've gone from 2 leads a week to 15+ high-quality roofing inquiries. My crew is booked out for the next 4 months straight.",
      rating: 4.7,
      image: "https://images.unsplash.com/photo-1544168190-79c17527004f?q=80&w=200&h=200&auto=format&fit=crop"
    },
    {
      name: "Maria Ortiz",
      role: "Ortiz Custom Remodeling (Phoenix, AZ)",
      content: "The best part isn't just the leads—it's the quality. These aren't people looking for the cheapest price; they're homeowners who value our work. We just closed a $45k kitchen remodel from an ad.",
      rating: 4.0,
      image: "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?q=80&w=200&h=200&auto=format&fit=crop"
    },
    {
      name: "Eli Kaspi",
      role: "CEO, Pure Builders Inc. (Los Angeles, CA)",
      content: "BuildScale's Meta campaigns have been a massive driver for our design-build projects. We're seeing high-intent homeowners who are ready for full-scale renovations. It's the most consistent lead source we've ever used.",
      rating: 4.8,
      image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200&h=200&auto=format&fit=crop"
    },
    {
      name: "Sarah Jenkins",
      role: "Jenkins Interior Design (Austin, TX)",
      content: "BuildScale understands the visual side of construction. They turned my project photos into ads that actually stop the scroll. We've landed three full-home renovations this quarter alone.",
      rating: 5.0,
      image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=200&h=200&auto=format&fit=crop"
    }
  ];

  return (
    <section id="testimonials" className="py-24 bg-zinc-950" aria-labelledby="testimonials-heading">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 id="testimonials-heading" className="text-3xl md:text-5xl font-bold tracking-tight mb-4">What Our Clients Say</h2>
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-orange-500 text-orange-500" />
              ))}
            </div>
            <span className="text-xl font-bold text-white">4.9/5</span>
            <div className="h-4 w-px bg-zinc-800 mx-2" />
            <div className="flex items-center gap-2 text-zinc-400">
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              <span className="text-sm font-medium">Verified Google Reviews</span>
            </div>
          </div>
          <p className="text-zinc-400 max-w-2xl mx-auto">Real results from real construction business owners who scaled their revenue with BuildScale.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-2xl border border-white/5 hover:border-orange-500/30 transition-all group relative"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, starIndex) => (
                      <Star 
                        key={starIndex} 
                        className={`w-4 h-4 ${starIndex < Math.floor(t.rating) ? 'fill-orange-500 text-orange-500' : 'text-zinc-700'}`} 
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-orange-500">{t.rating.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter opacity-60">
                  <img src="https://www.google.com/favicon.ico" className="w-3 h-3 grayscale" alt="" />
                  Google
                </div>
              </div>
              <p className="text-zinc-300 mb-6 italic">"{t.content}"</p>
              <div className="flex items-center gap-3">
                <img 
                  src={t.image} 
                  alt={t.name} 
                  className="w-10 h-10 rounded-full object-cover border border-white/10"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1">
                    {t.name}
                    <ShieldCheck className="w-3 h-3 text-blue-400" aria-label="Verified Client" />
                  </div>
                  <div className="text-xs text-zinc-500">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const LiveResults = () => {
  const [results, setResults] = useState([
    { city: "Dallas, TX", service: "Roofing", lead: "New Lead Generated", time: "2 mins ago" },
    { city: "Miami, FL", service: "Remodeling", lead: "Appointment Booked", time: "5 mins ago" },
    { city: "Chicago, IL", service: "HVAC", lead: "New Lead Generated", time: "12 mins ago" },
    { city: "Phoenix, AZ", service: "Masonry", lead: "New Lead Generated", time: "15 mins ago" },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      const cities = ["New York, NY", "Los Angeles, CA", "Houston, TX", "Atlanta, GA", "Seattle, WA"];
      const services = ["Roofing", "Remodeling", "HVAC", "Masonry", "Decking"];
      const leads = ["New Lead Generated", "Appointment Booked"];
      
      const newResult = {
        city: cities[Math.floor(Math.random() * cities.length)],
        service: services[Math.floor(Math.random() * services.length)],
        lead: leads[Math.floor(Math.random() * leads.length)],
        time: "Just now"
      };

      setResults(prev => [newResult, ...prev.slice(0, 3)]);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-6 left-6 z-40 hidden lg:block" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {results.slice(0, 1).map((result) => (
          <motion.div
            key={result.city + result.service + result.time}
            initial={{ opacity: 0, x: -50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -50, scale: 0.9 }}
            className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[300px]"
          >
            <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
              <Zap className="w-5 h-5 text-orange-500 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">Live Result</div>
              <div className="text-sm font-bold text-white">{result.lead}</div>
              <div className="text-xs text-zinc-400">{result.service} in {result.city} • {result.time}</div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

const TrustLogos = () => {
  const logos = [
    { name: "BBB Accredited", color: "text-blue-500", icon: <CheckCircle2 className="w-5 h-5" aria-hidden="true" /> },
    { name: "Google Partner", color: "text-white", icon: <Target className="w-5 h-5 text-red-500" aria-hidden="true" /> },
    { name: "Clutch 5.0 Rating", color: "text-orange-500", icon: <Zap className="w-5 h-5" aria-hidden="true" /> }
  ];

  return (
    <section className="py-12 border-y border-white/5 bg-zinc-900/20" aria-label="Trust and Accreditations">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-50 hover:opacity-100 transition-opacity duration-500">
          {logos.map((logo, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 grayscale hover:grayscale-0 transition-all cursor-default"
            >
              <div className={`p-2 rounded-lg bg-white/5 border border-white/10 ${logo.color}`}>
                {logo.icon}
              </div>
              <span className="font-display font-bold text-sm tracking-widest uppercase text-zinc-400">{logo.name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const ClientLogos = () => {
  const clients = [
    "Elite Roofing", "Apex Remodeling", "Summit Builders", "Precision HVAC", 
    "Modern Kitchens", "Heritage Homes", "Coastal Decking", "Urban Masonry"
  ];

  return (
    <section className="py-16 overflow-hidden bg-zinc-950" aria-label="Our Clients">
      <div className="max-w-7xl mx-auto px-6 mb-8">
        <p className="text-center text-sm font-bold tracking-[0.2em] uppercase text-zinc-500">Trusted by industry leaders</p>
      </div>
      <div className="relative flex overflow-x-hidden" aria-hidden="true">
        <div className="animate-marquee whitespace-nowrap flex items-center gap-12 md:gap-24 py-4">
          {clients.concat(clients).map((client, i) => (
            <span key={i} className="text-2xl md:text-4xl font-display font-black text-zinc-800 hover:text-orange-500/40 transition-colors cursor-default">
              {client}
            </span>
          ))}
        </div>
      </div>
      <div className="sr-only">
        Our clients include: {clients.join(", ")}
      </div>
    </section>
  );
};

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 selection:bg-orange-500/30">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-orange-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to content
      </a>
      <Navbar onBookCall={() => setIsModalOpen(true)} />
      <main id="main-content">
        <Hero onBookCall={() => setIsModalOpen(true)} />
        <TrustLogos />
        <ClientLogos />
        <Features />
        <WhyMetaAds />
        <BentoGrid />
        <Testimonials />
        <Process />
        <FAQ />
        <Quote />
        <CTA onBookCall={() => setIsModalOpen(true)} />
      </main>
      <Footer />
      <LiveResults />
      <BookingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
