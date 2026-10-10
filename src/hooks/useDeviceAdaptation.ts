import { useState, useEffect, useCallback, useRef } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'console' | 'desktop';

export interface DeviceAdaptationInfo {
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isConsole: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  orientation: 'portrait' | 'landscape';
  hasGamepad: boolean;
  gamepadName: string | null;
}

interface GamepadCallbacks {
  onTabToggle?: () => void;
  onClose?: () => void;
  onSearch?: () => void;
  onSurprise?: () => void;
}

export function useDeviceAdaptation(callbacks?: GamepadCallbacks): DeviceAdaptationInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceAdaptationInfo>(() => detectDevice());
  const [hasGamepad, setHasGamepad] = useState(false);
  const [gamepadName, setGamepadName] = useState<string | null>(null);

  const prevButtonsRef = useRef<boolean[]>([]);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  function detectDevice(): DeviceAdaptationInfo {
    if (typeof window === 'undefined') {
      return {
        deviceType: 'desktop',
        isMobile: false,
        isTablet: false,
        isConsole: false,
        isDesktop: true,
        isTouch: false,
        orientation: 'landscape',
        hasGamepad: false,
        gamepadName: null,
      };
    }

    const ua = navigator.userAgent || '';
    const width = window.innerWidth;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';

    // Console detection via UA
    const isConsoleUA = /Xbox|PlayStation|Nintendo|Smart-TV|Tizen|Web0S|OUYA/i.test(ua);

    let deviceType: DeviceType = 'desktop';
    if (isConsoleUA) {
      deviceType = 'console';
    } else if (width < 768 || (/Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) && width < 1024)) {
      deviceType = 'mobile';
    } else if (width >= 768 && width < 1024) {
      deviceType = 'tablet';
    } else {
      deviceType = 'desktop';
    }

    return {
      deviceType,
      isMobile: deviceType === 'mobile',
      isTablet: deviceType === 'tablet',
      isConsole: deviceType === 'console',
      isDesktop: deviceType === 'desktop',
      isTouch,
      orientation,
      hasGamepad: false,
      gamepadName: null,
    };
  }

  // Update on window resize and orientation change
  useEffect(() => {
    const handleResize = () => {
      setDeviceInfo((prev) => {
        const detected = detectDevice();
        return {
          ...detected,
          hasGamepad: prev.hasGamepad,
          gamepadName: prev.gamepadName,
          // Retain console mode if a gamepad is actively connected
          deviceType: prev.hasGamepad ? 'console' : detected.deviceType,
          isConsole: prev.hasGamepad || detected.isConsole,
        };
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // HTML5 Gamepad API Detection and Polling for Console & Controller Players
  useEffect(() => {
    let animId: number;

    const onGamepadConnected = (e: GamepadEvent) => {
      console.log(`🎮 Gamepad connected: ${e.gamepad.id}`);
      setHasGamepad(true);
      setGamepadName(e.gamepad.id);
      setDeviceInfo((prev) => ({
        ...prev,
        hasGamepad: true,
        gamepadName: e.gamepad.id,
        isConsole: true,
      }));
    };

    const onGamepadDisconnected = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const anyActive = Array.from(gamepads).some((g) => g && g.connected);
      setHasGamepad(anyActive);
      setGamepadName(anyActive ? gamepads[0]?.id || null : null);
      setDeviceInfo((prev) => ({
        ...prev,
        hasGamepad: anyActive,
        gamepadName: anyActive ? gamepads[0]?.id || null : null,
      }));
    };

    window.addEventListener('gamepadconnected', onGamepadConnected);
    window.addEventListener('gamepaddisconnected', onGamepadDisconnected);

    // Initial check for already connected gamepads
    if (navigator.getGamepads) {
      const initialGamepads = navigator.getGamepads();
      const firstActive = Array.from(initialGamepads).find((g) => g && g.connected);
      if (firstActive) {
        setHasGamepad(true);
        setGamepadName(firstActive.id);
        setDeviceInfo((prev) => ({
          ...prev,
          hasGamepad: true,
          gamepadName: firstActive.id,
          isConsole: true,
        }));
      }
    }

    // Polling loop for gamepad button presses
    const pollGamepad = () => {
      if (navigator.getGamepads) {
        const gamepads = navigator.getGamepads();
        const gp = Array.from(gamepads).find((g) => g && g.connected);

        if (gp) {
          const currentButtons = gp.buttons.map((b) => b.pressed);
          const prevButtons = prevButtonsRef.current;

          // Standard Controller Mapping:
          // Button 0 = A / Cross
          // Button 1 = B / Circle (Back / Close)
          // Button 2 = X / Square (Search)
          // Button 3 = Y / Triangle (Surprise / Random Game)
          // Button 4 = LB / L1 (Previous tab)
          // Button 5 = RB / R1 (Next tab)

          // LB or RB pressed -> Toggle between Games and Chat
          if ((currentButtons[4] && !prevButtons[4]) || (currentButtons[5] && !prevButtons[5])) {
            callbacksRef.current?.onTabToggle?.();
          }

          // B / Circle pressed -> Close modal or active game
          if (currentButtons[1] && !prevButtons[1]) {
            callbacksRef.current?.onClose?.();
          }

          // X / Square pressed -> Focus search
          if (currentButtons[2] && !prevButtons[2]) {
            callbacksRef.current?.onSearch?.();
          }

          // Y / Triangle pressed -> Surprise random game
          if (currentButtons[3] && !prevButtons[3]) {
            callbacksRef.current?.onSurprise?.();
          }

          prevButtonsRef.current = currentButtons;
        }
      }

      animId = requestAnimationFrame(pollGamepad);
    };

    animId = requestAnimationFrame(pollGamepad);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('gamepadconnected', onGamepadConnected);
      window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
    };
  }, []);

  return {
    ...deviceInfo,
    hasGamepad,
    gamepadName,
  };
}
