import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface DeviceAdaptationInfo {
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isConsole: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  orientation: 'portrait' | 'landscape';
}

export function useDeviceAdaptation(): DeviceAdaptationInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceAdaptationInfo>(() => detectDevice());

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
      };
    }

    const ua = navigator.userAgent || '';
    const isMobileOs = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isDesktopOs =
      /Windows NT|Macintosh|Mac OS X|CrOS|Linux x86_64|Linux i686/i.test(ua) && !isMobileOs;
    const hasFinePointer =
      typeof window.matchMedia === 'function' && window.matchMedia('(any-pointer: fine)').matches;
    const isCoarseOnly =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches &&
      !hasFinePointer;
    const width = window.innerWidth;
    const isTouch = !isDesktopOs && (isMobileOs || isCoarseOnly || 'ontouchstart' in window || navigator.maxTouchPoints > 0);
    const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';

    let deviceType: DeviceType = 'desktop';
    if (!isDesktopOs && (width < 768 || ((isMobileOs || isCoarseOnly) && width < 1024))) {
      deviceType = 'mobile';
    } else if (!isDesktopOs && width >= 768 && width < 1024) {
      deviceType = 'tablet';
    } else if (isDesktopOs && width < 640) {
      deviceType = 'tablet';
    } else {
      deviceType = 'desktop';
    }

    return {
      deviceType,
      isMobile: deviceType === 'mobile',
      isTablet: deviceType === 'tablet',
      isConsole: false,
      isDesktop: deviceType === 'desktop',
      isTouch,
      orientation,
    };
  }

  useEffect(() => {
    const handleResize = () => {
      const next = detectDevice();
      setDeviceInfo((prev) =>
        prev.deviceType === next.deviceType &&
        prev.orientation === next.orientation &&
        prev.isTouch === next.isTouch
          ? prev
          : next
      );
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return deviceInfo;
}
