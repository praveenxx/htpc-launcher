import { useEffect, useRef } from "react";

export type GamepadAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "back"
  | "menu"
  | "refresh";

const INITIAL_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 150;
const AXIS_THRESHOLD = 0.4;

// Standard gamepad button indices (Xbox/DualSense layout)
const BTN = {
  A: 0,
  B: 1,
  Y: 3, // Triangle on DualSense
  START: 9,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
} as const;

const BTN_ACTION: Record<number, GamepadAction> = {
  [BTN.A]: "confirm",
  [BTN.B]: "back",
  [BTN.Y]: "refresh",
  [BTN.START]: "menu",
  [BTN.DPAD_UP]: "up",
  [BTN.DPAD_DOWN]: "down",
  [BTN.DPAD_LEFT]: "left",
  [BTN.DPAD_RIGHT]: "right",
};

interface ButtonTrack {
  pressed: boolean;
  nextFireAt: number;
}

type Direction = "up" | "down" | "left" | "right";

interface AxisTrack {
  active: Direction | null;
  nextFireAt: number;
}

// Set to true to log every button press to the console for mapping diagnosis.
const DEBUG_GAMEPAD = false;

export function useGamepad(onAction: (action: GamepadAction) => void): void {
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  useEffect(() => {
    let rafId: number;
    const btnTrack = new Map<number, ButtonTrack>();
    const axisTrack: AxisTrack = { active: null, nextFireAt: 0 };
    // Separate raw-index tracker used only for debug logging
    const debugTrack = new Map<number, boolean>();

    const fire = (action: GamepadAction) => onActionRef.current(action);

    const getTrack = (idx: number): ButtonTrack => {
      if (!btnTrack.has(idx)) btnTrack.set(idx, { pressed: false, nextFireAt: 0 });
      return btnTrack.get(idx)!;
    };

    const poll = (now: number) => {
      const gp = Array.from(navigator.getGamepads()).find((g) => g !== null) ?? null;

      if (gp) {
        // Debug: log every button on its rising edge so we can identify indices
        if (DEBUG_GAMEPAD) {
          const mapped = BTN_ACTION;
          for (let i = 0; i < gp.buttons.length; i++) {
            const isPressed = gp.buttons[i]?.pressed ?? false;
            const wasPressed = debugTrack.get(i) ?? false;
            if (isPressed && !wasPressed) {
              const action = mapped[i] ?? "(unmapped)";
              console.log(`[gamepad] btn ${i} pressed  →  action: ${action}`);
            }
            debugTrack.set(i, isPressed);
          }
        }

        // Digital buttons
        for (const [idxStr, action] of Object.entries(BTN_ACTION)) {
          const idx = Number(idxStr);
          const track = getTrack(idx);
          const isPressed = gp.buttons[idx]?.pressed ?? false;

          if (isPressed) {
            if (!track.pressed) {
              fire(action);
              track.pressed = true;
              track.nextFireAt = now + INITIAL_DELAY_MS;
            } else if (now >= track.nextFireAt) {
              fire(action);
              track.nextFireAt = now + REPEAT_INTERVAL_MS;
            }
          } else {
            track.pressed = false;
            track.nextFireAt = 0;
          }
        }

        // Left analog stick — axes 0 (X) and 1 (Y)
        const ax = gp.axes[0] ?? 0;
        const ay = gp.axes[1] ?? 0;

        let axisDir: Direction | null = null;
        if (Math.abs(ay) > Math.abs(ax)) {
          if (ay < -AXIS_THRESHOLD) axisDir = "up";
          else if (ay > AXIS_THRESHOLD) axisDir = "down";
        } else {
          if (ax < -AXIS_THRESHOLD) axisDir = "left";
          else if (ax > AXIS_THRESHOLD) axisDir = "right";
        }

        if (axisDir !== axisTrack.active) {
          axisTrack.active = axisDir;
          if (axisDir) {
            fire(axisDir);
            axisTrack.nextFireAt = now + INITIAL_DELAY_MS;
          }
        } else if (axisDir && now >= axisTrack.nextFireAt) {
          fire(axisDir);
          axisTrack.nextFireAt = now + REPEAT_INTERVAL_MS;
        }
      } else {
        btnTrack.clear();
        axisTrack.active = null;
      }

      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, []);
}
