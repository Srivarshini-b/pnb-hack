import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Loader2, Bot, User, ChevronDown } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'model', parts: [{ text: "Hello! I am your QScan Security Intel engine. You can ask me about your scan results, PQC readiness, or general cryptographic security. How can I help you today?" }] }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || loading) return;

    const userMsg = message;
    setMessage('');
    
    // Add user message to history
    const updatedHistory = [...chatHistory, { role: 'user', parts: [{ text: userMsg }] }];
    setChatHistory(updatedHistory);
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/chat`, {
        message: userMsg,
        chatHistory: updatedHistory.slice(-6) // Keep only recent context
      });

      setChatHistory([...updatedHistory, { role: 'model', parts: [{ text: res.data.text }] }]);
    } catch (err) {
      console.error("Chat error:", err);
      setChatHistory([...updatedHistory, { role: 'model', parts: [{ text: "I'm sorry, I'm having trouble connecting to the Security Intel engine right now. Please ensure the backend is running on port 5001 and your network is connected." }] }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-[350px] sm:w-[400px] h-[500px] bg-panel border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="bg-primary/10 px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                <Bot size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-textMain">QScan Secure Intel</h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                  <span className="text-[10px] text-textMuted uppercase tracking-wider">Internal Expert System</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-textMuted hover:text-danger transition-colors p-1"
            >
              <ChevronDown size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {chatHistory.map((chat, i) => (
              <div key={i} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[85%] ${chat.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${chat.role === 'user' ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'}`}>
                    {chat.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                  </div>
                  <div className={`rounded-2xl px-3 py-2 text-sm ${
                    chat.role === 'user' 
                      ? 'bg-secondary/10 text-textMain rounded-tr-none border border-secondary/20' 
                      : 'bg-background/50 text-textMain rounded-tl-none border border-border shadow-sm'
                  }`}>
                    {chat.parts[0].text}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-background/50 border border-border rounded-2xl rounded-tl-none px-3 py-2 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  <span className="text-xs text-textMuted italic">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-3 border-t border-border bg-panel/50">
            <div className="relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask me anything..."
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 pr-12 text-sm text-textMain focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-textMuted/50"
              />
              <button
                type="submit"
                disabled={!message.trim() || loading}
                className={`absolute right-1.5 top-1.5 p-1.5 rounded-lg transition-all ${
                  !message.trim() || loading 
                    ? 'text-textMuted opacity-50' 
                    : 'bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20'
                }`}
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-xl shadow-primary/30 hover:scale-110 active:scale-95 transition-all duration-300 group relative"
        >
          <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20"></div>
          <MessageSquare className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default Chatbot;
