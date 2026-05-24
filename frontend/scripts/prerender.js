/**
 * プリレンダリングスクリプト
 * ビルド後に実行して、各ページの静的HTMLを生成する
 */

import puppeteer from 'puppeteer'
import handler from 'serve-handler'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')

// プリレンダリング対象のページ
const routes = ['/', '/deck', '/tournaments', '/analytics']

async function prerender() {
  console.log('Starting prerender...')

  // 静的サーバーを起動
  const server = http.createServer((request, response) => {
    return handler(request, response, {
      public: distDir,
      rewrites: [{ source: '**', destination: '/index.html' }],
    })
  })

  await new Promise((resolve) => server.listen(4173, resolve))
  const baseUrl = 'http://localhost:4173'
  console.log(`Server started at ${baseUrl}`)

  // Puppeteerを起動
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    timeout: 60000,
  })

  try {
    for (const route of routes) {
      console.log(`Prerendering ${route}...`)
      const page = await browser.newPage()

      // ページにアクセス
      await page.goto(`${baseUrl}${route}`, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      })

      // react-helmet-asyncがDOMを更新するのを待つ
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Helmet側で設定されたtitleを取得
      const pageTitle = await page.evaluate(() => document.title)

      // HTMLを取得し、重複するtitleとmeta descriptionを削除
      let html = await page.content()

      // 全てのtitleタグを削除し、正しいtitleを設定
      html = html.replace(/<title>.*?<\/title>/g, '')
      html = html.replace('</head>', `<title>${pageTitle}</title></head>`)

      // 重複するmeta descriptionを削除（最後のものを残す）
      const descMatches = html.match(/<meta name="description" content="[^"]*">/g)
      if (descMatches && descMatches.length > 1) {
        const lastDesc = descMatches[descMatches.length - 1]
        html = html.replace(/<meta name="description" content="[^"]*">/g, '')
        html = html.replace('</head>', `${lastDesc}</head>`)
      }

      // 重複するcanonicalを削除（最後のものを残す）
      const canonicalMatches = html.match(/<link rel="canonical" href="[^"]*">/g)
      if (canonicalMatches && canonicalMatches.length > 1) {
        const lastCanonical = canonicalMatches[canonicalMatches.length - 1]
        html = html.replace(/<link rel="canonical" href="[^"]*">/g, '')
        html = html.replace('</head>', `${lastCanonical}</head>`)
      }

      // ファイルパスを決定
      let filePath
      if (route === '/') {
        filePath = path.join(distDir, 'index.html')
      } else {
        // /tournaments -> /tournaments/index.html
        const routeDir = path.join(distDir, route.slice(1))
        fs.mkdirSync(routeDir, { recursive: true })
        filePath = path.join(routeDir, 'index.html')
      }

      // HTMLを保存
      fs.writeFileSync(filePath, html, 'utf-8')
      console.log(`  Saved to ${filePath}`)

      await page.close()
    }

    console.log('Prerender complete!')
  } finally {
    await browser.close()
    server.close()
  }
}

prerender().catch((error) => {
  console.error('Prerender failed:', error)
  process.exit(1)
})
