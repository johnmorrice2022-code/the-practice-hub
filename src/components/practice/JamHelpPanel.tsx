import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Send, Loader2, MessageCircle } from 'lucide-react';
import { MarkingFeedback } from './FeedbackCard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface JamHelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  questionText: string;
  studentAnswer: string;
  feedback: MarkingFeedback;
  subject: string;
  tier: string;
  examBoard: string;
}

const MAX_TURNS = 5;

export function JamHelpPanel({
  isOpen,
  onClose,
  questionText,
  studentAnswer,
  feedback,
  subject,
  tier,
  examBoard,
}: JamHelpPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setInput('');
      setTurnCount(0);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, questionText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || turnCount >= MAX_TURNS) return;

    const newUserMessage: Message = { role: 'user', content: trimmed };
    const updatedMessages = [...messages, newUserMessage];

    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    const newTurn = turnCount + 1;
    setTurnCount(newTurn);

    try {
      const { data, error } = await supabase.functions.invoke('jam-help', {
        body: {
          messages: updatedMessages,
          questionText,
          studentAnswer,
          markScheme: feedback.step_breakdown.map((s) => ({
            criterion: s.criterion,
          })),
          marksAwarded: feedback.marks_awarded,
          marksAvailable: feedback.marks_available,
          subject,
          tier,
          examBoard,
          turnNumber: newTurn,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ]);
      setTurnCount((prev) => prev - 1);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const turnsRemaining = MAX_TURNS - turnCount;
  const isExhausted = turnCount >= MAX_TURNS;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'rgba(0,0,0,0.25)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-card border-l border-border transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          width: 'min(420px, 100vw)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <MessageCircle
              size={16}
              style={{ color: 'rgba(255,255,255,0.90)' }}
            />
            <span className="text-sm font-bold" style={{ color: '#fff' }}>
              JAM Help
            </span>
            {!isExhausted && turnCount > 0 && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.20)', color: '#fff' }}
              >
                {turnsRemaining} left
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: 'rgba(255,255,255,0.80)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <div
                className="rounded-xl px-4 py-3 text-sm leading-relaxed"
                style={{
                  background: 'rgba(226,61,40,0.06)',
                  borderLeft: '3px solid #E23D28',
                }}
              >
                <p className="font-semibold text-foreground mb-1">
                  I've seen your answer and the mark scheme.
                </p>
                <p className="text-muted-foreground text-[13px]">
                  What part are you stuck on? Ask me anything about this
                  question.
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground px-1">
                You have {MAX_TURNS} exchanges - make them count!
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                style={
                  msg.role === 'user'
                    ? {
                        background:
                          'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                        color: '#fff',
                      }
                    : {
                        background: 'rgba(0,0,0,0.04)',
                        color: 'var(--foreground)',
                        border: '1px solid rgba(0,0,0,0.06)',
                      }
                }
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div
                className="rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2"
                style={{
                  background: 'rgba(0,0,0,0.04)',
                  border: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <Loader2
                  size={12}
                  className="animate-spin text-muted-foreground"
                />
                <span className="text-xs text-muted-foreground">
                  Thinking...
                </span>
              </div>
            </div>
          )}

          {isExhausted && !loading && (
            <div
              className="rounded-xl px-4 py-3 text-center text-sm"
              style={{
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            >
              <p className="font-semibold text-foreground mb-1">
                That's the end of JAM Help for this question.
              </p>
              <p className="text-muted-foreground text-[13px]">
                Try the next question and come back to this topic in a future
                session.
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {!isExhausted && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-border">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this question..."
                rows={1}
                disabled={loading}
                className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#E23D28] disabled:opacity-50"
                style={{ maxHeight: 120, lineHeight: '1.5' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-30 active:scale-95"
                style={{
                  background:
                    'linear-gradient(135deg, #E23D28 0%, #F5A623 100%)',
                  boxShadow: input.trim()
                    ? '0 2px 8px rgba(226,61,40,0.30)'
                    : 'none',
                }}
              >
                <Send size={13} style={{ color: '#fff' }} />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 px-1">
              Press Enter to send - Shift+Enter for new line
            </p>
          </div>
        )}
      </div>
    </>
  );
}
