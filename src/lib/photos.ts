export async function filesToPhotoUrls(files: File[]): Promise<string[]> {
  const images = files.filter((file) => file.type.startsWith('image/'))
  const urls: string[] = []
  for (const file of images) {
    urls.push(await fileToPhotoUrl(file))
  }
  return urls
}

async function fileToPhotoUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const maxEdge = 960
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) return fileToDataUrl(file)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.72)
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}
