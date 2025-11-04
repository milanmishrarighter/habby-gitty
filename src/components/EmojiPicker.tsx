"use client";

import React from 'react';

interface EmojiPickerProps {
  selectedEmoji: string;
  onSelectEmoji: (emoji: string) => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ selectedEmoji, onSelectEmoji }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Limit to a single emoji or a short string if desired, but for now, allow any text.
    // If you want to enforce a single emoji, more complex regex might be needed.
    onSelectEmoji(e.target.value);
  };

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <input
        type="text"
        id="emoji-input"
        className="w-full flex justify-center items-center py-3 px-4 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-3xl text-center"
        placeholder="😊"
        value={selectedEmoji}
        onChange={handleChange}
        maxLength={5} // Limit input length to keep it concise for a mood emoji
      />
      <p className="text-xs text-gray-500 mt-1">Type or use your keyboard's emoji picker.</p>
    </div>
  );
};

export default EmojiPicker;