export interface LayerResult {
  layerId: string
  materialName: string
  thickness: number
  mass: number
  initial: number
  replacement: number
  cycles: number
  total: number
  resistance: number
  source: string
}

export interface Calculation {
  layers: LayerResult[]
  thickness: number
  mass: number
  initial: number
  replacement: number
  intensity: number
  whole: number
  resistance: number
  transmittance: number
  carbonPass: boolean
  thermalPass: boolean
  method: string
}
