import { LngLatBounds, type Map as MapLibreMap } from 'maplibre-gl'
import { computeStats } from '../domain/stats'
import type { Place } from '../domain/types'

export function formatCardDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

function waitForMapIdle(map: MapLibreMap): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve()
    map.once('idle', done)
    map.triggerRepaint()
  })
}

async function frame(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

export async function captureMemoryCard(input: {
  map: MapLibreMap
  places: Place[]
}): Promise<Blob> {
  const { map, places } = input

  if (places.length > 0) {
    const bounds = new LngLatBounds()
    for (const place of places) {
      bounds.extend([place.lng, place.lat])
    }
    map.fitBounds(bounds, {
      padding: { top: 72, bottom: 96, left: 48, right: 48 },
      maxZoom: 5,
      duration: 0,
    })
  }

  await waitForMapIdle(map)
  await frame()
  await frame()

  const mapCanvas = map.getCanvas()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const mapWidth = mapCanvas.width
  const mapHeight = mapCanvas.height
  const headerHeight = Math.round(84 * dpr)
  const footerHeight = Math.round(96 * dpr)

  const output = document.createElement('canvas')
  output.width = mapWidth
  output.height = mapHeight + headerHeight + footerHeight
  const ctx = output.getContext('2d')
  if (!ctx) throw new Error('无法生成截图画布')

  ctx.fillStyle = '#121826'
  ctx.fillRect(0, 0, output.width, output.height)

  ctx.fillStyle = '#f5f7fb'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `600 ${Math.round(24 * dpr)}px "PingFang SC", "Segoe UI", sans-serif`
  ctx.fillText('我们的地图', Math.round(28 * dpr), Math.round(38 * dpr))

  ctx.fillStyle = 'rgba(245, 247, 251, 0.72)'
  ctx.font = `${Math.round(15 * dpr)}px "PingFang SC", "Segoe UI", sans-serif`
  ctx.fillText(formatCardDate(), Math.round(28 * dpr), Math.round(64 * dpr))

  ctx.drawImage(mapCanvas, 0, headerHeight)

  const container = map.getContainer()
  const containerRect = container.getBoundingClientRect()
  const scaleX = mapWidth / Math.max(containerRect.width, 1)
  const scaleY = mapHeight / Math.max(containerRect.height, 1)

  container.querySelectorAll<HTMLElement>('.city-marker').forEach((element) => {
    const rect = element.getBoundingClientRect()
    const glyph =
      element.querySelector('.city-marker__glyph')?.textContent?.trim() || '✦'
    const x = (rect.left + rect.width / 2 - containerRect.left) * scaleX
    const y =
      (rect.top + rect.height / 2 - containerRect.top) * scaleY + headerHeight
    ctx.font = `${Math.round(30 * dpr)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(glyph, x, y)
  })

  const stats = computeStats(places)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(245, 247, 251, 0.7)'
  ctx.font = `${Math.round(14 * dpr)}px "PingFang SC", "Segoe UI", sans-serif`
  ctx.fillText(
    `已点亮 ${stats.countryCount} 国 · ${stats.cityCount} 城 · 一起 ${stats.togetherCount}`,
    Math.round(28 * dpr),
    headerHeight + mapHeight + Math.round(40 * dpr),
  )
  ctx.fillStyle = 'rgba(255, 210, 120, 0.9)'
  ctx.font = `${Math.round(13 * dpr)}px "PingFang SC", "Segoe UI", sans-serif`
  ctx.fillText(
    'SAME MAP, TWO HEARTS',
    Math.round(28 * dpr),
    headerHeight + mapHeight + Math.round(66 * dpr),
  )

  const blob = await new Promise<Blob | null>((resolve) => {
    output.toBlob((value) => resolve(value), 'image/png')
  })
  if (!blob) throw new Error('截图导出失败')
  return blob
}

export async function saveMemoryCard(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
  }

  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    await nav.share({
      files: [file],
      title: '我们的地图',
      text: '我们的旅行足迹',
    })
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
