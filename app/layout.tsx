import "./globals.css";
import { Public_Sans } from "next/font/google";
import { AuthMenu } from "@/components/auth/auth-menu";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { AuthProvider } from "@/lib/auth/auth-context";

//提供公共字体,例如<body className={publicSans.className}>
const publicSans = Public_Sans({ subsets: ["latin"] });


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // lang="en" 表示英文
    <html lang="en">
      <head>
        <title>LangChain + Next.js</title>
        {/* 提供一个favicon图标 rel:"shortcut icon"(表示快捷图标) href:图标路径 */}
        <link rel="shortcut icon" href="/images/favicon.ico" />
        <meta
          name="description"
          content="Starter template showing how to use LangChain in Next.js projects. See source code and deploy your own at https://github.com/langchain-ai/langchain-nextjs-template!"
        />
        <meta property="og:title" content="LangChain + Next.js Template" />
        <meta
          property="og:description"
          content="Starter template showing how to use LangChain in Next.js projects. See source code and deploy your own at https://github.com/langchain-ai/langchain-nextjs-template!"
        />
        <meta property="og:image" content="/images/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="LangChain + Next.js Template" />
        <meta
          name="twitter:description"
          content="Starter template showing how to use LangChain in Next.js projects. See source code and deploy your own at https://github.com/langchain-ai/langchain-nextjs-template!"
        />
        <meta name="twitter:image" content="/images/og-image.png" />
      </head>
      {/* 设置字体 */}
      <body className={publicSans.className}>
        {/* 提供一个NuqsAdapter组件,用于处理URL查询参数 */}
        <NuqsAdapter>
          {/* 授权 */}
          <AuthProvider>
            <div className="h-[100dvh] bg-secondary p-4">
              <div className="grid h-full grid-rows-[auto,1fr] gap-0">
                <aside className="rounded-t-2xl border border-input border-b-0 bg-background/70 p-3 lg:p-4">
                  <div className="flex items-center justify-end">
                    <AuthMenu />
                  </div>
                </aside>

                <div className="relative min-h-0 rounded-b-2xl border border-input bg-background">
                  <div className="absolute inset-0">{children}</div>
                </div>
              </div>
            </div>
            {/* 组件库内的组件: 主要用于确认主题(System) */}
            <Toaster />
          </AuthProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
