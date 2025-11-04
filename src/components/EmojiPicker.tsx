"use client";

import React from 'react';

interface EmojiPickerProps {
  selectedEmoji: string;
  onSelectEmoji: (emoji: string) => void;
}

// Helper function to check if a character is an emoji
const isEmoji = (char: string): boolean => {
  // Using Unicode property escape for Emoji.
  // The 'u' flag is essential for Unicode regex to correctly interpret Unicode characters.
  // This is the most robust way to detect emojis in modern JavaScript environments.
  // It covers various emoji categories, including skin tones and zero-width joiner sequences.
  // For a single character input, it will primarily check single emoji characters.
  return /\p{Emoji}/u.test(char);
};

const EmojiPicker: React.FC<EmojiPickerProps> = ({ selectedEmoji, onSelectEmoji }) => {
  const [isFocused, setIsFocused] = React.useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (inputValue === "") {
      // Allow clearing the input
      onSelectEmoji("");
    } else if (inputValue.length === 1) {
      // Check if the single character is an emoji
      if (isEmoji(inputValue)) {
        onSelectEmoji(inputValue);
      }
      // If it's not an emoji, do nothing. The input field will retain its previous valid emoji or remain empty.
    }
    // If inputValue.length > 1, it's already prevented by maxLength={1}
    // so we don't need to handle it explicitly here.
  };

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <input
        type="text"
        id="emoji-input"
        className="w-full flex justify-center items-center py-3 px-4 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-3xl text-center"
        placeholder={isFocused ? "" : "😊"}
        value={selectedEmoji}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        maxLength={1} // Enforce single character
      />
      <p className="text-xs text-gray-500 mt-1">Type or use your keyboard's emoji picker (single character).</p>
    </div>
  );
};

export default EmojiPicker;