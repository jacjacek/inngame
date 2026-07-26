import { useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const background = '#11120F';

export default function RootHtml({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();

  return (
    <html {...htmlAttributes}>
      <head>
        {headNodes}
        <meta name="theme-color" content={background} />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
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
