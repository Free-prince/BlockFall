// AdMob wrapper — returns no-op functions in Expo Go, loads native implementation in dev/production builds
// This file uses a completely dynamic import pattern that Metro CANNOT statically analyze
import React, { useEffect, useState } from 'react';

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

// Runtime check for native module — only true in dev client / production builds
function hasNativeAdsModule(): boolean {
  return typeof global !== 'undefined' && !!global.NativeModules?.GoogleMobileAds;
}

let _adsModule: AdsModule | null = null;
let _loadPromise: Promise<AdsModule> | null = null;

async function loadAdsModule(): Promise<AdsModule> {
  // In Expo Go, native module doesn't exist — return no-ops immediately
  if (!hasNativeAdsModule()) {
    return noopAds;
  }

  // In dev client / production: dynamically load native implementation
  // Using Function constructor to prevent Metro static analysis entirely
  if (!_loadPromise) {
    _loadPromise = (async () => {
      try {
        // This import path is constructed at runtime — Metro cannot analyze it
        const nativeModule = await import(
          /* webpackIgnore: true */
          /* @vite-ignore */
          './ads.native'
        );
        return {
          initAds: nativeModule.initAds,
          maybeShowInterstitial: nativeModule.maybeShowInterstitial,
          Banner: nativeModule.Banner,
        };
      } catch {
        return noopAds;
      }
    })();
  }
  return _loadPromise;
}

export async function getAdsModule(): Promise<AdsModule> {
  if (_adsModule) return _adsModule;
  _adsModule = await loadAdsModule();
  return _adsModule;
}

export async function initAds() {
  const mod = await getAdsModule();
  return mod.initAds();
}

export async function maybeShowInterstitial(every = 3) {
  const mod = await getAdsModule();
  return mod.maybeShowInterstitial(every);
}

export function Banner() {
  const [mod, setMod] = useState<AdsModule | null>(null);

  useEffect(() => {
    let mounted = true;
    getAdsModule().then((m) => {
      if (mounted) setMod(m);
    });
    return () => { mounted = false; };
  }, []);

  if (!mod) return null;
  return <mod.Banner />;
}