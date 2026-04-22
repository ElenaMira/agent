import "./globals.css";
import { Public_Sans } from "next/font/google";
import { ActiveLink } from "@/components/Navbar";
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
          {/*  第一行：导航栏（auto(由内容决定高度)）第二行：主要区域（1fr - 填满剩余空间）dvh:动态可视高度为100% */}
          <div className="bg-secondary grid grid-rows-[auto,1fr] h-[100dvh]">
            {/* 一:头部区域的布局 */}
            <div className="flex grid-cols-[1fr,auto] gap-2 justify-between p-4">
              {/* 左边一列的排布*/}
              {/* 导航栏: flex-col:移动端垂直排列（flex-col） md:flex-row:水平排列 */}
              <div className="flex gap-4 flex-col md:flex-row md:items-center">
              </div>
              <div className="flex gap-4 flex-col md:flex-row md:items-center">
                <nav className="flex gap-1 flex-col md:flex-row order-2">
                  <ActiveLink href="/retrieval_agents">
                    🤖 Retrieval Agents
                  </ActiveLink>
                </nav>
              </div>
              {/* 右边一列的排布 */}
              {/* 顶部右侧：授权 */}
              <div className="flex justify-center">
                <AuthMenu />
              </div>
            </div>
            {/* 二:主体的布局 */}
            <div className="bg-background mx-4 relative grid rounded-t-2xl border border-input border-b-0">
              <div className="absolute inset-0">{children}</div>
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
