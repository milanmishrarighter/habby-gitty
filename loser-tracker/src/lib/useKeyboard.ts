import React from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

/**
 * Keeps whatever you're typing in above the on-screen keyboard: the page gets
 * bottom padding the height of the keyboard, and the focused field is scrolled
 * into view. Returns the keyboard height (0 when it's closed).
 */
export const useKeyboard = () => {
  const [height, setHeight] = React.useState(0);

  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const show = Keyboard.addListener("keyboardWillShow", info => setHeight(info.keyboardHeight));
    const shown = Keyboard.addListener("keyboardDidShow", () => {
      const field = document.activeElement as HTMLElement | null;
      if (field && field !== document.body) field.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const hide = Keyboard.addListener("keyboardWillHide", () => setHeight(0));
    return () => { [show, shown, hide].forEach(h => h.then(l => l.remove())); };
  }, []);

  return height;
};
