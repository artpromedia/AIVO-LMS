import React, { useState } from "react";
import "./_group.css";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle2, 
  KeyRound, 
  Mail, 
  ShieldCheck, 
  UserCircle2 
} from "lucide-react";

export function Auth() {
  const [activeTab, setActiveTab] = useState<"email" | "pin">("email");
  const [pin, setPin] = useState("");

  const handlePinClick = (num: string) => {
    if (pin.length < 4) setPin(pin + num);
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <div className="trusted-theme min-h-screen flex bg-[hsl(var(--accent))] selection:bg-[hsl(var(--ring)/0.3)]">
      {/* Left Panel: Value Proposition & Illustration */}
      <div className="hidden lg:flex w-1/2 bg-[hsl(var(--primary))] text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[hsl(var(--ring))] opacity-10 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-400 opacity-10 rounded-full blur-[80px] -translate-x-1/2 translate-y-1/2"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white mb-16">
            <div className="w-8 h-8 rounded bg-white text-[hsl(var(--primary))] flex items-center justify-center font-bold font-serif text-xl tracking-tighter">A</div>
            <span className="font-bold text-xl tracking-tight">AIVO</span>
          </div>

          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">
              Welcome back to <span className="text-[hsl(var(--ring))]">AIVO</span>
            </h1>
            <p className="text-lg text-[hsl(var(--accent))]/80 leading-relaxed">
              Log in to see your child's latest progress, review IEP goals, or start a new learning adventure.
            </p>
          </div>
        </div>

        {/* Floating image and quote */}
        <div className="relative z-10 mt-12 flex-1 flex flex-col justify-end">
          <div className="relative mx-auto w-full max-w-[400px]">
            <img 
              src="/images/aivo-trusted/auth-learner.png" 
              alt="Learner" 
              className="w-full h-auto drop-shadow-2xl relative z-10"
            />
            
            {/* Quote Card */}
            <div className="absolute -right-8 bottom-12 bg-white text-[hsl(var(--primary))] p-4 rounded-xl shadow-xl z-20 w-64 border border-[hsl(var(--border))]">
              <p className="text-sm font-medium leading-snug mb-2">"AIVO has completely transformed how we approach homework. No more tears!"</p>
              <p className="text-xs font-bold text-[hsl(var(--muted-foreground))]">— David K., Parent</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 mt-12 pt-8 border-t border-white/10">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-[hsl(var(--ring))]" />
            <span className="text-sm font-medium">10,000+ Families</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[hsl(var(--ring))]" />
            <span className="text-sm font-medium">COPPA Compliant</span>
          </div>
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-[hsl(var(--border))] relative z-10">
          
          <div className="lg:hidden flex items-center gap-2 text-[hsl(var(--primary))] mb-8 justify-center">
            <div className="w-8 h-8 rounded bg-[hsl(var(--primary))] text-white flex items-center justify-center font-bold font-serif text-xl tracking-tighter">A</div>
            <span className="font-bold text-xl tracking-tight">AIVO</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--primary))] text-center mb-8">
            Sign in to your account
          </h2>

          {/* Tabs */}
          <div className="flex p-1 bg-[hsl(var(--accent))] rounded-xl mb-8">
            <button 
              onClick={() => setActiveTab("email")}
              className={`flex-1 py-3 px-4 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'email' ? 'bg-white text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]'}`}
            >
              <Mail size={16} /> Parent / Educator
            </button>
            <button 
              onClick={() => setActiveTab("pin")}
              className={`flex-1 py-3 px-4 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'pin' ? 'bg-white text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]'}`}
            >
              <KeyRound size={16} /> Learner PIN
            </button>
          </div>

          {activeTab === "email" ? (
            <form className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-[hsl(var(--primary))] mb-2">Email Address</label>
                <input 
                  type="email" 
                  placeholder="name@example.com" 
                  className="w-full px-4 py-3 rounded-xl border border-[hsl(var(--border))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-[hsl(var(--primary))]">Password</label>
                  <a href="#" className="text-xs font-bold text-[hsl(var(--ring))] hover:text-[hsl(var(--ring-hover))]">Forgot password?</a>
                </div>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full px-4 py-3 rounded-xl border border-[hsl(var(--border))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent transition-all"
                />
              </div>
              <Button className="w-full py-6 mt-4 text-base font-bold bg-[hsl(var(--ring))] hover:bg-[hsl(var(--ring-hover))] text-white rounded-xl shadow-md">
                Sign In
              </Button>
              <div className="text-center mt-6 text-sm text-[hsl(var(--muted-foreground))]">
                Don't have an account? <a href="#" className="font-bold text-[hsl(var(--ring))] hover:text-[hsl(var(--ring-hover))]">Create account</a>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Profile Selection */}
              <div className="text-center">
                <label className="block text-sm font-bold text-[hsl(var(--primary))] mb-4">Who is learning today?</label>
                <div className="flex justify-center gap-4 mb-6">
                  <div className="flex flex-col items-center gap-2 cursor-pointer">
                    <div className="w-16 h-16 rounded-full border-4 border-[hsl(var(--ring))] bg-[hsl(var(--accent))] flex items-center justify-center overflow-hidden">
                      <img src="/images/aivo-trusted/hero-learner.png" alt="Profile" className="w-full h-full object-cover scale-150 translate-y-2" />
                    </div>
                    <span className="text-sm font-bold text-[hsl(var(--primary))]">Leo</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 cursor-pointer opacity-50 hover:opacity-100 transition-opacity">
                    <div className="w-16 h-16 rounded-full border-2 border-transparent bg-[hsl(var(--accent))] flex items-center justify-center">
                      <UserCircle2 size={32} className="text-[hsl(var(--muted-foreground))]" />
                    </div>
                    <span className="text-sm font-bold text-[hsl(var(--muted-foreground))]">Maya</span>
                  </div>
                </div>
              </div>

              {/* PIN Display */}
              <div className="flex justify-center gap-3 mb-6">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`w-12 h-14 rounded-xl flex items-center justify-center text-2xl font-bold border-2 ${pin.length > i ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent))] border-transparent text-transparent'}`}>
                    {pin.length > i ? "•" : ""}
                  </div>
                ))}
              </div>

              {/* PIN Pad */}
              <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button 
                    key={num}
                    onClick={() => handlePinClick(num.toString())}
                    className="aspect-square rounded-2xl bg-[hsl(var(--accent))] hover:bg-[hsl(var(--border))] text-[hsl(var(--primary))] font-bold text-2xl flex items-center justify-center transition-colors"
                  >
                    {num}
                  </button>
                ))}
                <div className="col-span-1"></div>
                <button 
                  onClick={() => handlePinClick("0")}
                  className="aspect-square rounded-2xl bg-[hsl(var(--accent))] hover:bg-[hsl(var(--border))] text-[hsl(var(--primary))] font-bold text-2xl flex items-center justify-center transition-colors"
                >
                  0
                </button>
                <button 
                  onClick={handleBackspace}
                  className="aspect-square rounded-2xl bg-[hsl(var(--accent))] hover:bg-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] font-bold flex items-center justify-center transition-colors"
                >
                  ⌫
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
