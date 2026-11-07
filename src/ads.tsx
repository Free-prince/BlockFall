// AdMob helpers. Native module only exists in development/production builds, not Expo Go.
import React from 'react';
import { Platform, View, NativeModules } from 'react-native';

const pick = (android?: string, ios?: string) => Platform.select({ android, ios });
const BANNER = pick(process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID, process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS);
const INTER = pick(process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID, process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS);

// Only load ads if the native module exists (not available in Expo Go)
const hasNativeAds = !!NativeModules.GoogleMobileAds;

let interstitial: any = null;
let loaded = false;
let count = 0;

// Truly lazy getter using dynamic import - Metro cannot statically analyze this
let _AdsPromise: Promise<any> | null = null;
async function getAds() {
  if (!hasNativeAds) return null;

  if (_AdsPromise === null) {
    _AdsPromise = (async () => {
      try {
        // Dynamic import - only loads when actually called
        const module = await import('react-native-google-mobile-ads');
        return module.default || module;
      } catch {
        return false;
      }
    })();
  }
  const Ads = await _AdsPromise;
  return Ads || null;
}

export async function initAds() {
  const Ads = await getAds();
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

/** Call between games (e.g. when the player taps "Play again"). Shows an ad every `every` calls. */
export async function maybeShowInterstitial(every = 3) {
  const Ads = await getAds();
  if (!Ads) return;
  count++;
  if (count % every === 0 && loaded && interstitial) interstitial.show();
}

/** Banner ad component - returns null in Expo Go (no native module) */
export function Banner() {
  const [Ads, setAds] = React.useState<any>(null);

  React.useEffect(() => {
    if (!hasNativeAds) return;
    getAds().then(setAds);
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