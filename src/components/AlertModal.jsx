import React from 'react';

export default function AlertModal({ isOpen, message, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-lg border border-neutral-300 bg-white p-4 shadow-xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <span className="text-sm font-medium text-neutral-700">Code</span>
          <button 
            onClick={onClose} 
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* Content Body */}
        <div className="py-6 text-sm text-neutral-800">
          {message}
        </div>
        
        {/* Footer Actions */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="min-w-[70px] rounded border border-neutral-300 bg-linear-to-b from-white to-neutral-50 px-4 py-1 text-xs font-medium text-neutral-700 shadow-xs hover:from-neutral-50 hover:to-neutral-100 active:bg-neutral-100 cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}