"use client";

import Script from "next/script";
import CookieBanner from "./CookieBanner";

const GA_ID = "G-58XTS3Y6NB";

// GA4 con Consent Mode v2 + banner de cookies en TODA la web (incluida la
// landing de conversión /puertas-abiertas). GA4 arranca con consentimiento
// denegado y solo mide/escribe cookies si la visitante acepta en el banner.
export default function SiteAnalytics() {
  return (
    <>
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});
gtag('js',new Date());
gtag('config','${GA_ID}');
(function(){var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';document.head.appendChild(s);})();`}
      </Script>
      <CookieBanner />
    </>
  );
}
