"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import CookieBanner from "./CookieBanner";

const GA_ID = "G-58XTS3Y6NB";

// GA4 + banner de cookies en TODA la web EXCEPTO la landing de conversión
// (/puertas-abiertas): ahí no queremos banner para no añadir fricción a un
// tráfico de pago. Esa landing ya mide conversiones con el Píxel de Meta y el
// tráfico con Vercel Analytics (sin cookies, sin banner).
export default function SiteAnalytics() {
  const pathname = usePathname();
  if (pathname?.startsWith("/puertas-abiertas")) return null;

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
