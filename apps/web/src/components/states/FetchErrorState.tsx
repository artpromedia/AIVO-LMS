"use client";
import { AlertTriangle } from "lucide-react";

interface FetchErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function FetchErrorState({
  title = "Unable to load data",
  message = "Something went wrong. Please try again.",
  onRetry,
}: FetchErrorStateProps) {
  return (
    <div className="bg-white rounded-2xl p-12 text-center border border-red-100" role="alert">
      <div
        className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center"
        aria-hidden="true"
      >
        <AlertTriangle className="w-7 h-7" strokeWidth={2} />
      </div>
      <p className="text-red-600 font-semibold text-lg">{title}</p>
      <p className="text-sm text-slate-500 mt-2">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 px-6 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          Retry
        </button>
      )}
    </div>
  );
}
