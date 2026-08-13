import { describe, expect, it } from 'vitest'
import { summarizeLessonsForKickoff } from './pool'
import type { LessonEntry } from './schema'
import { createMockAgentPort } from '../createAgentPort'
import { runLessons } from './runLessons'
import { AgentError } from '../../../shared/agent/errors'

describe('summarizeLessonsForKickoff', () => {
  it('extracts failureMode/winLossFactor and ignores malformed bodies', () => {
    const entries: LessonEntry[] = [
      {
        id: '1',
        sessionId: 's',
        roleTag: 'Explorer',
        bodyJson: JSON.stringify({ failureMode: 'late', winLossFactor: 'spread' }),
        createdAt: 't',
        excludeFromPromote: false
      },
      {
        id: '2',
        sessionId: 's',
        roleTag: 'Control',
        bodyJson: 'not-json',
        createdAt: 't',
        excludeFromPromote: false
      },
      {
        id: '3',
        sessionId: 's',
        roleTag: 'Explorer',
        bodyJson: JSON.stringify({ failureMode: 1, winLossFactor: true }),
        createdAt: 't',
        excludeFromPromote: false
      }
    ]
    const summary = summarizeLessonsForKickoff(entries)
    expect(summary[0]).toMatchObject({ failureMode: 'late', winLossFactor: 'spread' })
    expect(summary[1]?.failureMode).toBeUndefined()
    expect(summary[2]?.failureMode).toBeUndefined()
  })
})

describe('runLessons schema failures', () => {
  it('rejects non-JSON and invalid Lessons payloads', async () => {
    await expect(
      runLessons({
        agent: createMockAgentPort({ text: 'nope' }),
        factoryId: 'f',
        sessionId: 's',
        role: 'Explorer',
        packet: {
          hypothesis: 'h',
          research: {},
          frictionFillsSummary: '',
          trajectorySummary: '',
          netPnl: 0,
          fullLimitReturn: 0,
          deployedReturn: 0,
          spyReturn: 0,
          controlSameDayNet: null,
          infraSkip: false
        }
      })
    ).rejects.toMatchObject({ kind: 'SchemaInvalid' } satisfies Partial<AgentError>)

    await expect(
      runLessons({
        agent: createMockAgentPort({
          text: JSON.stringify({ failureMode: 'x' })
        }),
        factoryId: 'f',
        sessionId: 's',
        role: 'Explorer',
        packet: {
          hypothesis: 'h',
          research: {},
          frictionFillsSummary: '',
          trajectorySummary: '',
          netPnl: 0,
          fullLimitReturn: 0,
          deployedReturn: 0,
          spyReturn: 0,
          controlSameDayNet: null,
          infraSkip: false
        }
      })
    ).rejects.toMatchObject({ kind: 'SchemaInvalid' } satisfies Partial<AgentError>)
  })
})
