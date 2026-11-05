// AdMob helpers. Safe in Expo Go: if the native module is missing, everything is a no-op.
import React from 'react';
import { Platform, View } from 'react-native';

let Ads: any = null;
try { Ads = require('react-native-google-mobile-ads'); } catch { Ads = null; }

const pick = (android?: string, ios?: string) => Platform.select({ android, ios });
const BANNER = pick(process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID, process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS);
const INTER = pick(process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID, process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS);

let interstitial: any = null;
let loaded = false;
let count = 0;

export async function initAds() {
  if (!Ads) return;
  try {
    await Ads.AdsConsent?.gatherConsent?.(); // EU/UK consent form (configure in AdMob > Privacy & messaging)
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
export function maybeShowInterstitial(every = 3) {
  count++;
  if (count % every === 0 && loaded && interstitial) interstitial.show();
}

/** Put on menu / game-over screens only — never next to the game controls (AdMob policy: accidental clicks). */
export function Banner() {
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
