"use client";

import React from "react";
import { Badge, Button, Card, ProgressRing } from "./primitives";

export function LessonCard({ title, duration, xp, locked }: { title: string; duration: string; xp: number; locked?: boolean }) {
  return (
    <Card style={{ padding: 20 }}>
      <p style={{ margin: 0, fontWeight: 700 }}>{title}</p>
      <p style={{ margin: "4px 0" }}>{duration}</p>
      <Badge>+{xp} XP</Badge>
      {locked ? <p aria-live="polite">Locked</p> : <Button style={{ marginTop: 12 }}>Start</Button>}
    </Card>
  );
}

export function TopicGrid({ topics }: { topics: Array<{ id: string; title: string }> }) {
  return <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>{topics.map((t) => <Card key={t.id} style={{ padding: 16 }}><strong>{t.title}</strong></Card>)}</div>;
}

export function LearningPath({ nodes }: { nodes: Array<{ id: string; label: string; state: "locked" | "current" | "complete" }> }) {
  return (
    <ol>
      {nodes.map((n) => <li key={n.id}><Badge>{n.state}</Badge> {n.label}</li>)}
    </ol>
  );
}

export function MascotCoach({ message, muted }: { message: string; muted?: boolean }) {
  return <Card style={{ padding: 16 }}><p>{message}</p><Button variant="audio">{muted ? "Unmute" : "Read aloud"}</Button></Card>;
}

export function RewardCelebration({ show, onContinue }: { show: boolean; onContinue: () => void }) {
  if (!show) return null;
  return <Card style={{ padding: 24 }}><h3>🎉 Great job!</h3><Button onClick={onContinue}>Continue</Button></Card>;
}

export function StickerBook({ stickers }: { stickers: Array<{ id: string; label: string; earned: boolean }> }) {
  return <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))" }}>{stickers.map((s) => <Card key={s.id} style={{ padding: 12, opacity: s.earned ? 1 : 0.5 }}>{s.label}</Card>)}</div>;
}

export function AudioControlBar({ volume = 60, speed = 1 }: { volume?: number; speed?: number }) {
  return <Card style={{ padding: 16, display: "flex", gap: 12, alignItems: "center" }}><span>🔊 {volume}%</span><span>⏱ {speed}x</span><Button variant="audio">Voice</Button></Card>;
}

export function AgeModeSwitcher({ mode, onModeChange }: { mode: "sprout" | "spark" | "scholar"; onModeChange: (mode: "sprout" | "spark" | "scholar") => void }) {
  return <div role="group" aria-label="Age mode">{(["sprout", "spark", "scholar"] as const).map((m) => <Button key={m} variant={mode === m ? "primary" : "ghost"} onClick={() => onModeChange(m)}>{m}</Button>)}</div>;
}

export function FocusMode({ progress, children }: { progress: number; children: React.ReactNode }) {
  return <Card style={{ padding: 20 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3 style={{ margin: 0 }}>Focus Mode</h3><ProgressRing value={progress} /></div><div style={{ marginTop: 12 }}>{children}</div></Card>;
}
