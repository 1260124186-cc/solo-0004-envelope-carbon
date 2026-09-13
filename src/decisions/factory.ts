import type { Decision } from './types'
import { clone, newId, now } from '../shared/identity'

export function createDecision(): Decision {
  return {
    id: newId('decision'),
    groupId: newId('decision-group'),
    revision: 1,
    state: 'draft',
    title: '',
    options: [],
    chosenDocumentId: '',
    rationale: '',
    verify: '',
    createdAt: now(),
    updatedAt: now(),
    confirmedAt: '',
  }
}

export function createRevision(source: Decision, revision: number): Decision {
  return {
    ...clone(source),
    id: newId('decision'),
    revision,
    state: 'draft',
    createdAt: now(),
    updatedAt: now(),
    confirmedAt: '',
  }
}
