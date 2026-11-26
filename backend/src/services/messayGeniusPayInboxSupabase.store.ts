/** Adaptateur Supabase : client service_role injecté depuis le serveur. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  GeniusPayInboxStore,
  InboxEventRow,
} from './messayGeniusPayInbox.service';

export function creerInboxSupabaseStore(db: SupabaseClient): GeniusPayInboxStore {
  return {
    async insert(row: InboxEventRow) {
      const { error } = await db
        .from('messay_interurbain_geniuspay_webhook_events')
        .insert({ ...row });
      return { error: error ? { code: error.code } : null };
    },
    async findSha256(eventId: string) {
      const { data, error } = await db
        .from('messay_interurbain_geniuspay_webhook_events')
        .select('raw_sha256')
        .eq('provider_event_id', eventId)
        .maybeSingle();
      return { sha256: typeof data?.raw_sha256 === 'string'
        ? data.raw_sha256 : null, error: error ? { code: error.code } : null };
    },
  };
}
