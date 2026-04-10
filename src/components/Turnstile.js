'use client';

import { useEffect, useRef, useCallback } from 'react';

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/**
 * Cloudflare Turnstile component — invisible bot protection.
 *
 * Props:
 *   siteKey    — Public site key (from env: NEXT_PUBLIC_TURNSTILE_SITE_KEY)
 *   onVerify   — Called with the token string when challenge passes
 *   onExpire   — Called when the token expires (optional)
 *   onError    — Called on widget error (optional)
 *   resetKey   — Change this value to force a widget reset (e.g. after form submission)
 *   size       — 'normal' | 'compact' | 'invisible' (default: 'normal')
 *   theme      — 'light' | 'dark' | 'auto' (default: 'auto')
 */
export default function Turnstile({
  siteKey,
  onVerify,
  onExpire,
  onError,
  resetKey = 0,
  size = 'normal',
  theme = 'auto'
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const scriptLoadedRef = useRef(false);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;

    // Remove any existing widget first
    if (widgetIdRef.current !== null) {
      try { window.turnstile.remove(widgetIdRef.current); } catch {}
      widgetIdRef.current = null;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token) => onVerify?.(token),
      'expired-callback': () => onExpire?.(),
      'error-callback': () => onError?.(),
      size,
      theme
    });
  }, [siteKey, onVerify, onExpire, onError, size, theme]);

  // Load Turnstile script once
  useEffect(() => {
    if (scriptLoadedRef.current || document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`)) {
      scriptLoadedRef.current = true;
      // Script already loaded — render immediately if turnstile global exists
      if (window.turnstile) {
        renderWidget();
      }
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoadedRef.current = true;
      renderWidget();
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup widget on unmount
      if (widgetIdRef.current !== null) {
        try { window.turnstile?.remove(widgetIdRef.current); } catch {}
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render when resetKey changes (e.g. after form error to get a fresh token)
  useEffect(() => {
    if (scriptLoadedRef.current && window.turnstile) {
      renderWidget();
    }
  }, [resetKey, renderWidget]);

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}
    />
  );
}
