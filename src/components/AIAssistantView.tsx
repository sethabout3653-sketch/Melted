import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  User, 
  RefreshCw, 
  BookOpen, 
  Calculator, 
  Globe, 
  Lightbulb, 
  Copy, 
  Check, 
  Cpu,
  Search, 
  Sparkles, 
  ExternalLink,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { entryVariants, containerVariants, hoverTransition, slideInVariants } from '../utils/animations';

export interface ThinkingStep {
  id: string;
  title: string;
  detail: string;
  icon: string;
  timestamp: number;
  query?: string;
  sources?: MessageSource[];
}

export interface MessageSource {
  title: string;
  url: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  sources?: MessageSource[];
  steps?: ThinkingStep[];
}


const QUICK_PROMPTS = [
  { icon: Calculator, label: 'Math Formula', prompt: 'What is the quadratic formula about?' },
  { icon: BookOpen, label: 'Science Concept', prompt: 'What is photosynthesis about?' },
  { icon: Globe, label: 'Live Web Info', prompt: 'Who won the Super Bowl in 2025?' },
  { icon: Lightbulb, label: 'History Overview', prompt: 'What was the American Revolution about?' },
];

function cleanShortAnswer(text: string): string {
  if (!text) return '';
  const cleaned = text
    .replace(/(?:\r?\n)+(?:Would you like|Do you want|Let me know|Hope this helps|Feel free to|Should I|If you want|If you'd like|Can I help|Do you need)[\s\S]*$/i, '')
    .trim();
  return cleaned || text.trim();
}

function preprocessLaTeX(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, equation) => `\n$$\n${equation.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, equation) => `$${equation.trim()}$`);
}

const SYSTEM_INSTRUCTION =
  "You are FrostHub AI. Keep all answers short, direct, and concise (1 to 3 sentences maximum). For overview questions like 'what is ___ about' or 'what is the ___ all about', give a clear high-level answer with just a little tiny bit of explanation. Never give unsolicited multi-step lecture breakdowns, long essays, or repetitive summary lists. State formulas or facts directly. USE PROFESSIONAL LATEX FOR ALL MATH FORMULAS. CRITICAL: Use $...$ for inline math and $$...$$ for block math. ALWAYS use \\dfrac for fractions to make them clear and vertically stacked. NEVER include any follow-up questions or offers such as 'Would you like...', 'Do you want...', 'Let me know', 'Can I help with...', etc. NONE of that. Answer and stop.";

export const AIAssistantView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: "Ask me anything. I provide direct, concise answers with live web search.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeSteps, setActiveSteps] = useState<ThinkingStep[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedStepsMap, setExpandedStepsMap] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const assistantScrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);

  const getActiveGroqKey = (): string => {
    return (
      (import.meta.env.VITE_GROQ_API_KEY as string) ||
      (import.meta.env.GROQ_API_KEY as string) ||
      (typeof process !== 'undefined' && process.env?.GROQ_API_KEY ? process.env.GROQ_API_KEY : '') ||
      ((window as any).GROQ_API_KEY as string) ||
      ''
    ).replace(/^["']|["']$/g, '').trim();
  };

  const scrollToBottom = () => {
    const container = assistantScrollRef.current;
    if (!container) return;
    const threshold = 200;
    const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + threshold;
    const lastMsg = messages[messages.length - 1];
    const isFromMe = lastMsg?.sender === 'user';
    if (isNearBottom || isFromMe || isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, activeSteps]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleNewSession = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    requestIdRef.current += 1;
    setIsLoading(false);
    setActiveSteps([]);
    setMessages([
      {
        id: 'welcome-1',
        sender: 'ai',
        text: "Ask me anything. I provide direct, concise answers with live web search.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const callDirectGroq = async (promptText: string, msgHistory: any[], signal?: AbortSignal): Promise<string> => {
    const rawGroqKey = getActiveGroqKey();
    if (!rawGroqKey) return '';
    const groqMessages = [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      ...msgHistory.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
      { role: 'user', content: promptText },
    ];
    const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    for (const model of groqModels) {
      if (signal?.aborted) return '';
      try {
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), 8000);
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${rawGroqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: groqMessages,
            temperature: 0.3,
            max_tokens: 220,
          }),
          signal: timeoutController.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) return cleanShortAnswer(text);
        }
      } catch (mErr: any) {
        if (mErr?.name === 'AbortError' || signal?.aborted) return '';
      }
    }
    if (signal?.aborted) return '';
    throw new Error("API error. Please check your key.");
  };

  const toggleStepExpansion = (msgId: string) => {
    setExpandedStepsMap((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend || isLoading) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const currentRequestId = ++requestIdRef.current;
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setIsLoading(true);
    setActiveSteps([]);
    const history = messages.filter((m) => m.id !== 'welcome-1').map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      text: m.text,
    }));
    const activeGroqKey = getActiveGroqKey();
    let replyText = '';
    let messageSources: MessageSource[] = [];
    let completedSteps: ThinkingStep[] = [];
    try {
      const res = await fetch('/api/ai/assistant/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          history,
          groqApiKey: activeGroqKey,
          model: 'openai/gpt-oss-20b',
          searchMode: 'auto',
        }),
        signal: abortController.signal,
      });
      if (abortController.signal.aborted || currentRequestId !== requestIdRef.current) return;
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (abortController.signal.aborted || currentRequestId !== requestIdRef.current) {
            reader.cancel();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              try {
                const event = JSON.parse(trimmed.slice(5).trim());
                if (event.type === 'step') {
                  const newStep: ThinkingStep = {
                    id: event.id || Date.now().toString(),
                    title: event.title || 'Processing',
                    detail: event.detail || '',
                    icon: event.icon || 'sparkles',
                    timestamp: event.timestamp || Date.now(),
                    query: event.query,
                    sources: event.sources,
                  };
                  completedSteps.push(newStep);
                  setActiveSteps((prev) => {
                    const filtered = prev.filter((s) => s.id !== newStep.id);
                    return [...filtered, newStep];
                  });
                } else if (event.type === 'done') {
                  replyText = event.reply || '';
                  messageSources = event.sources || [];
                  if (event.steps && Array.isArray(event.steps)) {
                    completedSteps = event.steps;
                  }
                }
              } catch {}
            }
          }
        }
      }
    } catch (streamErr: any) {
      if (streamErr?.name === 'AbortError' || abortController.signal.aborted || currentRequestId !== requestIdRef.current) return;
    }
    if (abortController.signal.aborted || currentRequestId !== requestIdRef.current) return;
    if (!replyText) {
      try {
        const standardRes = await fetch('/api/ai/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: textToSend,
            history,
            groqApiKey: activeGroqKey,
            model: 'openai/gpt-oss-20b',
            searchMode: 'auto',
          }),
          signal: abortController.signal,
        });
        if (standardRes.ok) {
          const data = await standardRes.json();
          if (data.success && data.reply) {
            replyText = data.reply;
            messageSources = data.sources || [];
            completedSteps = data.steps || completedSteps;
          }
        }
      } catch (jsonErr: any) {
        if (jsonErr?.name === 'AbortError' || abortController.signal.aborted || currentRequestId !== requestIdRef.current) return;
      }
    }
    if (!replyText && activeGroqKey) {
      try {
        replyText = await callDirectGroq(textToSend, history, abortController.signal);
      } catch (clientErr: any) {
        if (clientErr?.name === 'AbortError' || abortController.signal.aborted || currentRequestId !== requestIdRef.current) return;
      }
    }
    if (abortController.signal.aborted || currentRequestId !== requestIdRef.current) return;
    if (!replyText) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: "I'm currently unable to retrieve a response.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setIsLoading(false);
      setActiveSteps([]);
      return;
    }
    const cleaned = cleanShortAnswer(replyText);
    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: cleaned,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sources: messageSources.length > 0 ? messageSources : undefined,
      steps: completedSteps.length > 0 ? completedSteps : undefined,
    };
    setMessages((prev) => [...prev, aiMsg]);
    setIsLoading(false);
    setActiveSteps([]);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const latestStep = activeSteps[activeSteps.length - 1];

  return (
    <div className="w-full h-[calc(100dvh-5rem)] md:h-[calc(100vh-5.5rem)] px-4 sm:px-8 py-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-4 flex flex-col font-sans overflow-hidden">
      <div className="mb-4 flex items-center justify-end shrink-0">
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleNewSession}
          style={{ backgroundColor: 'var(--brand-blue)' }}
          className="px-5 py-2.5 rounded-2xl text-white hover:opacity-95 transition-all cursor-pointer text-xs font-bold flex items-center gap-2.5 shadow-lg glow-subtle-blue shrink-0"
          title="Reset conversation"
        >
          <RefreshCw className="w-4 h-4" />
          <span>New Session</span>
        </motion.button>
      </div>

      <motion.div 
        ref={assistantScrollRef}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-2 custom-scrollbar pb-6 w-full"
      >
        <AnimatePresence mode="popLayout">
          {messages.map((msg, idx) => (
            <motion.div
              key={msg.id}
              variants={entryVariants}
              initial="hidden"
              animate="visible"
              custom={idx}
              className={`flex gap-3 w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div 
                  style={{ backgroundColor: 'var(--brand-blue)' }}
                  className="w-10 h-10 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-lg glow-subtle-blue"
                >
                  <Bot className="w-6 h-6" />
                </div>
              )}

              <div 
                style={msg.sender === 'user' ? { backgroundColor: 'var(--brand-blue)' } : {}}
                className={`group relative rounded-[2rem] p-6 text-[15px] leading-relaxed max-w-[85%] sm:max-w-[75%] ${
                  msg.sender === 'user'
                    ? 'text-white rounded-tr-md shadow-xl'
                    : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-tl-md border border-slate-100 dark:border-slate-800 shadow-md'
                }`}
              >
                {msg.sender === 'ai' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none font-[family-name:var(--app-font-family)] prose-p:leading-relaxed prose-pre:bg-slate-50 dark:prose-pre:bg-slate-800/50 prose-pre:border prose-pre:border-slate-100 dark:prose-pre:border-slate-700/50 [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex]:text-[1.1em]">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {preprocessLaTeX(msg.text)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap font-[family-name:var(--app-font-family)]">{msg.text}</div>
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mr-1">
                      <Globe className="w-3.5 h-3.5 text-[var(--brand-blue)]" />
                      Verified Sources
                    </span>
                    {msg.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-all border border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 shadow-sm"
                        title={src.url}
                      >
                        <span className="max-w-[130px] sm:max-w-[180px] truncate">{src.title}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                      </a>
                    ))}
                  </div>
                )}

                {msg.steps && msg.steps.length > 0 && (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => toggleStepExpansion(msg.id)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedStepsMap[msg.id] ? 'rotate-90' : ''}`} />
                      <span>
                        {expandedStepsMap[msg.id] ? 'Hide thinking' : `View ${msg.steps.length} reasoning steps`}
                      </span>
                    </button>

                    {expandedStepsMap[msg.id] && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-1.5 py-1"
                      >
                        {msg.steps.map((st, sIdx) => (
                          <div key={sIdx} className="text-[11px] flex items-start gap-2 text-slate-600 dark:text-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-100">{st.title}: </span>
                              <span className="text-slate-500 dark:text-slate-400">{st.detail}</span>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                )}

                <div className={`mt-2 flex items-center justify-between text-[10px] ${
                  msg.sender === 'user' ? 'text-white/80' : 'text-slate-400'
                }`}>
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'ai' && (
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-[var(--brand-blue)] flex items-center gap-1 cursor-pointer ml-3"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="w-9 h-9 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <User className="w-5 h-5" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="flex gap-3 w-full"
          >
            <div 
              style={{ backgroundColor: 'var(--brand-blue)' }}
              className="w-10 h-10 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-lg glow-subtle-blue"
            >
              <Bot className="w-6 h-6" />
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl rounded-tl-sm p-4 shadow-md max-w-[90%] sm:max-w-[70%] space-y-3">
              {latestStep ? (
                <div className="flex items-center gap-3">
                  <div 
                    style={{ backgroundColor: 'color-mix(in srgb, var(--brand-blue) 15%, transparent)' }}
                    className="w-8 h-8 rounded-xl text-[var(--brand-blue)] flex items-center justify-center shrink-0"
                  >
                    {latestStep.icon === 'search' ? <Search className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 animate-spin" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{latestStep.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{latestStep.detail}</div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-1 items-center px-2 py-1">
                  <div className="w-1.5 h-1.5 rounded-sm bg-cyan-400 opacity-60" />
                  <div className="w-1.5 h-1.5 rounded-sm bg-cyan-400 opacity-60" />
                  <div className="w-1.5 h-1.5 rounded-sm bg-cyan-400 opacity-60" />
                </div>
              )}
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </motion.div>

      {messages.length <= 2 && !isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 shrink-0 w-full">
          {QUICK_PROMPTS.map((qp, idx) => {
            const Icon = qp.icon;
            return (
              <motion.button
                key={idx}
                variants={slideInVariants}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => handleSend(qp.prompt)}
                className="p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl text-left transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
              >
                <Icon style={{ color: 'var(--brand-blue)' }} className="w-4 h-4 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">{qp.label}</span>
              </motion.button>
            );
          })}
        </div>
      )}

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
          className="flex-1 bg-transparent px-3 py-3 text-base md:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none resize-none"
        />
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          style={{ backgroundColor: 'var(--brand-blue)' }}
          className="px-5 py-3 rounded-xl disabled:opacity-40 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </motion.button>
      </div>
    </div>
  );
};

