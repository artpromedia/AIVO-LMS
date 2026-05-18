"use client";
import React from "react";

export interface TabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  hideLabel?: boolean;
}

export interface TabsRailProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  iconsOnly?: boolean;
  className?: string;
}

export function TabsRail({
  tabs,
  activeTab,
  onTabChange,
  iconsOnly = false,
  className = "",
}: TabsRailProps) {
  return (
    <div
      className={`flex items-center justify-center gap-1 bg-white/80 backdrop-blur rounded-2xl p-1.5 border border-slate-100 shadow-sm ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`
              inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-heading font-bold text-sm
              transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-purple-400 focus-visible:ring-offset-1
              ${
                isActive
                  ? "bg-purple-100 text-purple-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }
            `}
            style={{
              minHeight: "var(--learner-hit-target, 40px)",
              transitionDuration: "var(--learner-motion-ms, 200ms)",
            }}
          >
            <span aria-hidden={!iconsOnly && !tab.hideLabel ? "true" : undefined}>{tab.icon}</span>
            {iconsOnly || tab.hideLabel ? (
              <span className="sr-only">{tab.label}</span>
            ) : (
              <span>{tab.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
