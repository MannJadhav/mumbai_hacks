import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, X, MessageSquare, Sparkles } from "lucide-react";

interface InputBarProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  selectedNodeCount: number;
  onClearSelection: () => void;
}

const InputBar: React.FC<InputBarProps> = ({
  onSend,
  isLoading,
  selectedNodeCount,
  onClearSelection,
}) => {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent, overrideMsg?: string) => {
    e?.preventDefault();
    const msg = overrideMsg || input.trim();
    if (msg && !isLoading) {
      onSend(msg);
      if (!overrideMsg) setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"; 
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };


  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  return (
    <div className="absolute bottom-6 left-0 right-0 px-4 md:px-0 flex flex-col items-center justify-end z-50 pointer-events-none gap-2">
      
      {selectedNodeCount > 0 && (
        <div className="pointer-events-auto flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-300">
      
          <div className="flex gap-2">
            <button
              onClick={() => handleSubmit(undefined, "Summarize these nodes")}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-md hover:bg-blue-700 transition-colors flex items-center gap-1"
              disabled={isLoading}
            >
              <Sparkles size={12} /> Summarize
            </button>
            <button
              onClick={() =>
                handleSubmit(undefined, "How are these concepts connected?")
              }
              className="bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-3 py-1.5 rounded-full text-xs font-medium shadow-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
              disabled={isLoading}
            >
              Connect
            </button>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900/90 dark:bg-zinc-100/90 text-zinc-100 dark:text-zinc-900 px-3 py-1.5 rounded-full text-xs font-medium shadow-md backdrop-blur-md">
            <MessageSquare size={12} />
            <span>Using {selectedNodeCount} nodes as context</span>
            <button
              onClick={onClearSelection}
              className="hover:text-zinc-400 dark:hover:text-zinc-500 ml-1"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl pointer-events-auto">
        <form
          onSubmit={(e) => handleSubmit(e)}
          className={`
             relative group bg-white dark:bg-zinc-900 border rounded-2xl shadow-xl transition-all focus-within:border-zinc-400 dark:focus-within:border-zinc-500
             ${
               selectedNodeCount > 0
                 ? "border-blue-400 dark:border-blue-500 ring-1 ring-blue-500/20"
                 : "border-zinc-200 dark:border-zinc-700"
             }
          `}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedNodeCount > 0
                ? "Ask about selected nodes..."
                : "Ask a question to start the graph..."
            }
            className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 px-6 py-4 pr-16 rounded-2xl resize-none outline-none max-h-40 overflow-y-auto"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-3 bottom-3 p-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Send size={20} />
            )}
          </button>
        </form>
        <div className="text-center mt-2 opacity-50 text-[10px] text-zinc-500 uppercase tracking-widest">
          Powered by Gemini 2.5 Flash
        </div>
      </div>
    </div>
  );
};

export default InputBar;
