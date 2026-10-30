import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, RefreshCw, BookOpen, Calculator, PenTool, Lightbulb, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  { icon: BookOpen, label: 'Science Concept', prompt: 'Explain the process of photosynthesis and cellular respiration in clear, simple terms.' },
  { icon: Calculator, label: 'Math Problem', prompt: 'How do I solve quadratic equations using the quadratic formula? Provide a step-by-step example.' },
  { icon: PenTool, label: 'Essay Outline', prompt: 'Create a detailed outline for a persuasive essay about environmental conservation.' },
  { icon: Lightbulb, label: 'Practice Quiz', prompt: 'Generate 5 multiple-choice practice quiz questions about the American Revolution with answers.' },
];

export const AIAssistantView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: "Hello! What can I help you with today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Direct Groq API completion for static Vercel deployments
  const callGroqDirect = async (promptText: string, msgHistory: any[]) => {
    const systemInstruction = "You are Frosted AI, an intelligent, helpful, warm, concise, and clear study assistant and academic tutor. You assist students with study questions, homework, concept explanations, math problem steps, essay outlines, and practice quizzes. Give direct, insightful, concise, well-structured, and helpful answers using markdown formatting. Never use robotic disclaimers or canned phrases like 'As an AI language model...'. Answer in a friendly, conversational, human tone.";

    const rawGroqKey = (
      (import.meta.env.VITE_GROQ_API_KEY as string) ||
      (import.meta.env.VITE_GEMINI_API_KEY as string) ||
      ((window as any).GROQ_API_KEY as string) ||
      ''
    ).replace(/^["']|["']$/g, '').trim();

    if (!rawGroqKey) {
      throw new Error("Missing VITE_GROQ_API_KEY in Vercel environment variables. Please add VITE_GROQ_API_KEY to Vercel.");
    }

    const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemInstruction },
    ];

    if (Array.isArray(msgHistory) && msgHistory.length > 0) {
      for (const msg of msgHistory) {
        if (msg.role && msg.text) {
          groqMessages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text,
          });
        }
      }
    }

    groqMessages.push({ role: 'user', content: promptText });

    const groqModels = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'llama3-70b-8192',
      'llama3-8b-8192',
      'mixtral-8x7b-32768',
      'gemma2-9b-it'
    ];

    for (const model of groqModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${rawGroqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: groqMessages,
            temperature: 0.7,
            max_tokens: 1024,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) return text;
        }
      } catch (err) {
        console.warn(`Direct Groq call model ${model} failed:`, err);
      }
    }

    throw new Error("Groq API rate limit or model error. Please check your Groq API key.");
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setIsLoading(true);

    const history = messages
      .filter((m) => m.id !== 'welcome-1')
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text,
      }));

    let replyText = '';

    try {
      // 1. Try server endpoint /api/ai/assistant first
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToSend, history }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.reply) {
          replyText = data.reply;
        }
      }
    } catch (serverErr) {
      console.warn('Server endpoint /api/ai/assistant unreachable, trying direct Groq client API...', serverErr);
    }

    // 2. Direct client fallback for Vercel static deployments
    if (!replyText) {
      try {
        replyText = await callGroqDirect(textToSend, history);
      } catch (clientErr: any) {
        console.error('Direct Groq fallback error:', clientErr);
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: clientErr?.message || "Could not connect right now. Please ensure VITE_GROQ_API_KEY is set in Vercel Environment Variables.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setIsLoading(false);
        return;
      }
    }

    if (replyText) {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    }

    setIsLoading(false);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="w-full h-[calc(100vh-5.5rem)] px-4 sm:px-8 py-4 flex flex-col font-sans">
      {/* Minimal Top Header - Only New Session Button */}
      <div className="mb-3 flex justify-end shrink-0">
        <button
          type="button"
          onClick={() => {
            setMessages([
              {
                id: 'welcome-1',
                sender: 'ai',
                text: "Hello! What can I help you with today?",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          }}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/20"
          title="Start New Session"
        >
          <RefreshCw className="w-4 h-4" />
          <span>New Session</span>
        </button>
      </div>

      {/* Messages Scroll Area - Full Width Expansion */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-4 w-full">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {/* AI Avatar */}
            {msg.sender === 'ai' && (
              <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
            )}

            {/* Bubble - Expands Horizontally */}
            <div className={`group relative rounded-3xl p-5 text-sm leading-relaxed max-w-[90%] sm:max-w-[80%] ${
              msg.sender === 'user'
                ? 'bg-blue-600 text-white rounded-tr-sm shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-tl-sm border border-slate-100 dark:border-slate-800 shadow-sm'
            }`}>
              <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

              <div className={`mt-2 flex items-center justify-between text-[10px] ${
                msg.sender === 'user' ? 'text-blue-100' : 'text-slate-400'
              }`}>
                <span>{msg.timestamp}</span>
                {msg.sender === 'ai' && (
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer ml-3"
                    title="Copy response"
                  >
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* User Avatar */}
            {msg.sender === 'user' && (
              <div className="w-9 h-9 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm">
                <User className="w-5 h-5" />
              </div>
            )}
          </motion.div>
        ))}

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl rounded-tl-sm p-4 flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Thinking...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Starter Prompts */}
      {messages.length <= 2 && !isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 shrink-0 w-full">
          {QUICK_PROMPTS.map((qp, idx) => {
            const Icon = qp.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(qp.prompt)}
                className="p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl text-left transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
              >
                <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">{qp.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Input Box - Full Width */}
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xl shadow-slate-200/50 dark:shadow-none flex items-center gap-2 shrink-0">
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask anything..."
          className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none resize-none"
        />
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center gap-2 shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  );
};
