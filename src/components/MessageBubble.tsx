import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '../types/social';
import { formatDateTime, formatTime } from '../utils/format';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

export default function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  // Subscribes to language changes so the timestamp re-localizes.
  useTranslation();
  const isToday = new Date(message.createdAt).toDateString() === new Date().toDateString();
  const time = isToday ? formatTime(message.createdAt) : formatDateTime(message.createdAt);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`min-w-0 max-w-[85%] rounded-2xl sm:max-w-[75%] px-3.5 py-2 text-sm ${
          isOwn
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted text-foreground'
        }`}
      >
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
        <time dateTime={message.createdAt} className={`mt-1 block text-[10px] ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {time}
        </time>
      </div>
    </div>
  );
}
