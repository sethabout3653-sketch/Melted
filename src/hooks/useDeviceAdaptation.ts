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
    const width = window.innerWidth;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';

    let deviceType: DeviceType = 'desktop';
    if (width < 768 || (/Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) && width < 1024)) {
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
      isConsole: false,
      isDesktop: deviceType === 'desktop',
      isTouch,
      orientation,
    };
  }

  useEffect(() => {
    const handleResize = () => {
      setDeviceInfo(detectDevice());
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

