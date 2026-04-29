'use client';

import { useState, useRef, useEffect } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Send, 
  Bot, 
  User, 
  Trash2, 
  Sparkles, 
  MessageCircle,
  ArrowDownCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { THAI_UI_LABELS } from '@/lib/constants/thai-labels';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function renderInlineFormatting(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);

  return segments.map((segment, index) => {
    const isBold = segment.startsWith('**') && segment.endsWith('**');
    if (!isBold) {
      return <span key={`${segment}-${index}`}>{segment}</span>;
    }

    return (
      <strong key={`${segment}-${index}`} className="font-semibold text-gray-900">
        {segment.slice(2, -2)}
      </strong>
    );
  });
}

function MessageContent({ content }: { content: string }) {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        const lines = block
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length === 0) return null;

        const numberedLines = lines.filter((line) => /^\d+[\.\)]\s+/.test(line));
        const bulletLines = lines.filter((line) => /^[-*•]\s+/.test(line));

        if (numberedLines.length === lines.length) {
          return (
            <ol key={`ol-${blockIndex}`} className="space-y-2 pl-5 list-decimal marker:font-semibold marker:text-blue-600">
              {lines.map((line, lineIndex) => (
                <li key={`ol-item-${blockIndex}-${lineIndex}`} className="pl-1">
                  {renderInlineFormatting(line.replace(/^\d+[\.\)]\s+/, ''))}
                </li>
              ))}
            </ol>
          );
        }

        if (bulletLines.length === lines.length) {
          return (
            <ul key={`ul-${blockIndex}`} className="space-y-2 pl-5 list-disc marker:text-blue-500">
              {lines.map((line, lineIndex) => (
                <li key={`ul-item-${blockIndex}-${lineIndex}`} className="pl-1">
                  {renderInlineFormatting(line.replace(/^[-*•]\s+/, ''))}
                </li>
              ))}
            </ul>
          );
        }

        if (lines.length > 1) {
          return (
            <div key={`mixed-${blockIndex}`} className="space-y-2">
              {lines.map((line, lineIndex) => (
                <p key={`mixed-line-${blockIndex}-${lineIndex}`} className="leading-7 text-gray-700">
                  {renderInlineFormatting(line)}
                </p>
              ))}
            </div>
          );
        }

        const singleLine = lines[0];
        const isHeading = singleLine.length <= 80 && /[:：]$/.test(singleLine);

        return isHeading ? (
          <h4 key={`heading-${blockIndex}`} className="text-sm font-semibold text-gray-900">
            {renderInlineFormatting(singleLine)}
          </h4>
        ) : (
          <p key={`p-${blockIndex}`} className="leading-7 text-gray-700">
            {renderInlineFormatting(singleLine)}
          </p>
        );
      })}
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: 'สวัสดีครับ! ผมเป็น AI ผู้ช่วยส่วนตัวของคุณ มีอะไรให้ผมช่วยแนะนำหรือช่วยเขียน Content ในวันนี้ไหมครับ?' 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      setMessages([...newMessages, { role: 'assistant', content: data.content }]);
    } catch (error: any) {
      console.error('Chat error:', error);
      toast.error('ขออภัยครับ เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (confirm('คุณต้องการล้างประวัติการแชททั้งหมดใช่หรือไม่?')) {
      setMessages([{ 
        role: 'assistant', 
        content: 'สวัสดีครับ! เริ่มบทสนทนาใหม่ได้เลยครับ' 
      }]);
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('คัดลอกคำตอบแล้ว');
    } catch (error) {
      console.error('Copy error:', error);
      toast.error('ไม่สามารถคัดลอกข้อความได้');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-5xl mx-auto">
      <PageHeader 
        title="AI Chat Assistant" 
        description="ถาม-ตอบ และช่วยวางแผน Content แบบอัจฉริยะ"
        actions={
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearChat}
            className="text-gray-500 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            ล้างแชท
          </Button>
        }
      />

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col mb-6 overflow-hidden border-none shadow-2xl bg-white/80 backdrop-blur-xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500"></div>
        
        {/* Messages Container */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth custom-scrollbar"
        >
          {messages.map((message, index) => (
            <div 
              key={index}
              className={cn(
                "flex w-full items-start gap-3 transition-all animate-in fade-in slide-in-from-bottom-2",
                message.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              {/* Avatar */}
              <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md",
                message.role === 'assistant' 
                  ? "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white" 
                  : "bg-gray-200 text-gray-600 border border-white"
              )}>
                {message.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
              </div>

              {/* Message Bubble */}
              <div className={cn(
                "max-w-[80%] rounded-3xl px-5 py-4 text-sm leading-relaxed shadow-sm",
                message.role === 'assistant' 
                  ? "bg-white border border-blue-50 text-gray-800 rounded-tl-none" 
                  : "bg-blue-600 text-white rounded-tr-none"
              )}>
                {message.role === 'assistant' ? (
                  <MessageContent content={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap leading-7 text-white">{message.content}</p>
                )}
                {message.role === 'assistant' && index === messages.length - 1 && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleCopy(message.content)}
                      className="h-6 px-2 text-[10px] text-blue-500 hover:bg-blue-50 bg-blue-50/30"
                    >
                      <Sparkles className="h-3 w-3 mr-1" /> คัดลอก
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex w-full items-start gap-3 animate-pulse">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              </div>
              <div className="bg-blue-50 text-gray-500 rounded-2xl rounded-tl-none px-4 py-2 text-sm italic">
                AI กำลังประมวลผลคำตอบ...
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t bg-gray-50/50 backdrop-blur-md">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2 max-w-4xl mx-auto items-center"
          >
            <div className="relative flex-1 group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur opacity-20 group-focus-within:opacity-40 transition duration-300"></div>
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="พิมพ์ข้อความของคุณที่นี่..."
                disabled={isLoading}
                className="relative bg-white border-none rounded-full h-12 px-6 pr-12 focus-visible:ring-2 focus-visible:ring-blue-500 shadow-sm"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-blue-200 transition-all active:scale-95 flex-shrink-0"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </form>
          <p className="text-[10px] text-center text-gray-400 mt-2">
            AI อาจให้ข้อมูลที่ไม่ถูกต้อง โปรดตรวจสอบข้อมูลที่สำคัญก่อนนำไปใช้งาน
          </p>
        </div>
      </Card>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
