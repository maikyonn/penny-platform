export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13.0.5';
  };
  public: {
    Tables: {
      ai_recommendations: {
        Row: {
          campaign_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          influencer_id: string | null;
          metadata: Json | null;
          rationale: string | null;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          influencer_id?: string | null;
          metadata?: Json | null;
          rationale?: string | null;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          influencer_id?: string | null;
          metadata?: Json | null;
          rationale?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_recommendations_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_recommendations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'ai_recommendations_influencer_id_fkey';
            columns: ['influencer_id'];
            isOneToOne: false;
            referencedRelation: 'influencers';
            referencedColumns: ['id'];
          }
        ];
      };
      campaign_assets: {
        Row: {
          campaign_id: string;
          created_at: string;
          description: string | null;
          id: string;
          kind: string;
          storage_path: string;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          kind: string;
          storage_path: string;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          kind?: string;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_assets_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          }
        ];
      };
      campaign_influencers: {
        Row: {
          campaign_id: string;
          created_at: string;
          id: string;
          influencer_id: string;
          last_message_at: string | null;
          match_score: number | null;
          outreach_channel: Database['public']['Enums']['outreach_channel'] | null;
          source: string | null;
          status: Database['public']['Enums']['campaign_influencer_status'];
          updated_at: string;
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          id?: string;
          influencer_id: string;
          last_message_at?: string | null;
          match_score?: number | null;
          outreach_channel?: Database['public']['Enums']['outreach_channel'] | null;
          source?: string | null;
          status?: Database['public']['Enums']['campaign_influencer_status'];
          updated_at?: string;
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          id?: string;
          influencer_id?: string;
          last_message_at?: string | null;
          match_score?: number | null;
          outreach_channel?: Database['public']['Enums']['outreach_channel'] | null;
          source?: string | null;
          status?: Database['public']['Enums']['campaign_influencer_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_influencers_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaign_influencers_influencer_id_fkey';
            columns: ['influencer_id'];
            isOneToOne: false;
            referencedRelation: 'influencers';
            referencedColumns: ['id'];
          }
        ];
      };
      campaign_metrics: {
        Row: {
          campaign_id: string;
          clicks: number | null;
          conversions: number | null;
          created_at: string;
          id: number;
          impressions: number | null;
          metric_date: string;
          spend_cents: number | null;
        };
        Insert: {
          campaign_id: string;
          clicks?: number | null;
          conversions?: number | null;
          created_at?: string;
          id?: number;
          impressions?: number | null;
          metric_date: string;
          spend_cents?: number | null;
        };
        Update: {
          campaign_id?: string;
          clicks?: number | null;
          conversions?: number | null;
          created_at?: string;
          id?: number;
          impressions?: number | null;
          metric_date?: string;
          spend_cents?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_metrics_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          }
        ];
      };
      campaign_targets: {
        Row: {
          audience: Json | null;
          campaign_id: string;
          created_at: string;
          geos: string[] | null;
          id: string;
          interests: string[] | null;
          platforms: string[] | null;
        };
        Insert: {
          audience?: Json | null;
          campaign_id: string;
          created_at?: string;
          geos?: string[] | null;
          id?: string;
          interests?: string[] | null;
          platforms?: string[] | null;
        };
        Update: {
          audience?: Json | null;
          campaign_id?: string;
          created_at?: string;
          geos?: string[] | null;
          id?: string;
          interests?: string[] | null;
          platforms?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'campaign_targets_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          }
        ];
      };
      campaigns: {
        Row: {
          archived_at: string | null;
          budget_cents: number | null;
          created_at: string;
          created_by: string;
          currency: string | null;
          description: string | null;
          end_date: string | null;
          id: string;
          landing_page_url: string | null;
          name: string;
          objective: string | null;
          user_id: string;
          start_date: string | null;
          status: Database['public']['Enums']['campaign_status'];
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          budget_cents?: number | null;
          created_at?: string;
          created_by: string;
          currency?: string | null;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          landing_page_url?: string | null;
          name: string;
          objective?: string | null;
          user_id: string;
          start_date?: string | null;
          status?: Database['public']['Enums']['campaign_status'];
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          budget_cents?: number | null;
          created_at?: string;
          created_by?: string;
          currency?: string | null;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          landing_page_url?: string | null;
          name?: string;
          objective?: string | null;
          user_id?: string;
          start_date?: string | null;
          status?: Database['public']['Enums']['campaign_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaigns_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'campaigns_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      chat_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          metadata: Json | null;
          role: string;
          session_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          role: string;
          session_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          role?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'chat_sessions';
            referencedColumns: ['id'];
          }
        ];
      };
      chat_sessions: {
        Row: {
          campaign_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          owner_id: string;
          topic: Database['public']['Enums']['workflow_topic'];
        };
        Insert: {
          campaign_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          owner_id: string;
          topic?: Database['public']['Enums']['workflow_topic'];
        };
        Update: {
          campaign_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          owner_id?: string;
          topic?: Database['public']['Enums']['workflow_topic'];
        };
        Relationships: [
          {
            foreignKeyName: 'chat_sessions_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_sessions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'chat_sessions_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      influencer_profiles: {
        Row: {
          availability: string | null;
          bio: string | null;
          demographics: Json | null;
          influencer_id: string;
          last_synced_at: string | null;
          links: Json | null;
          rates: Json | null;
        };
        Insert: {
          availability?: string | null;
          bio?: string | null;
          demographics?: Json | null;
          influencer_id: string;
          last_synced_at?: string | null;
          links?: Json | null;
          rates?: Json | null;
        };
        Update: {
          availability?: string | null;
          bio?: string | null;
          demographics?: Json | null;
          influencer_id?: string;
          last_synced_at?: string | null;
          links?: Json | null;
          rates?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'influencer_profiles_influencer_id_fkey';
            columns: ['influencer_id'];
            isOneToOne: true;
            referencedRelation: 'influencers';
            referencedColumns: ['id'];
          }
        ];
      };
      influencer_stats_history: {
        Row: {
          created_at: string;
          engagement_rate: number | null;
          follower_count: number | null;
          id: number;
          impressions: number | null;
          influencer_id: string;
          snapshot_date: string;
        };
        Insert: {
          created_at?: string;
          engagement_rate?: number | null;
          follower_count?: number | null;
          id?: number;
          impressions?: number | null;
          influencer_id: string;
          snapshot_date: string;
        };
        Update: {
          created_at?: string;
          engagement_rate?: number | null;
          follower_count?: number | null;
          id?: number;
          impressions?: number | null;
          influencer_id?: string;
          snapshot_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'influencer_stats_history_influencer_id_fkey';
            columns: ['influencer_id'];
            isOneToOne: false;
            referencedRelation: 'influencers';
            referencedColumns: ['id'];
          }
        ];
      };
      influencers: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          engagement_rate: number | null;
          external_id: string | null;
          follower_count: number | null;
          handle: string | null;
          id: string;
          languages: string[] | null;
          location: string | null;
          platform: string | null;
          updated_at: string;
          verticals: string[] | null;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          engagement_rate?: number | null;
          external_id?: string | null;
          follower_count?: number | null;
          handle?: string | null;
          id?: string;
          languages?: string[] | null;
          location?: string | null;
          platform?: string | null;
          updated_at?: string;
          verticals?: string[] | null;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          engagement_rate?: number | null;
          external_id?: string | null;
          follower_count?: number | null;
          handle?: string | null;
          id?: string;
          languages?: string[] | null;
          location?: string | null;
          platform?: string | null;
          updated_at?: string;
          verticals?: string[] | null;
        };
        Relationships: [];
      };
      outreach_messages: {
        Row: {
          attachments: string[] | null;
          author_id: string | null;
          body: string | null;
          direction: string;
          id: string;
          sent_at: string;
          thread_id: string;
        };
        Insert: {
          attachments?: string[] | null;
          author_id?: string | null;
          body?: string | null;
          direction: string;
          id?: string;
          sent_at?: string;
          thread_id: string;
        };
        Update: {
          attachments?: string[] | null;
          author_id?: string | null;
          body?: string | null;
          direction?: string;
          id?: string;
          sent_at?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'outreach_messages_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'outreach_messages_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'outreach_threads';
            referencedColumns: ['id'];
          }
        ];
      };
      outreach_threads: {
        Row: {
          campaign_influencer_id: string;
          channel: Database['public']['Enums']['outreach_channel'];
          created_at: string;
          external_thread_id: string | null;
          id: string;
          last_message_at: string | null;
        };
        Insert: {
          campaign_influencer_id: string;
          channel: Database['public']['Enums']['outreach_channel'];
          created_at?: string;
          external_thread_id?: string | null;
          id?: string;
          last_message_at?: string | null;
        };
        Update: {
          campaign_influencer_id?: string;
          channel?: Database['public']['Enums']['outreach_channel'];
          created_at?: string;
          external_thread_id?: string | null;
          id?: string;
          last_message_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'outreach_threads_campaign_influencer_id_fkey';
            columns: ['campaign_influencer_id'];
            isOneToOne: false;
            referencedRelation: 'campaign_influencers';
            referencedColumns: ['id'];
          }
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          deleted_at: string | null;
          full_name: string | null;
          locale: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          full_name?: string | null;
          locale?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          full_name?: string | null;
          locale?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          created_at: string;
          current_period_end: string | null;
          id: string;
          user_id: string;
          plan: Database['public']['Enums']['plan_tier'];
          provider: string;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          user_id: string;
          plan?: Database['public']['Enums']['plan_tier'];
          provider?: string;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          user_id?: string;
          plan?: Database['public']['Enums']['plan_tier'];
          provider?: string;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      usage_logs: {
        Row: {
          id: number;
          metric: string;
          user_id: string;
          quantity: number;
          recorded_at: string;
        };
        Insert: {
          id?: number;
          metric: string;
          user_id: string;
          quantity: number;
          recorded_at?: string;
        };
        Update: {
          id?: number;
          metric?: string;
          user_id?: string;
          quantity?: number;
          recorded_at?: string;
        };
        Relationships: [];
      };
      workflow_runs: {
        Row: {
          campaign_id: string | null;
          error: string | null;
          executed_by: string | null;
          finished_at: string | null;
          id: string;
          input: Json | null;
          owner_id: string;
          output: Json | null;
          started_at: string;
          status: string;
          workflow: string;
        };
        Insert: {
          campaign_id?: string | null;
          error?: string | null;
          executed_by?: string | null;
          finished_at?: string | null;
          id?: string;
          input?: Json | null;
          owner_id: string;
          output?: Json | null;
          started_at?: string;
          status?: string;
          workflow: string;
        };
        Update: {
          campaign_id?: string | null;
          error?: string | null;
          executed_by?: string | null;
          finished_at?: string | null;
          id?: string;
          input?: Json | null;
          user_id?: string;
          output?: Json | null;
          started_at?: string;
          status?: string;
          workflow?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workflow_runs_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workflow_runs_executed_by_fkey';
            columns: ['executed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['user_id'];
          },
          {
            foreignKeyName: 'workflow_runs_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      gtrgm_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gtrgm_decompress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gtrgm_in: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gtrgm_options: {
        Args: { '': unknown };
        Returns: undefined;
      };
      gtrgm_out: {
        Args: { '': unknown };
        Returns: unknown;
      };
      is_campaign_owner: {
        Args: { _campaign: string };
        Returns: boolean;
      };
      set_limit: {
        Args: { '': number };
        Returns: number;
      };
      show_limit: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      show_trgm: {
        Args: { '': string };
        Returns: string[];
      };
    };
    Enums: {
      campaign_influencer_status:
        | 'prospect'
        | 'invited'
        | 'accepted'
        | 'declined'
        | 'in_conversation'
        | 'contracted'
        | 'completed';
      campaign_status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
      membership_role: 'owner' | 'admin' | 'member' | 'viewer';
      outreach_channel: 'email' | 'dm' | 'sms' | 'whatsapp' | 'other';
      plan_tier: 'free' | 'starter' | 'pro' | 'enterprise';
      workflow_topic: 'campaign_brief' | 'support' | 'negotiation' | 'ai_assistant';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      campaign_influencer_status: [
        'prospect',
        'invited',
        'accepted',
        'declined',
        'in_conversation',
        'contracted',
        'completed'
      ],
      campaign_status: ['draft', 'active', 'paused', 'completed', 'archived'],
      membership_role: ['owner', 'admin', 'member', 'viewer'],
      outreach_channel: ['email', 'dm', 'sms', 'whatsapp', 'other'],
      plan_tier: ['free', 'starter', 'pro', 'enterprise'],
      workflow_topic: ['campaign_brief', 'support', 'negotiation', 'ai_assistant']
    }
  }
} as const;
