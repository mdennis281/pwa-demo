import { useEffect } from 'react';
import { input } from './input';

const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back:    ['KeyS', 'ArrowDown'],
  left:    ['KeyA', 'ArrowLeft'],
  right:   ['KeyD', 'ArrowRight'],
  jump:    ['Space'],
};

export function useKeyboard(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const held = new Set<string>();
    const recompute = () => {
      let f = 0;
      let r = 0;
      for (const k of KEYS.forward) if (held.has(k)) f += 1;
      for (const k of KEYS.back)    if (held.has(k)) f -= 1;
      for (const k of KEYS.right)   if (held.has(k)) r += 1;
      for (const k of KEYS.left)    if (held.has(k)) r -= 1;
      input.forward = f;
      input.right = r;
    };
    const isInput = (el: EventTarget | null): boolean => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
    };
    const onDown = (e: KeyboardEvent) => {
      if (isInput(e.target)) return;
      if (KEYS.jump.includes(e.code)) {
        if (!held.has(e.code)) input.jumpPressed = true;
        input.jumpHeld = true;
        held.add(e.code);
        e.preventDefault();
        return;
      }
      held.add(e.code);
      if ([...Object.values(KEYS)].flat().includes(e.code)) e.preventDefault();
      recompute();
    };
    const onUp = (e: KeyboardEvent) => {
      held.delete(e.code);
      if (KEYS.jump.includes(e.code)) input.jumpHeld = false;
      recompute();
    };
    const onBlur = () => {
      held.clear();
      input.jumpHeld = false;
      recompute();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      held.clear();
      recompute();
    };
  }, [active]);
}
