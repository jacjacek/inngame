import { useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const background = '#F7F8F3';

export default function RootHtml({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();

  return (
    <html {...htmlAttributes}>
      <head>
        {headNodes}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="theme-color" content={background} />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          html, body, #root { height: 100%; width: 100%; min-width: 0; }
          html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
          body { margin: 0; overflow: hidden; overscroll-behavior: none; background: ${background}; }
          #root { display: flex; min-height: 100%; }
        `}</style>
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
