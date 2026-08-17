const upsertMock = jest.fn().mockResolvedValue({ error: null })
const insertMock = jest.fn().mockResolvedValue({ error: null })
const selectResult = { data: null, error: null }

jest.mock('@/features/memory/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      upsert: upsertMock,
      insert: insertMock,
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(selectResult),
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }),
}))

import { upsertProfile, persistMessage } from '@/features/memory/repository'
import { emptyProfile } from '@/features/memory/types'

describe('repository', () => {
  beforeEach(() => {
    upsertMock.mockClear()
    insertMock.mockClear()
  })

  it('upsertProfile calls upsert', async () => {
    await upsertProfile(emptyProfile('id-1'))
    expect(upsertMock).toHaveBeenCalledTimes(1)
  })

  it('persistMessage calls insert', async () => {
    await persistMessage('id-1', 'user', 'xin chào')
    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('persistMessage calls upsert when clientMessageId is provided', async () => {
    await persistMessage('id-1', 'assistant', 'xin chào', null, 'msg_abc')
    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(insertMock).not.toHaveBeenCalled()
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: 'id-1',
        role: 'assistant',
        content: 'xin chào',
        client_message_id: 'msg_abc',
      }),
      { onConflict: 'student_id,client_message_id' }
    )
  })
})
