// SPDX-License-Identifier: MIT

import { Modal, Pressable, StyleSheet, Text, type TextStyle, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { palette, radius, shadow, space, typography } from '@mtt/theme';
import { TURNSTILE_PAGE_ORIGIN, TURNSTILE_SITE_KEY } from '../online/config';

interface TurnstileModalProps {
  /** Mount + show the challenge. Unmounts the WebView when false. */
  visible: boolean;
  /** Fired with the Turnstile token once the challenge is solved. */
  onToken: (token: string) => void;
  /** Fired if the widget errors or expires before solving. */
  onError: () => void;
  /** User dismissed the sheet without solving. */
  onCancel: () => void;
}

/**
 * Renders the Cloudflare Turnstile widget inside a WebView (React Native has no DOM, so we
 * can't use the JS widget directly) and bridges the resulting token back to native via
 * `window.ReactNativeWebView.postMessage`. The mobile counterpart of `web/src/online/Turnstile.tsx`.
 *
 * `appearance: 'interaction-only'` keeps the widget invisible unless Cloudflare actually needs a
 * human tap — in which case the sheet shows it. NOTE: a *real* site key only renders on its
 * allow-listed domains, so set `expo.extra.turnstilePageOrigin` to the web app's origin
 * (used as the WebView `baseUrl`). The always-pass test key works on any origin in dev.
 */
function buildHtml(siteKey: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
    <style>
      html, body { margin: 0; padding: 0; background: transparent; }
      #wrap { display: flex; align-items: center; justify-content: center; min-height: 100%; padding: 8px; }
    </style>
  </head>
  <body>
    <div id="wrap"><div id="cf"></div></div>
    <script>
      function post(m) {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m));
      }
      var tries = 0;
      function render() {
        if (!window.turnstile) {
          if (tries++ > 100) { post({ type: 'error' }); return; }
          return void setTimeout(render, 100);
        }
        try {
          window.turnstile.render('#cf', {
            sitekey: ${JSON.stringify(siteKey)},
            appearance: 'interaction-only',
            callback: function (t) { post({ type: 'token', token: t }); },
            'error-callback': function () { post({ type: 'error' }); },
            'expired-callback': function () { post({ type: 'error' }); }
          });
        } catch (e) { post({ type: 'error' }); }
      }
      render();
    </script>
  </body>
</html>`;
}

export function TurnstileModal({ visible, onToken, onError, onCancel }: TurnstileModalProps) {
  const html = buildHtml(TURNSTILE_SITE_KEY);

  const handleMessage = (event: WebViewMessageEvent) => {
    let msg: { type?: string; token?: string };
    try {
      msg = JSON.parse(event.nativeEvent.data) as { type?: string; token?: string };
    } catch {
      return;
    }
    if (msg.type === 'token' && msg.token) onToken(msg.token);
    else if (msg.type === 'error') onError();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Cancel verification">
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title} allowFontScaling={false}>
            Quick check
          </Text>
          <Text style={styles.sub} allowFontScaling={false}>
            Verifying you're human before connecting…
          </Text>

          <View style={styles.webWrap}>
            {visible ? (
              <WebView
                originWhitelist={['*']}
                source={
                  TURNSTILE_PAGE_ORIGIN
                    ? { html, baseUrl: TURNSTILE_PAGE_ORIGIN }
                    : { html }
                }
                onMessage={handleMessage}
                javaScriptEnabled
                style={styles.web}
                containerStyle={styles.web}
                scrollEnabled={false}
                // A transparent background lets the (often invisible) widget blend in.
                backgroundColor="transparent"
              />
            ) : null}
          </View>

          <Pressable
            onPress={onCancel}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancel} allowFontScaling={false}>
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: palette.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    paddingVertical: space.xl,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    gap: space.sm,
    shadowColor: shadow.card.shadowColor,
    shadowOpacity: shadow.card.shadowOpacity,
    shadowRadius: shadow.card.shadowRadius,
    shadowOffset: shadow.card.shadowOffset,
    elevation: shadow.card.elevation,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold as TextStyle['fontWeight'],
    color: palette.ink,
  },
  sub: {
    fontSize: typography.size.sm,
    color: palette.inkSoft,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  webWrap: {
    width: '100%',
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  web: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  cancel: {
    fontSize: typography.size.sm,
    color: palette.muted,
    fontWeight: typography.weight.medium as TextStyle['fontWeight'],
    paddingTop: space.sm,
  },
});
