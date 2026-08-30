import { useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const background = '#F7F8F3';
const title = 'Trener tenisa w Warszawie i rezerwacje | MyMovio';
const description = 'Znajdź trenera tenisa w Warszawie, sprawdź termin, zarezerwuj trening i zarządzaj kalendarzem, rozmowami oraz notatkami w MyMovio.';
const origin = 'https://tenis.walasek.xyz';
const structuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${origin}/#website`,
      url: `${origin}/`,
      name: 'MyMovio',
      inLanguage: 'pl-PL',
      description,
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${origin}/#application`,
      name: 'MyMovio',
      applicationCategory: 'SportsApplication',
      operatingSystem: 'Web, iOS, Android',
      url: `${origin}/`,
      inLanguage: 'pl-PL',
      description,
    },
  ],
}).replace(/</g, '\\u003c');

export default function RootHtml({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();

  return (
    <html lang="pl" {...htmlAttributes}>
      <head>
        {headNodes}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="application-name" content="MyMovio" />
        <meta name="robots" content="index, follow" />
        <meta name="theme-color" content={background} />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="canonical" href={`${origin}/`} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:site_name" content="MyMovio" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={`${origin}/`} />
        <meta property="og:image" content={`${origin}/og.png`} />
        <meta property="og:image:width" content="1731" />
        <meta property="og:image:height" content="909" />
        <meta property="og:image:alt" content="MyMovio — tenis w Twoim rytmie" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={`${origin}/og.png`} />
        <meta name="twitter:image:alt" content="MyMovio — tenis w Twoim rytmie" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          html, body, #root { height: 100%; width: 100%; min-width: 0; }
          html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
          body { margin: 0; overflow: hidden; overscroll-behavior: none; background: ${background}; }
          #root { display: flex; min-height: 100%; }
          [data-landing="shell"] { isolation: isolate; }
          [data-landing="header"] {
            position: sticky !important;
            top: 0;
            z-index: 1000 !important;
            isolation: isolate;
            margin-left: -28px;
            margin-right: -28px;
            padding-left: 28px;
            padding-right: 28px;
            background-color: ${background} !important;
            box-shadow: 0 1px 0 rgba(7,16,10,0.10);
          }
          #jak-to-dziala, #funkcje, #dlaczego { scroll-margin-top: 104px; }

          @media (max-width: 1059px) {
            [data-landing="nav"] { display: none !important; }
            [data-landing="hero"] { min-height: 0 !important; flex-direction: column !important; }
            [data-landing="hero-copy"] { flex: 0 1 auto !important; min-height: 580px !important; padding-left: 48px !important; padding-right: 48px !important; }
            [data-landing="hero-title"] { max-width: 760px !important; font-size: 60px !important; line-height: 63px !important; }
            [data-landing="hero-visual"] { flex: 0 1 auto !important; min-height: 560px !important; }
            [data-landing="emotion-section"] { flex-direction: column !important; gap: 52px !important; padding: 96px 18px !important; }
            [data-landing="emotion-intro"] { max-width: 780px !important; }
            [data-landing="emotion-grid"] { width: 100% !important; }
            [data-landing="steps"] { flex-direction: column !important; }
            [data-landing="step-card"] { min-height: 0 !important; }
            [data-landing="step-connector"] { display: none !important; }
            [data-landing="features-hero"] { flex-direction: column !important; }
            [data-landing="features-copy"] { flex: 0 1 auto !important; padding-left: 38px !important; padding-right: 38px !important; }
            [data-landing="schedule"] { flex: 0 1 auto !important; width: 86% !important; }
            [data-landing="feature-card"] { width: 100% !important; min-height: 0 !important; }
            [data-landing="coach-section"] { flex-direction: column !important; align-items: stretch !important; gap: 58px !important; padding-left: 18px !important; padding-right: 18px !important; }
            [data-landing="coach-portrait"] { flex: 0 1 auto !important; min-height: 580px !important; }
            [data-landing="coach-copy"] { flex: 0 1 auto !important; }
          }

          @media (max-width: 699px) {
            [data-landing="shell"] { padding-left: 14px !important; padding-right: 14px !important; }
            [data-landing="header"] { min-height: 76px !important; margin-left: -14px; margin-right: -14px; padding-left: 14px; padding-right: 14px; }
            [data-landing="header-login"] { display: none !important; }
            [data-landing="header-cta"] { min-height: 42px !important; padding-left: 15px !important; padding-right: 15px !important; }
            [data-landing="hero-copy"] { min-height: 0 !important; padding: 48px 22px !important; }
            [data-landing="hero-title"] { font-size: 42px !important; line-height: 44px !important; letter-spacing: -1.8px !important; }
            [data-landing="hero-lead"] { margin-top: 22px !important; font-size: 16px !important; line-height: 25px !important; }
            [data-landing="primary-cta"], [data-landing="secondary-cta"] { width: 100% !important; }
            [data-landing="hero-visual"] { min-height: 480px !important; padding: 20px !important; }
            [data-landing="coach-hint"] { top: 82px !important; right: 20px !important; left: 20px !important; max-width: none !important; }
            [data-landing="next-training"] { gap: 12px !important; padding: 14px !important; }
            [data-landing="training-arrow"] { display: none !important; }
            [data-landing="section-title"] { font-size: 36px !important; line-height: 39px !important; letter-spacing: -1.4px !important; }
            [data-landing="emotion-card"] { width: 100% !important; min-height: 0 !important; }
            [data-landing="section-header"] { flex-direction: column !important; align-items: flex-start !important; gap: 18px !important; }
            [data-landing="section-header-lead"] { text-align: left !important; }
            [data-landing="features-title"] { font-size: 36px !important; line-height: 39px !important; letter-spacing: -1.4px !important; }
            [data-landing="schedule"] { width: auto !important; margin: 4px 18px 48px !important; padding: 18px !important; transform: none !important; }
            [data-landing="coach-profile"] { padding: 16px !important; }
            [data-landing="final"] { min-height: 0 !important; padding: 58px 24px !important; }
            [data-landing="final-title"] { font-size: 38px !important; line-height: 41px !important; letter-spacing: -1.5px !important; }
            [data-landing="court"] { display: none !important; }
            [data-landing="footer"] { flex-direction: column !important; align-items: flex-start !important; justify-content: center !important; gap: 22px !important; }
          }
        `}</style>
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
