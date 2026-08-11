import { supabase } from '@/lib/supabase'

// Roughly the "40-60 visible characters" the product spec asked for, leaving
// room for the trailing ellipsis within that budget.
const TITLE_MAX_LENGTH = 56

// Derives a conversation title from the first meaningful user message only —
// never Gemini/Assistant text, never a filename. Collapses whitespace/newlines
// so a pasted multi-line message doesn't produce a mangled sidebar row.
export function deriveConversationTitle(text) {
  const collapsed = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!collapsed) return 'New chat'
  if (collapsed.length <= TITLE_MAX_LENGTH) return collapsed
  return `${collapsed.slice(0, TITLE_MAX_LENGTH).trimEnd()}…`
}

export async function createConversation(userId, title) {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select()
    .single()
  if (error) throw error
  return data
}

// RLS already scopes rows to their owner, but the user_id filter is kept
// explicit here rather than relying on that alone, and newest-first ordering
// happens server-side rather than in the client. Used by the sidebar, which
// only ever needs a handful of rows — the query itself is limited rather
// than fetching everything and slicing client-side.
export async function getRecentConversations(userId, limit = 5) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// Paginated + optionally search-filtered conversation list for the full Chat
// History page. Requests one row beyond `limit` so the caller can tell
// whether another page exists without a separate COUNT query, then trims it
// back off before returning.
export async function getConversationHistory({ userId, search = '', limit = 20, offset = 0 }) {
  let query = supabase
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit)

  const trimmedSearch = search.trim()
  if (trimmedSearch) {
    // ILIKE's own wildcards (%, _) and escape character (\) are escaped so
    // the search text is matched literally — the query is still built via
    // the Supabase query builder, never raw/concatenated SQL.
    const escaped = trimmedSearch.replace(/[%_\\]/g, (match) => `\\${match}`)
    query = query.ilike('title', `%${escaped}%`)
  }

  const { data, error } = await query
  if (error) throw error
  const rows = data ?? []
  const hasMore = rows.length > limit
  return { conversations: hasMore ? rows.slice(0, limit) : rows, hasMore }
}

export async function getConversationMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function saveMessage(conversationId, role, content) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role, content })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function touchConversation(conversationId) {
  const { error } = await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)
  if (error) throw error
}

// Not wired to any UI yet — renaming a chat is explicitly out of scope for
// this version — but kept available since the conversations table already
// supports it and the service should own every conversation mutation.
export async function updateConversationTitle(conversationId, title) {
  const { error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId)
  if (error) throw error
}

// messages.conversation_id -> conversations.id cascades, so deleting the
// conversation row removes its messages without a separate call.
export async function deleteConversation(conversationId) {
  const { error } = await supabase.from('conversations').delete().eq('id', conversationId)
  if (error) throw error
}
