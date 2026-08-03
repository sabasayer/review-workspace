export const CHANGED_THRESHOLD = 32

export interface PixelDiffStats {
  width: number
  height: number
  changedPercent: number
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`failed to load ${src}`))
    img.src = src
  })
}

function readImageData(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export function diffImageData(baseData: ImageData, headData: ImageData, outData: ImageData): PixelDiffStats {
  const width = baseData.width
  const height = baseData.height
  let changed = 0
  for (let i = 0; i < baseData.data.length; i += 4) {
    const delta =
      Math.abs(baseData.data[i] - headData.data[i]) +
      Math.abs(baseData.data[i + 1] - headData.data[i + 1]) +
      Math.abs(baseData.data[i + 2] - headData.data[i + 2])
    if (delta > CHANGED_THRESHOLD) {
      changed++
      outData.data[i] = 255
      outData.data[i + 1] = 0
      outData.data[i + 2] = 0
      outData.data[i + 3] = 255
    } else {
      const gray = (headData.data[i] + headData.data[i + 1] + headData.data[i + 2]) / 3
      outData.data[i] = gray
      outData.data[i + 1] = gray
      outData.data[i + 2] = gray
      outData.data[i + 3] = 90
    }
  }
  return { width, height, changedPercent: (changed / (width * height)) * 100 }
}

export function computePixelDiff(
  baseImg: HTMLImageElement,
  headImg: HTMLImageElement,
  outCanvas: HTMLCanvasElement,
): PixelDiffStats | { error: string } {
  if (baseImg.naturalWidth !== headImg.naturalWidth || baseImg.naturalHeight !== headImg.naturalHeight) {
    return {
      error: `Dimensions differ: base ${baseImg.naturalWidth}×${baseImg.naturalHeight} vs head ${headImg.naturalWidth}×${headImg.naturalHeight} — cannot pixel-diff.`,
    }
  }

  const width = baseImg.naturalWidth
  const height = baseImg.naturalHeight
  const baseData = readImageData(baseImg)
  const headData = readImageData(headImg)

  outCanvas.width = width
  outCanvas.height = height
  const outCtx = outCanvas.getContext('2d')!
  const outData = outCtx.createImageData(width, height)
  const stats = diffImageData(baseData, headData, outData)
  outCtx.putImageData(outData, 0, 0)
  return stats
}

export function grayImageData(width: number, height: number, values: number[]): ImageData {
  const data = new ImageData(width, height)
  values.forEach((value, index) => {
    const i = index * 4
    data.data[i] = value
    data.data[i + 1] = value
    data.data[i + 2] = value
    data.data[i + 3] = 255
  })
  return data
}
