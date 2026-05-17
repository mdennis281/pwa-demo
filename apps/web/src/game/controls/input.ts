/**
 * Shared input store, ref-style so it doesn't trigger React re-renders.
 * Both keyboard and touch sources write to it; Player reads each frame.
 */
export const input = {
  forward: 0, // -1 (back) .. 1 (fwd)
  right: 0,
  jumpPressed: false,
  yaw: 0,
  pitch: -0.35,
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
}
