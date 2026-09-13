import type { Material, MaterialRevision } from './types'

export function latestRevision(material: Material): MaterialRevision {
  return material.revisions.reduce((latest, revision) =>
    revision.revision > latest.revision ? revision : latest,
  )
}

export function revisionOf(material: Material, revision: number): MaterialRevision | undefined {
  return material.revisions.find((item) => item.revision === revision)
}

export function sortedRevisions(material: Material): MaterialRevision[] {
  return [...material.revisions].sort((a, b) => b.revision - a.revision)
}
