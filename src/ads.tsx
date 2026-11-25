// AdMob wrapper — returns no-op functions in Expo Go, loads native implementation in dev/production builds
import React from 'react';

type AdsModule = {
  initAds: () => Promise<void>;
  maybeShowInterstitial: (every?: number) => Promise<void>;
  Banner: React.FC;
};

// No-op implementations for Expo Go
const noopAds: AdsModule = {
  initAds: async () => {},
  maybeShowInterstitial: async () => {},
  Banner: () => null,
};

// Check if native GoogleMobileAds module exists
const hasNativeAds = typeof global !== 'undefined' && !!global.NativeModules?.GoogleMobileAds;

let _adsPromise: Promise<AdsModule> | null = null;

async function loadNativeAds(): Promise<AdsModule> {
  if (!hasNativeAds) return noopAds;

  if (!_adsPromise) {
    _adsPromise = (async () => {
      try {
        // Dynamic import with variable path — Metro cannot statically analyze this
        const nativePath = './ads.native';
        const module = await import(nativePath);
        return {
          initAds: module.initAds,
          maybeShowInterstitial: module.maybeShowInterstitial,
          Banner: module.Banner,
        };
      } catch {
        return noopAds;
      }
    })();
  }
  return _adsPromise;
}

let _adsModule: AdsModule | null = null;

export async function getAdsModule(): Promise<AdsModule> {
  if (_adsModule) return _adsModule;
  _adsModule = await loadNativeAds();
  return _adsModule;
}

// Exported functions that delegate to the loaded module
export async function initAds() {
  const mod = await getAdsModule();
  return mod.initAds();
}

export async function maybeShowInterstitial(every = 3) {
  const mod = await getAdsModule();
  return mod.maybeShowInterstitial(every);
}

export function Banner() {
  const [mod, setMod] = React.useState<AdsModule | null>(null);

  React.useEffect(() => {
    getAdsModule().then(setMod);
  }, []);

  if (!mod) return null;
  return <mod.Banner />;
}