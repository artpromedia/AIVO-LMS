import React, { useState } from "react";
import "./_group.css";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Heart, ShieldCheck, Check, Info } from "lucide-react";

export function Auth() {
  const [pin, setPin] = useState("");

  const handlePinClick = (num: string) => {
    if (pin.length < 4) setPin((prev) => prev + num);
  };

  const handlePinDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] flex items-center justify-center p-4 lg:p-8 font-['DM_Sans']">
      <div className="max-w-4xl w-full flex bg-white/60 backdrop-blur-sm rounded-3xl shadow-sm border border-[hsl(var(--border))] overflow-hidden">
        {/* Left side: Value proposition & Illustration */}
        <div className="hidden lg:flex lg:w-5/12 bg-[hsl(var(--primary)/0.2)] p-12 flex-col justify-between items-center text-center">
          <div className="space-y-4">
            <h2 className="text-2xl font-medium tracking-tight text-[hsl(var(--foreground))]">
              A quiet space for growing minds
            </h2>
            <p className="text-[hsl(var(--muted-foreground))]">
              Take your time. There are no timers, loud alarms, or flashing popups here.
            </p>
          </div>

          <img
            src="/__mockup/images/aivo-calm/tutors.png"
            alt="Soft illustration of friendly AI tutors"
            className="w-full max-w-[240px] rounded-2xl opacity-90 object-cover"
          />

          <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] bg-white/50 px-4 py-2 rounded-full">
            <ShieldCheck className="w-4 h-4 text-[hsl(var(--primary))]" />
            <span>FERPA & COPPA Compliant</span>
          </div>
        </div>

        {/* Right side: Auth forms */}
        <div className="flex-1 p-8 sm:p-12 lg:p-16 flex flex-col items-center">
          <div className="w-full max-w-[360px] mx-auto space-y-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-medium tracking-tight">AIVO</span>
              </div>
              <h1 className="text-3xl font-medium">Welcome back</h1>
              <p className="text-[hsl(var(--muted-foreground))]">
                Sign in as a parent, educator, or learner.
              </p>
            </div>

            <Tabs defaultValue="parent" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-14 bg-[hsl(var(--secondary))] p-1 rounded-2xl mb-8">
                <TabsTrigger
                  value="parent"
                  className="rounded-xl text-base data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  Parent / Teacher
                </TabsTrigger>
                <TabsTrigger
                  value="learner"
                  className="rounded-xl text-base data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  Learner
                </TabsTrigger>
              </TabsList>

              <TabsContent value="parent" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium pl-1 text-[hsl(var(--muted-foreground))]">
                      Email Address
                    </label>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      className="h-14 rounded-2xl border-[hsl(var(--border))] bg-white focus-visible:ring-[hsl(var(--primary))] focus-visible:border-[hsl(var(--primary))] text-base px-4"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium pl-1 text-[hsl(var(--muted-foreground))]">
                      Password
                    </label>
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      className="h-14 rounded-2xl border-[hsl(var(--border))] bg-white focus-visible:ring-[hsl(var(--primary))] focus-visible:border-[hsl(var(--primary))] text-base px-4"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="w-5 h-5 rounded border border-[hsl(var(--border))] bg-white flex items-center justify-center group-hover:border-[hsl(var(--primary))] transition-colors">
                      <Check className="w-3 h-3 text-transparent" />
                    </div>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">Remember me</span>
                  </label>
                  <a
                    href="#"
                    className="text-sm text-[hsl(var(--primary))] font-medium hover:underline underline-offset-4"
                  >
                    Need help?
                  </a>
                </div>

                <Button className="w-full h-14 text-lg rounded-2xl bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-[hsl(var(--primary-foreground))] shadow-none transition-colors">
                  Sign In
                </Button>

                <div className="text-center pt-2">
                  <span className="text-[hsl(var(--muted-foreground))]">New to AIVO? </span>
                  <a
                    href="#"
                    className="text-[hsl(var(--primary))] font-medium hover:underline underline-offset-4"
                  >
                    Create an account
                  </a>
                </div>
              </TabsContent>

              <TabsContent value="learner" className="space-y-8 mt-0 flex flex-col items-center">
                {/* Avatar Selection */}
                <div className="text-center space-y-4 w-full">
                  <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                    Tap your picture
                  </p>
                  <div className="flex justify-center gap-6">
                    <button className="w-24 h-24 rounded-3xl bg-white border-2 border-[hsl(var(--primary))] p-2 shadow-sm transform transition-transform active:scale-95">
                      <img
                        src="/__mockup/images/aivo-calm/avatar-bear.png"
                        alt="Bear Avatar"
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    </button>
                    <button className="w-24 h-24 rounded-3xl bg-[hsl(var(--secondary))] border-2 border-transparent p-2 transform transition-transform active:scale-95 opacity-60 hover:opacity-100">
                      <img
                        src="/__mockup/images/aivo-calm/avatar-owl.png"
                        alt="Owl Avatar"
                        className="w-full h-full object-cover rounded-2xl"
                      />
                    </button>
                  </div>
                </div>

                {/* PIN Entry */}
                <div className="w-full space-y-6">
                  <div className="flex justify-center gap-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl transition-colors ${pin.length > i ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))] text-white" : "bg-white border-[hsl(var(--border))] text-transparent"}`}
                      >
                        •
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button
                        key={num}
                        onClick={() => handlePinClick(num.toString())}
                        className="h-16 text-2xl font-medium rounded-2xl bg-white border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] hover:border-[hsl(var(--primary)/0.3)] transition-colors active:scale-95"
                      >
                        {num}
                      </button>
                    ))}
                    <div className="h-16"></div>
                    <button
                      onClick={() => handlePinClick("0")}
                      className="h-16 text-2xl font-medium rounded-2xl bg-white border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] hover:border-[hsl(var(--primary)/0.3)] transition-colors active:scale-95"
                    >
                      0
                    </button>
                    <button
                      onClick={handlePinDelete}
                      className="h-16 flex items-center justify-center text-lg text-[hsl(var(--muted-foreground))] rounded-2xl hover:bg-[hsl(var(--secondary))] transition-colors active:scale-95"
                    >
                      Del
                    </button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Mobile trust badge */}
          <div className="mt-8 lg:hidden flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] bg-white/50 px-4 py-2 rounded-full">
            <ShieldCheck className="w-4 h-4 text-[hsl(var(--primary))]" />
            <span>FERPA & COPPA Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
}
