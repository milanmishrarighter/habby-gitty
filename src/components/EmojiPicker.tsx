"use client";

import React from 'react';
import { emojiData } from '@/utils/emojiData';

interface EmojiPickerProps {
  selectedEmoji: string;
  onSelectEmoji: (emoji: string) => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ selectedEmoji, onSelectEmoji }) => {
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const emojiPickerRef = React.useRef<HTMLDivElement>(null);

  const filteredEmojis = React.useMemo(() => {
    if (!searchTerm) {
      return emojiData;
    }
    const query = searchTerm.toLowerCase();
    return emojiData.filter(emoji =>
      emoji.keywords.some(keyword => keyword.includes(query))
    );
  }, [searchTerm]);

  const handleEmojiClick = (emoji: string) => {
    onSelectEmoji(emoji);
    setIsPickerOpen(false);
  };

  // Close picker when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative w-full max-w-sm mx-auto" ref={emojiPickerRef}>
      <button
        id="emoji-display"
        className="w-full flex justify-center items-center py-3 px-4 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-3xl"
        onClick={() => setIsPickerOpen(prev => !prev)}
      >
        {selectedEmoji}
      </button>

      {isPickerOpen && (
        <div
          id="emoji-picker-grid"
          className="absolute top-full left-0 mt-2 w-full p-4 bg-white border border-gray-300 rounded-lg shadow-xl emoji-grid z-10"
        >
          <input
            type="text"
            id="emoji-search"
            placeholder="Search emojis..."
            className="mb-4 w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div id="emoji-container" className="grid grid-cols-6 gap-2 text-3xl">
            {filteredEmojis.map((emoji) => (
              <span
                key={emoji.char}
                className="cursor-pointer p-2 rounded-lg hover:bg-gray-200 transition-colors duration-100"
                onClick={() => handleEmojiClick(emoji.char)}
              >
                {emoji.char}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmojiPicker;