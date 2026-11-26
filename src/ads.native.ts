// Native AdMob implementation — ONLY loaded in dev/production builds (NOT in Expo Go)
// This file is imported dynamically via a computed path to prevent Metro static analysis

import React from 'react';
import { Platform, View } from 'react-native';

const pick = (android?: string, ios?: string) => Platform.select({ android, ios });
const BANNER = pick(process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID, process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS);
const INTER = pick(process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID, process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS);

let interstitial: any = null;
let loaded = false;
let count = 0;

let _AdsModule: any = null;

async function loadAdsModule() {
  if (_AdsModule) return _AdsModule;
  try {
    // Use Function constructor to prevent Metro from statically analyzing this import
    // This code ONLY runs in dev client / production builds where NativeModules.GoogleMobileAds exists
    const module = await new Function('return import("react-native-google-mobile-ads")')();
    _AdsModule = module.default || module;
    return _AdsModule;
  } catch {
    return null;
  }
}

export async function initAds() {
  const Ads = await loadAdsModule();
  if (!Ads) return;
  try {
    await Ads.AdsConsent?.gatherConsent?.();
  } catch {}
  try {
    await Ads.default().initialize();
    const id = __DEV__ ? Ads.TestIds.INTERSTITIAL : INTER;
    if (!id) return;
    interstitial = Ads.InterstitialAd.createForAdRequest(id, { requestNonPersonalizedAdsOnly: true });
    interstitial.addAdEventListener(Ads.AdEventType.LOADED, () => { loaded = true; });
    interstitial.addAdEventListener(Ads.AdEventType.CLOSED, () => { loaded = false; interstitial.load(); });
    interstitial.load();
  } catch {}
}

export async function maybeShowInterstitial(every = 3) {
  const Ads = await loadAdsModule();
  if (!Ads) return;
  count++;
  if (count % every === 0 && loaded && interstitial) interstitial.show();
}

export function Banner() {
  const [Ads, setAds] = React.useState<any>(null);

  React.useEffect(() => {
    loadAdsModule().then(setAds);
  }, []);

  if (!Ads) return null;

  const unitId = __DEV__ ? Ads.TestIds.BANNER : BANNER;
  if (!unitId) return null;

  return (
    <View style={{ alignItems: 'center' }}>
      <Ads.BannerAd unitId={unitId} size={Ads.BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }} />
    </View>
  );
}