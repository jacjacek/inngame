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
          html, body, #root { height: 100%; width: 100%; }
          body { margin: 0; overflow: hidden; background: ${background}; }
          #root { display: flex; }
        `}</style>
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
