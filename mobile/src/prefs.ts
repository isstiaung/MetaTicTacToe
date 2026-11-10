// SPDX-License-Identifier: MIT

/**
 * Small local UI preferences, persisted via AsyncStorage. Distinct from
 * `online/identity.ts` (player id + name) — this is for app-level, non-online flags
 * such as whether the rules explainer has been auto-shown. All reads are best-effort.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const RULES_SEEN_KEY = '@mtt/rulesSeen';

/** Whether the in-app rules explainer has been auto-shown at least once. */
export async function loadRulesSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(RULES_SEEN_KEY)) === '1';
  } catch {
    return false;
  }
}

/** Mark the rules explainer as seen so it isn't auto-shown again (best-effort). */
export async function markRulesSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(RULES_SEEN_KEY, '1');
  } catch {
    // Ignore — it'll just auto-show again next launch.
  }
}
