/**
 * Shared input store, ref-style so it doesn't trigger React re-renders.
 * Both keyboard and touch sources write to it; Player reads each frame.
 */
export const input = {
  forward: 0, // -1 (back) .. 1 (fwd)
  right: 0,
  jumpPressed: false,
  jumpHeld: false,
  /** Shift — used for fly-mode descent */
  descendHeld: false,
  yaw: 0,
  pitch: -0.35,
  /** Third-person follow distance, driven by the mouse wheel. */
  cameraDist: 6.5,
};

export function consumeJump(): boolean {
  if (input.jumpPressed) {
    input.jumpPressed = false;
    return true;
  }
  return false;
}

export function resetInput(): void {
  input.forward = 0;
  input.right = 0;
  input.jumpPressed = false;
  input.jumpHeld = false;
  input.descendHeld = false;
}
