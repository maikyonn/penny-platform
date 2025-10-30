import { corsHeaders, buildSupabaseClient, maybeHandleCors } from '../_shared/supabaseClient.ts';

type MatchPayload = {
  campaign_id: string;
  limit?: number;
};

type MockInfluencerSeed = {
  external_id: string;
  display_name: string;
  handle: string;
  platform: string;
  follower_count: number;
  engagement_rate: number;
  location: string;
  verticals: string[];
  languages: string[];
};

const MOCK_INFLUENCERS: MockInfluencerSeed[] = [
  {
    external_id: 'mock_influencer_ava_ramos',
    display_name: 'Ava Ramos',
    handle: '@ava.cooks',
    platform: 'instagram',
    follower_count: 128_400,
    engagement_rate: 4.3,
    location: 'Los Angeles, CA',
    verticals: ['food', 'lifestyle', 'wellness'],
    languages: ['en'],
  },
  {
    external_id: 'mock_influencer_jasper_lee',
    display_name: 'Jasper Lee',
    handle: '@jasper.codes',
    platform: 'youtube',
    follower_count: 256_900,
    engagement_rate: 3.7,
    location: 'Seattle, WA',
    verticals: ['technology', 'education'],
    languages: ['en'],
  },
  {
    external_id: 'mock_influencer_elena_ruiz',
    display_name: 'Elena Ruiz',
    handle: '@elenaruizfit',
    platform: 'tiktok',
    follower_count: 512_800,
    engagement_rate: 6.1,
    location: 'Austin, TX',
    verticals: ['fitness', 'wellness'],
    languages: ['en', 'es'],
  },
  {
    external_id: 'mock_influencer_mina_wong',
    display_name: 'Mina Wong',
    handle: '@minawtravels',
    platform: 'instagram',
    follower_count: 189_200,
    engagement_rate: 5.4,
    location: 'San Francisco, CA',
    verticals: ['travel', 'photography'],
    languages: ['en', 'zh'],
  },
  {
    external_id: 'mock_influencer_kai_thompson',
    display_name: 'Kai Thompson',
    handle: '@soundbykai',
    platform: 'youtube',
    follower_count: 342_100,
    engagement_rate: 4.8,
    location: 'New York, NY',
    verticals: ['music', 'producer', 'tech'],
    languages: ['en'],
  },
  {
    external_id: 'mock_influencer_lucia_gomez',
    display_name: 'Lucía Gómez',
    handle: '@lucia.sipsslow',
    platform: 'tiktok',
    follower_count: 402_300,
    engagement_rate: 7.2,
    location: 'Miami, FL',
    verticals: ['beverage', 'hospitality'],
    languages: ['en', 'es'],
  },
  {
    external_id: 'mock_influencer_omar_ali',
    display_name: 'Omar Ali',
    handle: '@omarbuilds',
    platform: 'instagram',
    follower_count: 98_500,
    engagement_rate: 4.9,
    location: 'Chicago, IL',
    verticals: ['diy', 'home_improvement', 'design'],
    languages: ['en', 'ar'],
  },
  {
    external_id: 'mock_influencer_sasha_brooks',
    display_name: 'Sasha Brooks',
    handle: '@brookssocial',
    platform: 'youtube',
    follower_count: 221_750,
    engagement_rate: 3.4,
    location: 'Denver, CO',
    verticals: ['social_media', 'marketing'],
    languages: ['en'],
  },
  {
    external_id: 'mock_influencer_devi_verma',
    display_name: 'Devi Verma',
    handle: '@devieats',
    platform: 'instagram',
    follower_count: 145_900,
    engagement_rate: 5.7,
    location: 'San Jose, CA',
    verticals: ['food', 'vegan', 'wellness'],
    languages: ['en', 'hi'],
  },
  {
    external_id: 'mock_influencer_luke_nash',
    display_name: 'Luke Nash',
    handle: '@lukeruns',
    platform: 'tiktok',
    follower_count: 310_250,
    engagement_rate: 6.4,
    location: 'Portland, OR',
    verticals: ['running', 'fitness', 'outdoors'],
    languages: ['en'],
  },
  {
    external_id: 'mock_influencer_rachel_kim',
    display_name: 'Rachel Kim',
    handle: '@rachelcreates',
    platform: 'instagram',
    follower_count: 176_840,
    engagement_rate: 4.1,
    location: 'Boston, MA',
    verticals: ['art', 'diy', 'home_decor'],
    languages: ['en', 'ko'],
  },
  {
    external_id: 'mock_influencer_mateo_silva',
    display_name: 'Mateo Silva',
    handle: '@mateosips',
    platform: 'youtube',
    follower_count: 284_670,
    engagement_rate: 3.9,
    location: 'Los Angeles, CA',
    verticals: ['coffee', 'lifestyle'],
    languages: ['en', 'pt'],
  },
];

denoServe();

function denoServe() {
  Deno.serve(async (req) => {
    const cors = maybeHandleCors(req);
    if (cors) return cors;

    try {
      if (req.method !== 'POST') {
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
        );
      }

      const { client, adminClient } = buildSupabaseClient(req);
      const body = (await req.json()) as MatchPayload;
      if (!body?.campaign_id) {
        return new Response(
          JSON.stringify({ error: 'campaign_id is required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      const { data: campaign, error: campaignError } = await client
        .from('campaigns')
        .select('id, created_by, name')
        .eq('id', body.campaign_id)
        .maybeSingle();

      if (campaignError || !campaign) {
        return new Response(
          JSON.stringify({ error: 'Campaign not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      if (campaign.created_by !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: not the campaign owner' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      const { data: targets } = await client
        .from('campaign_targets')
        .select('platforms, interests, geos')
        .eq('campaign_id', campaign.id);

      const desiredInterests = new Set<string>();
      const desiredGeos = new Set<string>();
      const desiredPlatforms = new Set<string>();

      for (const target of targets ?? []) {
        (target.interests ?? []).forEach((i) => desiredInterests.add(i));
        (target.geos ?? []).forEach((g) => desiredGeos.add(g));
        (target.platforms ?? []).forEach((p) => desiredPlatforms.add(p));
      }

      const mockInfluencers = await ensureMockInfluencers(adminClient);
      let potentialInfluencers = mockInfluencers;

      if (desiredInterests.size || desiredPlatforms.size || desiredGeos.size) {
        potentialInfluencers = mockInfluencers.filter((influencer) => {
          const matchesInterests =
            !desiredInterests.size ||
            (influencer.verticals ?? []).some((vertical) => desiredInterests.has(vertical));
          const matchesPlatforms = !desiredPlatforms.size || desiredPlatforms.has(influencer.platform ?? '');
          const matchesGeos = !desiredGeos.size || desiredGeos.has(influencer.location ?? '');
          return matchesInterests && matchesPlatforms && matchesGeos;
        });
      }

      if (!potentialInfluencers.length) {
        potentialInfluencers = mockInfluencers;
      }

      const selection = pickRandom(potentialInfluencers, body.limit ?? 6);

      const { data: existingAssignments } = await client
        .from('campaign_influencers')
        .select('influencer_id')
        .eq('campaign_id', campaign.id);

      const existingInfluencerIds = new Set<string>((existingAssignments ?? []).map((row) => row.influencer_id));

      const toInsert = selection
        .filter((influencer) => influencer.id && !existingInfluencerIds.has(influencer.id))
        .map((influencer) => ({
          campaign_id: campaign.id,
          influencer_id: influencer.id as string,
          status: 'prospect' as const,
          source: 'demo_seed',
          match_score: randomScore(),
        }));

      if (toInsert.length) {
        const { error: insertError } = await adminClient
          .from('campaign_influencers')
          .insert(toInsert);

        if (insertError) {
          console.error('campaigns-match insert error', insertError);
        }
      }

      return new Response(
        JSON.stringify({ campaign, influencers: selection }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } catch (error) {
      console.error('campaigns-match error', error);
      return new Response(
        JSON.stringify({ error: error?.message ?? 'Unknown error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  });
}

function randomScore() {
  const min = 62;
  const max = 96;
  return Math.round(Math.random() * (max - min) + min);
}

type InfluencerRow = {
  id: string;
  external_id: string | null;
  display_name: string | null;
  handle: string | null;
  platform: string | null;
  follower_count: number | null;
  engagement_rate: number | null;
  location: string | null;
  verticals: string[] | null;
  languages: string[] | null;
};

async function ensureMockInfluencers(adminClient: any) {
  const externalIds = MOCK_INFLUENCERS.map((influencer) => influencer.external_id);

  const { data: existingRows } = await adminClient
    .from('influencers')
    .select('id, external_id, display_name, handle, platform, follower_count, engagement_rate, location, verticals, languages')
    .in('external_id', externalIds);

  const existingMap = new Map<string, InfluencerRow>();
  for (const row of existingRows ?? []) {
    if (row.external_id) {
      existingMap.set(row.external_id, row);
    }
  }

  const missingSeeds = MOCK_INFLUENCERS.filter((seed) => !existingMap.has(seed.external_id));

  if (missingSeeds.length) {
    const timestamp = new Date().toISOString();
    const insertPayload = missingSeeds.map((seed) => ({
      external_id: seed.external_id,
      display_name: seed.display_name,
      handle: seed.handle,
      platform: seed.platform,
      follower_count: seed.follower_count,
      engagement_rate: seed.engagement_rate,
      location: seed.location,
      verticals: seed.verticals,
      languages: seed.languages,
      created_at: timestamp,
      updated_at: timestamp,
    }));

    const { data: insertedRows, error: insertError } = await adminClient
      .from('influencers')
      .insert(insertPayload)
      .select('id, external_id, display_name, handle, platform, follower_count, engagement_rate, location, verticals, languages');

    if (insertError) {
      console.error('ensureMockInfluencers insert error', insertError);
    } else {
      for (const row of insertedRows ?? []) {
        if (row.external_id) {
          existingMap.set(row.external_id, row);
        }
      }
    }
  }

  const { data: refreshedRows, error: refreshError } = await adminClient
    .from('influencers')
    .select('id, external_id, display_name, handle, platform, follower_count, engagement_rate, location, verticals, languages')
    .in('external_id', externalIds);

  if (refreshError) {
    console.error('ensureMockInfluencers refresh error', refreshError);
    return Array.from(existingMap.values()).filter(Boolean);
  }

  return refreshedRows ?? [];
}

function pickRandom<T>(items: T[], count: number) {
  const maxCount = Math.max(1, Math.min(count, items.length));
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone.slice(0, maxCount);
}
