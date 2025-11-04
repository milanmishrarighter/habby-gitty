"use client";

import React from 'react';

interface EmojiPickerProps {
  selectedEmoji: string;
  onSelectEmoji: (emoji: string) => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ selectedEmoji, onSelectEmoji }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Limit to a single character.
    onSelectEmoji(e.target.value);
  };

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <input
        type="text"
        id="emoji-input"
        className="w-full flex justify-center items-center py-3 px-4 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-3xl text-center"
        placeholder="😊" // Now a placeholder
        value={selectedEmoji}
        onChange={handleChange}
        maxLength={1} // Enforce single character
      />
      <p className="text-xs text-gray-500 mt-1">Type or use your keyboard's emoji picker (single character).</p>
    </div>
  );
};

export default EmojiPicker;